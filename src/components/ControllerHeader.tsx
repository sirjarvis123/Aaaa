import React from 'react';
import { Volume2, VolumeX, Terminal, RefreshCw, Radio, User, Brain } from 'lucide-react';

interface ControllerHeaderProps {
  isMuted: boolean;
  onToggleMute: () => void;
  isTerminalOpen: boolean;
  onToggleTerminal: () => void;
  isMemoriesOpen: boolean;
  onToggleMemories: () => void;
  onReset: () => void;
  latency: string;
}

export default function ControllerHeader({
  isMuted,
  onToggleMute,
  isTerminalOpen,
  onToggleTerminal,
  isMemoriesOpen,
  onToggleMemories,
  onReset,
  latency
}: ControllerHeaderProps) {
  return (
    <header className="w-full border-b border-violet-500/15 bg-[#03070b]/60 backdrop-blur-md relative z-30 font-mono select-none">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3.5 flex items-center justify-between">
        {/* Left Side: System Uplink Status */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <Radio size={14} className="text-pink-500 animate-pulse" />
            <span className="absolute -inset-1 rounded-full bg-pink-500/10 animate-ping opacity-75" />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-widest text-white uppercase">ALKA_NODE</span>
              <span className="text-[8px] bg-teal-500/15 border border-teal-500/30 text-teal-400 font-bold px-1 py-[1px] rounded uppercase scale-95">
                SYS_ONLINE
              </span>
            </div>
            <span className="text-[8px] text-violet-400/40 tracking-wider">CREATOR_SEC // SIR_UPLINK</span>
          </div>
        </div>

        {/* Middle Status displays for premium cyberpunk feel */}
        <div className="hidden sm:flex items-center gap-6 text-[10px] text-violet-400/50">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400/40 animate-pulse" />
            <span>LATENCY: <span className="text-violet-300 font-semibold">{latency}</span></span>
          </div>
          <div className="h-3 w-[1px] bg-violet-500/15" />
          <div className="flex items-center gap-1">
            <User size={11} className="text-violet-400/60" />
            <span>OPERATOR: <span className="text-violet-300 uppercase font-semibold">SIR</span></span>
          </div>
        </div>

        {/* Right Side: Interactive HUD Controls */}
        <div className="flex items-center gap-2.5">
          {/* Memory Bank (Alka ki yaadein) Toggle */}
          <button
            id="toggle-memories-btn"
            onClick={onToggleMemories}
            title="Alka's Memory Bank"
            className={`p-2 rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
              isMemoriesOpen
                ? 'bg-gradient-to-r from-violet-600 to-pink-500 border-violet-400 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                : 'bg-violet-950/15 border-violet-500/20 text-violet-300 hover:bg-violet-900/25 hover:border-violet-400'
            }`}
          >
            <Brain size={15} />
            <span className="text-[10px] font-bold hidden md:inline">MEMORY_BANK</span>
          </button>

          {/* Mute/Unmute */}
          <button
            id="toggle-mute-btn"
            onClick={onToggleMute}
            title={isMuted ? "Unmute Audio" : "Mute Audio"}
            className={`p-2 rounded border transition-all cursor-pointer ${
              isMuted
                ? 'bg-pink-500/10 border-pink-500/30 text-pink-400 hover:bg-pink-500/20 shadow-[0_0_8px_rgba(236,72,153,0.1)]'
                : 'bg-violet-950/15 border-violet-500/20 text-violet-300 hover:bg-violet-900/25 hover:border-violet-400'
            }`}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Reset Connection / History */}
          <button
            id="reset-history-btn"
            onClick={onReset}
            title="Reset Terminal & Session"
            className="p-2 rounded border bg-violet-950/15 border-violet-500/20 text-violet-300 hover:bg-violet-900/25 hover:border-violet-400 transition-all cursor-pointer"
          >
            <RefreshCw size={15} className="hover:rotate-45 transition-transform" />
          </button>

          {/* Collapsible Terminal Toggle */}
          <button
            id="toggle-terminal-btn"
            onClick={onToggleTerminal}
            title="Toggle Comms Logs Terminal"
            className={`p-2 rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
              isTerminalOpen
                ? 'bg-violet-500/15 border-violet-500/40 text-white shadow-[0_0_10px_rgba(139,92,246,0.15)]'
                : 'bg-violet-950/15 border-violet-500/20 text-violet-300 hover:bg-violet-900/25 hover:border-violet-400'
            }`}
          >
            <Terminal size={15} />
            <span className="text-[10px] font-bold hidden md:inline">TERMINAL</span>
          </button>
        </div>
      </div>
      
      {/* Visual scanning line beneath the header */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/35 to-transparent" />
    </header>
  );
}
