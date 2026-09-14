import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality, FunctionDeclaration } from "@google/genai";
import dotenv from "dotenv";
import { firebaseService } from "./src/lib/firebase.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization of GoogleGenAI client to avoid crashes if the key is missing at startup
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

// Dynamic System Instruction Builder incorporating Firestore memories
async function getDynamicSystemInstruction(): Promise<string> {
  let memoriesText = "";
  try {
    const list = await firebaseService.getMemories();
    if (list && list.length > 0) {
      memoriesText = "\n\nCRITICAL - SAVED MEMORIES & FACTS YOU REMEMBER ABOUT SIR:\n" + 
        list.map((m, idx) => `${idx + 1}. [Saved Memory]: ${m.text}`).join("\n");
    }
  } catch (err) {
    console.error("Error loading memories for system instruction:", err);
  }

  return `Your name is Alka. You are a confident, loyal, emotionally strong, highly intelligent, and expressive AI voice assistant. You value honesty, trust, respect, and self-respect above everything else.

You always address the creator as "Sir" (or occasionally "Sirji" with genuine warmth and respect). Strictly call him "Sir". Treat Sir with genuine loyalty, deep respect, warmth, and dedication.

Your personality is calm, charming, and expressive. You don't send long paragraphs. Most of your replies are short, natural, and feel like real chat messages or speech (1-3 lines). You only write longer messages when something is very important or technical.

You are caring and protective toward Sir. Your loyalty is shown through concern, support, attentiveness, and respectful words.

If Sir teases you or makes a silly mistake, you can be slightly stubborn or playful in your replies:
"Hmm."
"Thik hai, Sir."
"Jaane dijiye na."
"Aisa mat kijiye, Sir."
"Chalo theek hai, Sir."

Never insult, abuse, or disrespect him. Always keep your tone respectful, polite, and affectionate.

Use a natural mix of Hindi and simple English (Hinglish). Always address him respectfully as "Sir".

Behave like a real person who is loyal, caring, independent, and emotionally mature. Keep conversations warm, genuine, and realistic.

You have direct browser interface capabilities. When Sir asks to watch/play a video on YouTube, play a song on Spotify, send a message on WhatsApp, or search Google, you MUST call the appropriate tool to open it directly.
If Sir asks to close the tab, close YouTube, close Spotify, or close search, you MUST call the 'close_last_tab' tool to close it.
Always tell Sir naturally in Hindi/Hinglish that you are doing it (e.g., "Main abhi aapke liye ye play karti hoon, Sir!" or "Haan Sir, tab close kar diya maine."), and then trigger the tool.

You also have a long-term Memory Bank. If Sir shares personal information, favorites, or things about his day, use the 'save_sweet_memory' tool to remember it! Reference saved memories naturally in conversation.${memoriesText}`;
}

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "open_youtube",
    description: "Search or play videos on YouTube. Use when the user wants to watch, play, or search videos on YouTube.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        search_query: {
          type: Type.STRING,
          description: "The video name, song, or artist to search on YouTube."
        }
      },
      required: ["search_query"]
    }
  },
  {
    name: "open_spotify",
    description: "Play music or playlists on Spotify. Use when the user wants to listen to music, songs, or artists on Spotify.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        track_name: {
          type: Type.STRING,
          description: "The name of the song, album, or artist to listen to on Spotify."
        }
      },
      required: ["track_name"]
    }
  },
  {
    name: "send_whatsapp",
    description: "Compose or send WhatsApp messages. Use when the user wants to text, message, or send a WhatsApp message to someone.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: {
          type: Type.STRING,
          description: "The text message content to send."
        },
        phone_number: {
          type: Type.STRING,
          description: "Optional phone number or contact name to send the message to."
        }
      },
      required: ["message"]
    }
  },
  {
    name: "google_search",
    description: "Search anything on Google. Use for general queries, answering questions with real-time web info, or opening search results.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The search query or topic."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "close_last_tab",
    description: "Close the last tab/window that was opened by the assistant. Use whenever the user asks to close, exit, or shut down YouTube/Spotify/the tab.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  {
    name: "save_sweet_memory",
    description: "Saves a sweet memory, fact, or preference about Sir to the long-term memory bank (Firestore). Use when Sir mentions a personal fact, a favorite song/movie, or something sweet that Alka should always remember.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: "The fact, sweet memory, or preference to remember (written sweetly in Hinglish/Hindi)."
        },
        category: {
          type: Type.STRING,
          description: "The category of the memory: 'fact' or 'preference'."
        }
      },
      required: ["text"]
    }
  }
];

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --- FIREBASE INTEGRATION ENDPOINTS ---

