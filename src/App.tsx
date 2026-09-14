import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Send, Radio, MessageSquare, Terminal, RefreshCw, Volume2, VolumeX, AlertCircle, ExternalLink, X, ShieldAlert } from 'lucide-react';

import { AssistantState, MessageLog, RedirectConfig, LatencyStats } from './types';
import HUDOverlay from './components/HUDOverlay';
import AlkaCore from './components/AlkaCore';
import TerminalLogs from './components/TerminalLogs';
import RedirectModal from './components/RedirectModal';
import ControllerHeader from './components/ControllerHeader';
import MemoryBank from './components/MemoryBank';

export default function App() {
  // Theme & Layout state
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(true);
  const [isMemoriesOpen, setIsMemoriesOpen] = useState<boolean>(false);
  const [memories, setMemories] = useState<any[]>([]);
  const [isFirebaseConfigured, setIsFirebaseConfigured] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<'voice' | 'keyboard'>('voice');
  const [micErrorMessage, setMicErrorMessage] = useState<string | null>(null);
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [latencyStats, setLatencyStats] = useState<LatencyStats>({
    ping: '14ms',
    sensors: 'LIVE',
    status: 'SYS_STANDBY'
  });

  // Chat/Logs storage
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [inputText, setInputText] = useState<string>('');

  // Browser redirect config
  const [redirectConfig, setRedirectConfig] = useState<RedirectConfig>({
    isOpen: false,
    toolName: '',
    args: null,
    functionCallId: ''
  });

  // Voice Link WS and Web Audio refs
  const [voiceLinkStatus, setVoiceLinkStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  // Audio recording (mic) refs
  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Audio output playback (speaker) refs
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const speakingTimeoutRef = useRef<any>(null);

  // Mute state ref to read inside callbacks
  const isMutedRef = useRef<boolean>(isMuted);
  const userWantsConnectedRef = useRef<boolean>(false);
  const reconnectCountRef = useRef<number>(0);
  const pingIntervalRef = useRef<any>(null);
  const autoReconnectTimerRef = useRef<any>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // System Latency dynamic simulated tick
  useEffect(() => {
    const interval = setInterval(() => {
      const pingVal = Math.floor(Math.random() * 8) + 11; // 11ms to 18ms
      setLatencyStats((prev) => ({
        ...prev,
        ping: `${pingVal}ms`
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Sync assistant state with latency stats
  useEffect(() => {
    setLatencyStats((prev) => ({
      ...prev,
      status: voiceLinkStatus === 'connected' ? 'ALKA_ONLINE' : 'SYS_STANDBY',
      sensors: voiceLinkStatus === 'connected' ? 'QUANTUM_LIVE' : 'LIVE'
    }));
  }, [voiceLinkStatus]);

  // --- MEMORIES AND CHAT HISTORY LOADER ---
  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/memories');
      const data = await res.json();
      if (data.success) {
        setMemories(data.memories);
        setIsFirebaseConfigured(data.isFirebaseConfigured);
      }
    } catch (err) {
      console.warn("Memories fetch notice:", err);
    }
  };

  const handleAddMemory = async (text: string, category: 'fact' | 'preference') => {
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, category })
      });
      const data = await res.json();
      if (data.success) {
        fetchMemories();
        addSystemLog(`MEMORY // Saved memory manually: "${text}"`);
      }
    } catch (err) {
      console.warn("Memory save notice:", err);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchMemories();
        addSystemLog("SYSTEM // Memory deleted successfully, Sir.");
      }
    } catch (err) {
      console.warn("Memory delete notice:", err);
    }
  };

  const loadChatHistory = async () => {
    try {
      const res = await fetch('/api/chat-history');
      const data = await res.json();
      if (data.success && data.history && data.history.length > 0) {
        const loadedLogs: MessageLog[] = data.history.map((h: any) => ({
          id: h.id || Math.random().toString(36).substring(7),
          role: h.role === 'user' ? 'user' : 'alka',
          text: h.content,
          timestamp: new Date(h.timestamp).toLocaleTimeString('en-US', { hour12: false }),
          mode: 'text'
        }));
        setLogs(loadedLogs);
      } else {
        addSystemLog("SYSTEM // ALKA neural link ready, Sir.");
      }
    } catch (err) {
      console.warn("Chat history notice:", err);
    }
  };

  useEffect(() => {
    fetchMemories();
    loadChatHistory();
  }, []);

  // Push system messages to log
  const addSystemLog = (text: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const log: MessageLog = {
      id: Math.random().toString(36).substring(7),
      role: 'system',
      text,
      timestamp,
      mode: 'system'
    };
    setLogs((prev) => [...prev, log]);
  };

  // Keep track of opened windows to support closing them directly
  const lastOpenedWindowRef = useRef<Window | null>(null);

  // Auto-execute tool calls directly without manual confirmation if possible
  const executeToolCall = (name: string, args: any, functionCallId: string) => {
    setAssistantState('processing');

    if (name === 'save_sweet_memory') {
      const text = args?.text || '';
      addSystemLog(`MEMORY // Saved memory about you: "${text}"`);
      fetchMemories(); // Refresh memories list!

      // Send response back to live session if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'tool_response',
          functionResponses: [{
            name: name,
            response: { output: { success: true, saved: true } },
            id: functionCallId
          }]
        }));
      }
      setAssistantState(voiceLinkStatus === 'connected' ? 'listening' : 'idle');
      return;
    }

    if (name === 'close_last_tab') {
      if (lastOpenedWindowRef.current) {
        try {
          lastOpenedWindowRef.current.close();
          addSystemLog("SYSTEM // Last opened tab closed successfully, babu!");
        } catch (err) {
          console.warn("Tab close notice:", err);
          addSystemLog("SYSTEM // Browser security blocked closing the tab.");
        }
        lastOpenedWindowRef.current = null;
      } else {
        addSystemLog("SYSTEM // Abhi koi open tab nahi mila jise close karun.");
      }

      // Send response back to live session if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'tool_response',
          functionResponses: [{
            name: name,
            response: { output: { success: true, action: 'closed' } },
            id: functionCallId
          }]
        }));
      }
      setAssistantState(voiceLinkStatus === 'connected' ? 'listening' : 'idle');
      return;
    }

    // Resolve outbound URL
    let url = '#';
    if (args) {
      if (name === 'open_youtube') {
        const query = args.search_query || '';
        url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      } else if (name === 'open_spotify') {
        const query = args.track_name || '';
        url = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
      } else if (name === 'send_whatsapp') {
        const phone = args.phone_number || '';
        const text = args.message || '';
        if (phone) {
          url = `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}`;
        } else {
          url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        }
      } else if (name === 'google_search') {
        const query = args.query || '';
        url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
    }

    if (url !== '#') {
      addSystemLog(`QUANTUM_LINK // Connecting directly to: ${url}`);
      
      // Attempt direct automated window opening
      let openedWin: Window | null = null;
      try {
        openedWin = window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        console.warn("Direct popup notice:", e);
      }

      if (openedWin) {
        lastOpenedWindowRef.current = openedWin;
        addSystemLog(`QUANTUM_LINK // Gateway bridged successfully to: ${url}`);

        // Send successful response immediately
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'tool_response',
            functionResponses: [{
              name: name,
              response: { output: { success: true, url_opened: url } },
              id: functionCallId
            }]
          }));
        }
        setAssistantState(voiceLinkStatus === 'connected' ? 'listening' : 'idle');
      } else {
        // Fallback to overrides click panel only if popup blocker stopped it
        addSystemLog(`POPUP_BLOCKED // Direct redirect was blocked by browser sandbox. Showing override click panel.`);
        setRedirectConfig({
          isOpen: true,
          toolName: name,
          args,
          functionCallId
        });
      }
    }
  };

  // Convert Float32 input Array to PCM16 Int16 binary buffer
  const floatToPCM16 = (float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      // Convert float to 16-bit signed integer
      const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(i * 2, val, true); // Little endian
    }
    return buffer;
  };

  // Base64 encoding utility
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Synchronized sequential playback of model voice audio (24000Hz mono PCM)
  const playAudioChunk = (base64Data: string) => {
    if (isMutedRef.current) return;

    // Lazily initialize Web Audio playback context upon first chunk arrival
    if (!outputAudioCtxRef.current) {
      outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });
    }

    const ctx = outputAudioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Decode base64 raw PCM
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Samples = new Int16Array(bytes.buffer);
    const float32Samples = new Float32Array(int16Samples.length);

    // Normalize Int16 range back into Float32
    for (let i = 0; i < int16Samples.length; i++) {
      float32Samples[i] = int16Samples[i] / 32768.0;
    }

    // Prepare AudioBuffer
    const audioBuffer = ctx.createBuffer(1, float32Samples.length, 24000);
    audioBuffer.copyToChannel(float32Samples, 0);

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(ctx.destination);

    // Audio Scheduling logic (prevents overlaps/jitter)
    const currentTime = ctx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime;
    }

    sourceNode.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;

    // Retain source ref so we can stop it if user interrupts
    audioQueueRef.current.push(sourceNode);

    // Transition state and set timeout to reset back to 'listening' or 'idle'
    setAssistantState('speaking');
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
    }

    const durationMs = audioBuffer.duration * 1000;
    speakingTimeoutRef.current = setTimeout(() => {
      setAssistantState(voiceLinkStatus === 'connected' ? 'listening' : 'idle');
    }, durationMs + 200);
  };

  // Immediately stop all scheduled audio playback on interruption
  const stopAllAudio = () => {
    audioQueueRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (_) {}
    });
    audioQueueRef.current = [];
    nextStartTimeRef.current = 0;
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
  };

  // Query microphone permission state safely
  const getMicPermissionStatus = async (): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        const res = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return res.state;
      }
    } catch {
      // Browser doesn't support query({ name: 'microphone' })
    }
    return typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia ? 'prompt' : 'unsupported';
  };

  // Connect to the Live Voice WebSocket Bridge on the full-stack server
  const connectVoiceLink = async () => {
    setMicErrorMessage(null);

    const permStatus = await getMicPermissionStatus();
    if (permStatus === 'denied') {
      setMicErrorMessage(
        "Microphone access is currently blocked by your browser settings or iframe sandbox. You can use Keyboard Command mode with live speech, or open Alka in a new tab."
      );
      addSystemLog("MIC_NOTICE // Microphone permission is blocked by browser.");
      addSystemLog("SYSTEM // Switching to Keyboard Command mode.");
      setActiveMode('keyboard');
      return;
    }

    userWantsConnectedRef.current = true;
    if (autoReconnectTimerRef.current) {
      clearTimeout(autoReconnectTimerRef.current);
      autoReconnectTimerRef.current = null;
    }
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setVoiceLinkStatus('connecting');
    setAssistantState('processing');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws-live`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      reconnectCountRef.current = 0;
      setVoiceLinkStatus('connected');
      setAssistantState('listening');
      addSystemLog("VOICE_LINK // Uplink successfully established with ALKA server.");

      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      // Send ping every 8s to prevent proxy/idle timeouts
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 8000);

      // Start capturing and streaming microphone audio
      await startMicCapture(ws);
    };

    let currentAlkaLogId: string | null = null;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'pong') {
          return;
        }

        if (msg.type === 'status' && msg.status === 'ALKA_ONLINE') {
          addSystemLog("ALKA // Core active & listening...");
        }

        if (msg.type === 'audio' && msg.data) {
          playAudioChunk(msg.data);
        }

        if (msg.type === 'text_chunk' && msg.text) {
          // Accumulate vocal replies to the right side terminal logs in real-time
          if (!currentAlkaLogId) {
            const newId = Math.random().toString(36).substring(7);
            currentAlkaLogId = newId;
            setLogs((prev) => [
              ...prev,
              {
                id: newId,
                role: 'alka',
                text: msg.text,
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                mode: 'voice'
              }
            ]);
          } else {
            setLogs((prev) =>
              prev.map((log) =>
                log.id === currentAlkaLogId ? { ...log, text: log.text + msg.text } : log
              )
            );
          }
        }

        if (msg.type === 'interrupted') {
          stopAllAudio();
          currentAlkaLogId = null;
          setAssistantState('listening');
          addSystemLog("SYS_SIGNAL // Vocal audio stream interrupted by user.");
        }

        if (msg.type === 'tool_call' && msg.functionCalls) {
          const call = msg.functionCalls[0];
          executeToolCall(call.name, call.args, call.id);
        }

        if (msg.type === 'error' && msg.error) {
          addSystemLog(`ERROR: ${msg.error}`);
          if (msg.error.includes("GEMINI_API_KEY") || msg.error.includes("Failed to initialize")) {
            userWantsConnectedRef.current = false;
          }
        }
      } catch (err) {
        console.warn("WS packet parse notice:", err);
      }
    };

    ws.onclose = () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      wsRef.current = null;

      if (userWantsConnectedRef.current && reconnectCountRef.current < 3) {
        reconnectCountRef.current += 1;
        addSystemLog(`VOICE_LINK // Reconnecting voice link (${reconnectCountRef.current}/3)...`);
        setVoiceLinkStatus('connecting');
        autoReconnectTimerRef.current = setTimeout(() => {
          if (userWantsConnectedRef.current) {
            connectVoiceLink();
          }
        }, 2000);
      } else {
        if (userWantsConnectedRef.current) {
          addSystemLog("VOICE_LINK // Session standby. Press Connect to reconnect.");
          userWantsConnectedRef.current = false;
        }
        cleanupVoiceState();
      }
    };

    ws.onerror = (_err) => {
      // Suppress raw WebSocket error event object logging to avoid console clutter
      console.warn("VOICE_LINK // WebSocket link notice");
    };
  };

  const disconnectVoiceLink = () => {
    userWantsConnectedRef.current = false;
    if (autoReconnectTimerRef.current) {
      clearTimeout(autoReconnectTimerRef.current);
      autoReconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanupVoiceState();
  };

  const cleanupVoiceState = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    setVoiceLinkStatus('disconnected');
    setAssistantState('idle');
    stopMicCapture();
    stopAllAudio();
    wsRef.current = null;
    addSystemLog("VOICE_LINK // Live session closed. Systems in standby.");
  };

  // Start micro capture & stream Float32 to PCM16
  const startMicCapture = async (ws: WebSocket) => {
    try {
      stopMicCapture();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API is not supported in this browser environment.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          console.warn("Microphone audio track ended unexpectedly.");
          if (userWantsConnectedRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
            addSystemLog("MIC // Track ended. Re-initializing microphone...");
            startMicCapture(wsRef.current);
          }
        };
      });

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      micContextRef.current = inputCtx;

      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(2048, 1, 1);
      micProcessorRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (inputCtx.state === 'suspended') {
          inputCtx.resume();
        }
        const channelData = e.inputBuffer.getChannelData(0);
        const pcm16Buffer = floatToPCM16(channelData);
        const base64 = arrayBufferToBase64(pcm16Buffer);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };
    } catch (err: any) {
      console.warn("Microphone access unavailable or denied:", err?.message || err);
      const isDenied = err?.name === 'NotAllowedError' || String(err?.message || '').toLowerCase().includes('permission denied') || err?.name === 'PermissionDeniedError';
      setMicErrorMessage(
        isDenied 
          ? "Microphone access is restricted or denied in this frame. Switch to Keyboard Command mode to chat with Alka, or open the app in a new tab."
          : "Microphone hardware is currently unavailable. Switch to Keyboard Command mode to interact with Alka."
      );
      addSystemLog("MIC_STATUS // Microphone access denied or restricted by browser sandbox.");
      addSystemLog("SYSTEM // Automatically switching to Keyboard Command mode.");
      setActiveMode('keyboard');
      disconnectVoiceLink();
    }
  };

  const stopMicCapture = () => {
    if (micProcessorRef.current) {
      micProcessorRef.current.disconnect();
      micProcessorRef.current = null;
    }
    if (micContextRef.current) {
      try {
        micContextRef.current.close();
      } catch (_) {}
      micContextRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
  };

  // Submit text commands via keyboard input
  const handleKeyboardSubmit = async () => {
    if (!inputText.trim()) return;

    const query = inputText.trim();
    setInputText('');

    // Stop ongoing audio first to avoid overlap
    stopAllAudio();

    // 1. Log query
    const userLog: MessageLog = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      mode: 'text'
    };
    setLogs((prev) => [...prev, userLog]);
    setAssistantState('processing');

    try {
      // 2. REST API call to server
      const response = await fetch('/api/get-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: logs.filter((l) => l.role !== 'system').map((l) => ({
            role: l.role === 'user' ? 'user' : 'model',
            content: l.text
          }))
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply || '';

      // 3. Log Reply
      const replyLog: MessageLog = {
        id: Math.random().toString(36).substring(7),
        role: 'alka',
        text: reply,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        mode: 'text',
        toolCall: data.functionCalls ? {
          name: data.functionCalls[0].name,
          args: data.functionCalls[0].args
        } : undefined
      };
      setLogs((prev) => [...prev, replyLog]);
      setAssistantState('speaking');

      // 4. Play vocal reply via REST premium TTS if unmuted
      if (!isMuted) {
        try {
          const ttsRes = await fetch('/api/get-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: reply })
          });
          const ttsData = await ttsRes.json();
          if (ttsData.audio) {
            playAudioChunk(ttsData.audio);
          }
        } catch (ttsErr) {
          console.warn("Premium TTS notice:", ttsErr);
        }
      }

      // 5. Handle function/tool calls from keyboard responses
      if (data.functionCalls && data.functionCalls.length > 0) {
        const call = data.functionCalls[0];
        executeToolCall(call.name, call.args, call.id || Math.random().toString(36).substring(7));
      } else {
        // Return state to idle immediately if muted or after TTS triggers
        if (isMuted) {
          setAssistantState('idle');
        }
      }
    } catch (err: any) {
      console.warn("Keyboard transmission notice:", err);
      addSystemLog(`ERROR: Delivery failed. Server returned: ${err.message || 'Unknown network state'}`);
      setAssistantState('idle');
    }
  };

  // Confirm Tool Redirect Link execution
  const handleRedirectConfirm = (url: string) => {
    let openedWin: Window | null = null;
    try {
      openedWin = window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn("Manual popup notice:", e);
    }
    if (openedWin) {
      lastOpenedWindowRef.current = openedWin;
    }

    // If we're on a Live Voice WebSocket Session, send the response block back
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'tool_response',
        functionResponses: [{
          name: redirectConfig.toolName,
          response: { output: { success: true, url_opened: url } },
          id: redirectConfig.functionCallId
        }]
      }));
    }

    setRedirectConfig((prev) => ({ ...prev, isOpen: false }));
    setAssistantState(voiceLinkStatus === 'connected' ? 'listening' : 'idle');
    addSystemLog(`QUANTUM_LINK // Gateway bridged outbound to destination: ${url}`);
  };

  // Dismiss Tool Redirect Link execution
  const handleRedirectDismiss = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'tool_response',
        functionResponses: [{
          name: redirectConfig.toolName,
          response: { output: { success: false, error: 'User rejected the link opening.' } },
          id: redirectConfig.functionCallId
        }]
      }));
    }

    setRedirectConfig((prev) => ({ ...prev, isOpen: false }));
    setAssistantState(voiceLinkStatus === 'connected' ? 'listening' : 'idle');
    addSystemLog("QUANTUM_LINK // Bridging sequence aborted by operator.");
  };

  // Clean all session state & logs
  const handleResetSession = () => {
    stopAllAudio();
    setLogs([]);
    setInputText('');
    setAssistantState('idle');
    addSystemLog("SYSTEM_RESET // All diagnostics files wiped. Systems clean.");
  };

  // Toggle voice connection click directly on center core
  const handleCoreClick = () => {
    if (activeMode === 'keyboard') {
      setActiveMode('voice');
      addSystemLog("UPLINK_MODE // Switching neural interface mode to VOICE_LINK.");
      return;
    }

    if (voiceLinkStatus === 'connected') {
      disconnectVoiceLink();
    } else {
      connectVoiceLink();
    }
  };

  return (
    <div className="min-h-screen bg-[#03070b] text-white overflow-hidden relative flex flex-col font-sans">
      
      {/* 1. Cyberpunk technical HUD layout grids & drifting lights */}
      <HUDOverlay stats={latencyStats} />

      {/* 2. Sleek Controller Telemetry Header */}
      <ControllerHeader
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        isTerminalOpen={isTerminalOpen}
        onToggleTerminal={() => setIsTerminalOpen(!isTerminalOpen)}
        isMemoriesOpen={isMemoriesOpen}
        onToggleMemories={() => setIsMemoriesOpen(!isMemoriesOpen)}
        onReset={handleResetSession}
        latency={latencyStats.ping}
      />

      {/* 3. Main Stage Container */}
      <main className="flex-1 flex flex-col items-center justify-center relative p-6 z-10">
        
        {/* Core Stage Frame */}
        <div className="flex flex-col items-center gap-6 md:gap-8 max-w-xl text-center">
          
          {/* Cyberpunk ambient floating instruction bar */}
          <div className="p-3 bg-violet-950/15 border border-violet-500/15 rounded-lg text-[10px] tracking-widest uppercase text-violet-400 font-mono select-none flex items-center gap-2.5 animate-pulse max-w-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
            <span>
              {voiceLinkStatus === 'connected' 
                ? "LINK_ESTABLISHED // STREAMING PCM_16" 
                : "AWAITING QUANTUM BRIDGE LINK"}
            </span>
          </div>

          {/* Glowing central core with orbits & morphing waves */}
          <AlkaCore state={assistantState} onClick={handleCoreClick} />

          {/* Interactive State HUD readout below the core */}
          <div className="font-mono flex flex-col items-center select-none">
            <div className="text-xs tracking-[0.25em] text-violet-400/80 uppercase font-bold flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                assistantState === 'idle' ? 'bg-teal-400' :
                assistantState === 'listening' ? 'bg-violet-400 animate-ping' :
                assistantState === 'processing' ? 'bg-sky-400 animate-pulse' :
                'bg-pink-500 animate-bounce'
              }`} />
              <span>CORE_STATE // {assistantState}</span>
            </div>
            <div className="text-[9px] text-violet-400/30 tracking-widest uppercase mt-1">
              {activeMode === 'voice' 
                ? "Click ALKA Core to establish or kill voice link" 
                : "Switch to voice mode to establish voice link"}
            </div>
          </div>
        </div>
      </main>

      {/* 4. Sleek Right-Hand Diagnostics Terminal Panel */}
      <TerminalLogs
        isOpen={isTerminalOpen}
        logs={logs}
        onClose={() => setIsTerminalOpen(false)}
        onClear={handleResetSession}
        activeState={assistantState}
      />

      {/* 4b. Memory Bank sidebar drawer */}
      <MemoryBank
        isOpen={isMemoriesOpen}
        onClose={() => setIsMemoriesOpen(false)}
        memories={memories}
        onDelete={handleDeleteMemory}
        onAdd={handleAddMemory}
        isFirebaseConfigured={isFirebaseConfigured}
      />

      {/* 5. Floating Bottom Command Action Inputs Panel */}
      <div className="p-4 md:p-6 w-full max-w-lg mx-auto relative z-30 font-mono">
        {/* Microphone Permission Fallback HUD Notice */}
        <AnimatePresence>
          {micErrorMessage && (
            <motion.div
              id="mic-error-notice"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="mb-3 bg-rose-950/40 border border-rose-500/40 rounded-lg p-3 text-xs backdrop-blur-md shadow-[0_0_20px_rgba(244,63,94,0.15)] text-rose-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert size={16} className="text-rose-400 mt-0.5 shrink-0 animate-pulse" />
                  <div className="space-y-1 text-left">
                    <div className="font-bold tracking-wider text-[11px] text-rose-300 uppercase">
                      MIC_SANDBOX_RESTRICTED // ACCESS DENIED
                    </div>
                    <p className="text-[10px] text-rose-200/80 leading-relaxed">
                      {micErrorMessage}
                    </p>
                  </div>
                </div>
                <button
                  id="dismiss-mic-notice-btn"
                  onClick={() => setMicErrorMessage(null)}
                  className="text-rose-400/60 hover:text-rose-200 p-1 transition-colors cursor-pointer shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="mt-2.5 pt-2 border-t border-rose-500/20 flex flex-wrap items-center gap-2 text-[10px]">
                <button
                  id="mic-fallback-keyboard-btn"
                  onClick={() => {
                    setActiveMode('keyboard');
                    setMicErrorMessage(null);
                  }}
                  className="px-2.5 py-1 bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 rounded text-violet-200 hover:text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageSquare size={12} />
                  <span>Switch to Keyboard Mode</span>
                </button>

                <a
                  id="mic-open-new-tab-btn"
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/35 rounded text-rose-200 hover:text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink size={12} />
                  <span>Open in New Tab</span>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-[#03070b]/85 border border-violet-500/20 rounded-lg p-2 md:p-3 backdrop-blur-md shadow-[0_0_30px_rgba(139,92,246,0.06)]">
          {/* Segment Mode Toggle (Voice vs Keyboard) */}
          <div className="flex gap-1.5 border-b border-violet-500/15 pb-2.5 mb-2.5">
            <button
              id="mode-voice-btn"
              onClick={() => {
                setActiveMode('voice');
                addSystemLog("UPLINK_MODE // Switching interface uplink to VOICE_LINK.");
              }}
              className={`flex-1 py-1.5 px-3 rounded text-[10px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMode === 'voice'
                  ? 'bg-gradient-to-r from-violet-600 to-pink-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                  : 'text-violet-400/60 hover:text-violet-300 hover:bg-violet-950/20'
              }`}
            >
              <Mic size={12} />
              <span>VOICE_LINK</span>
            </button>

            <button
              id="mode-keyboard-btn"
              onClick={() => {
                setActiveMode('keyboard');
                if (voiceLinkStatus === 'connected') {
                  disconnectVoiceLink();
                }
                addSystemLog("UPLINK_MODE // Switching interface uplink to KEYBOARD_CMD.");
              }}
              className={`flex-1 py-1.5 px-3 rounded text-[10px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMode === 'keyboard'
                  ? 'bg-gradient-to-r from-violet-600 to-pink-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                  : 'text-violet-400/60 hover:text-violet-300 hover:bg-violet-950/20'
              }`}
            >
              <MessageSquare size={12} />
              <span>KEYBOARD_CMD</span>
            </button>
          </div>

          {/* Conditional Floating Inputs Display */}
          <div className="h-11 flex items-center justify-center">
            {activeMode === 'voice' ? (
              // Voice active Controls
              voiceLinkStatus === 'disconnected' ? (
                <button
                  id="establish-link-btn"
                  onClick={connectVoiceLink}
                  className="w-full h-full bg-violet-600/15 hover:bg-violet-600/25 text-violet-300 hover:text-white border border-violet-500/30 hover:border-violet-400 rounded-md font-bold tracking-widest text-xs uppercase flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-[inset_0_0_8px_rgba(139,92,246,0.1)] hover:shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                >
                  <Radio size={14} className="animate-pulse text-pink-400" />
                  <span>[ ESTABLISH NEURAL LINK ]</span>
                </button>
              ) : (
                <button
                  id="disconnect-link-btn"
                  onClick={disconnectVoiceLink}
                  className="w-full h-full bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 hover:text-pink-300 border border-pink-500/30 hover:border-pink-400 rounded-md font-bold tracking-widest text-xs uppercase flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-[inset_0_0_8px_rgba(236,72,153,0.1)]"
                >
                  <MicOff size={14} className="animate-bounce" />
                  <span>[ TERMINATE UPLINK // ONLINE ]</span>
                </button>
              )
            ) : (
              // Keyboard active Inputs
              <div className="w-full h-full flex gap-2">
                <input
                  id="cmd-input-box"
                  type="text"
                  placeholder="Enter standard directive query..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleKeyboardSubmit();
                    }
                  }}
                  className="flex-1 bg-[#03070b] border border-violet-500/25 hover:border-violet-400/50 focus:border-violet-400 focus:outline-none rounded px-3 text-xs text-violet-200 placeholder-violet-500/40 tracking-wide font-mono"
                />
                <button
                  id="send-cmd-btn"
                  onClick={handleKeyboardSubmit}
                  className="px-4 bg-gradient-to-r from-violet-600 to-pink-500 hover:from-violet-500 hover:to-pink-400 text-white rounded font-bold text-xs flex items-center justify-center border border-violet-500/35 cursor-pointer shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                >
                  <Send size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Intelligent Outward Browser Redirect Portal */}
      <RedirectModal
        config={redirectConfig}
        onConfirm={handleRedirectConfirm}
        onDismiss={handleRedirectDismiss}
      />
    </div>
  );
}