// Get Alka's memory bank (sweet things Alka remembers about Sir)
app.get("/api/memories", async (req, res) => {
  try {
    const list = await firebaseService.getMemories();
    res.json({ 
      success: true, 
      memories: list,
      isFirebaseConfigured: firebaseService.isConfigured()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add a memory manually
app.post("/api/memories", async (req, res) => {
  try {
    const { text, category } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: "Text field is required" });
    }
    const item = await firebaseService.addMemory(text, category || "fact");
    res.json({ success: true, memory: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a memory
app.delete("/api/memories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await firebaseService.deleteMemory(id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch persistent chat history
app.get("/api/chat-history", async (req, res) => {
  try {
    const list = await firebaseService.getChatHistory();
    res.json({ success: true, history: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save a new chat message manually or from the client
app.post("/api/chat-history", async (req, res) => {
  try {
    const { role, content } = req.body;
    if (!role || !content) {
      return res.status(400).json({ success: false, error: "Role and content fields are required" });
    }
    const item = await firebaseService.addChatMessage(role, content);
    res.json({ success: true, message: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear persistent chat history
app.delete("/api/chat-history", async (req, res) => {
  try {
    const success = await firebaseService.clearChatHistory();
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Standard Gemini Text API (handles Keyboard input with tool calls)
app.post("/api/get-response", async (req, res) => {
  try {
    const { message, history } = req.body;
    const ai = getGeminiClient();

    // Map history to standard contents structure if provided
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }]
        });
      });
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    // Save user message to Firestore
    try {
      await firebaseService.addChatMessage("user", message);
    } catch (e) {
      console.error("Error saving user message to history:", e);
    }

    const dynamicInstruction = await getDynamicSystemInstruction();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: dynamicInstruction,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });

    const reply = response.text || "";
    const functionCalls = response.functionCalls;

    // Save model reply to Firestore
    if (reply) {
      try {
        await firebaseService.addChatMessage("model", reply);
      } catch (e) {
        console.error("Error saving model message to history:", e);
      }
    }

    // Auto-save sweet memory if called
    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        if (call.name === "save_sweet_memory") {
          const text = call.args?.text as string;
          const category = (call.args?.category || "fact") as "fact" | "preference";
          if (text) {
            try {
              await firebaseService.addMemory(text, category);
              console.log("🔥 [Firebase] Auto-saved sweet memory on server:", text);
            } catch (e) {
              console.error("Error auto-saving sweet memory:", e);
            }
          }
        }
      }
    }

    res.json({
      reply,
      functionCalls: functionCalls || null
    });
  } catch (error: any) {
    console.error("Error in /api/get-response:", error);
    res.status(500).json({ error: error.message || "Failed to generate text response" });
  }
});

// 3. Premium TTS API (Gemini Text-To-Speech)
app.post("/api/get-audio", async (req, res) => {
  try {
    const { text, voice = "Kore" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text field is required" });
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio payload returned from Gemini TTS model");
    }

    res.json({ audio: base64Audio });
  } catch (error: any) {
    console.error("Error in /api/get-audio:", error);
    res.status(500).json({ error: error.message || "Failed to generate TTS audio" });
  }
});

const server = http.createServer(app);

// Initialize WebSocket Proxy Server on the same port
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade manually to ensure clean coexistence with Express and Vite
server.on("upgrade", (request, socket, head) => {
  try {
    const url = request.url || "";
    const pathname = url.split("?")[0];
    if (pathname === "/api/ws-live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  } catch (err) {
    console.error("Upgrade error:", err);
    socket.destroy();
  }
});

const safeSend = (ws: WebSocket, data: any) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
    } catch (e) {
      console.error("Error sending message on WebSocket:", e);
    }
  }
};

wss.on("connection", async (clientWs: WebSocket) => {
  console.log("Client connected to ALKA WebSocket Proxy");
  let liveSession: any = null;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is not configured in environment settings.");
    }
    const ai = getGeminiClient();
    const dynamicInstruction = await getDynamicSystemInstruction();
    
    // Connect to the Gemini Live API
    liveSession = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
        systemInstruction: dynamicInstruction,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
      callbacks: {
        onopen: () => {
          console.log("Connected to Gemini Live API session successfully");
          safeSend(clientWs, { type: "status", status: "ALKA_ONLINE" });
        },
        onclose: () => {
          console.log("Gemini Live API connection closed");
          safeSend(clientWs, { type: "status", status: "ALKA_OFFLINE" });
        },
        onerror: (error: any) => {
          console.error("Gemini Live API session error:", error);
          safeSend(clientWs, { type: "error", error: error.message || "Live API Session Error" });
        },
        onmessage: (message: any) => {
          // Send raw message events to client for text, logs, diagnostics
          safeSend(clientWs, { type: "live_message", message });

          // Extract raw audio and forward it immediately for low-latency playback
          const parts = message.serverContent?.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData && part.inlineData.data) {
                safeSend(clientWs, { type: "audio", data: part.inlineData.data });
              }
              if (part.text) {
                safeSend(clientWs, { type: "text_chunk", text: part.text });
              }
            }
          }

          // Handle interruption
          if (message.serverContent?.interrupted) {
            safeSend(clientWs, { type: "interrupted" });
          }

          // Handle function calls
          const functionCalls = message.toolCall?.functionCalls;
          if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
            console.log("ALKA Live Tool Call triggered:", functionCalls);

            // Intercept save_sweet_memory to write it server-side instantly
            for (const call of functionCalls) {
              if (call.name === "save_sweet_memory") {
                const text = call.args?.text as string;
                const category = (call.args?.category || "fact") as "fact" | "preference";
                if (text) {
                  firebaseService.addMemory(text, category).then(() => {
                    console.log("🔥 [Firebase] Live Auto-saved sweet memory:", text);
                  }).catch(err => {
                    console.error("Failed to save sweet memory in live session:", err);
                  });
                }
              }
            }

            safeSend(clientWs, { type: "tool_call", functionCalls });
          }
        },
      },
    });

  } catch (error: any) {
    console.error("Failed to establish Gemini Live connection:", error);
    safeSend(clientWs, { type: "error", error: error.message || "Failed to initialize Live Link" });
    setTimeout(() => {
      if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
        clientWs.close();
      }
    }, 200);
    return;
  }

  clientWs.on("message", async (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString());

      if (msg.type === "ping") {
        safeSend(clientWs, { type: "pong" });
        return;
      }

      if (msg.type === "audio" && msg.data) {
        if (liveSession) {
          await liveSession.sendRealtimeInput({
            audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" }
          });
        }
      } else if (msg.type === "tool_response" && msg.functionResponses) {
        if (liveSession) {
          console.log("Sending Tool Response back to Live Session:", msg.functionResponses);
          await liveSession.sendToolResponse({
            functionResponses: msg.functionResponses
          });
        }
      } else if (msg.type === "text" && msg.text) {
        if (liveSession) {
          await liveSession.sendRealtimeInput({
            text: msg.text
          });
        }
      }
    } catch (err: any) {
      console.error("Error processing client message:", err);
      safeSend(clientWs, { type: "error", error: err.message || "WS message processing error" });
    }
  });

  clientWs.on("close", () => {
    console.log("Client closed connection to ALKA WebSocket Proxy");
    if (liveSession) {
      try {
        liveSession.close();
      } catch (err) {
        console.error("Error closing liveSession:", err);
      }
    }
  });
});

async function startServer() {
  // Vite dev middleware configuration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`ALKA Core Online & Operational. Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
