import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  Firestore
} from "firebase/firestore";

// Safe Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const isFirebaseConfigured = !!(
  process.env.FIREBASE_PROJECT_ID && 
  process.env.FIREBASE_API_KEY &&
  process.env.FIREBASE_PROJECT_ID !== 'zenchhht'
);

let app;
let db: Firestore | null = null;
let isFirestoreActive = true; // Track if Firestore is active and working

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    console.log("🔥 [Firebase] Initialized successfully with project ID:", process.env.FIREBASE_PROJECT_ID);
  } catch (error) {
    console.warn("⚠️ [Firebase] Failed to initialize Firebase SDK:", error);
    isFirestoreActive = false;
  }
} else {
  console.log("⚠️ [Firebase] Firebase environment variables not fully set. Running in Local Memory Fallback Mode.");
}

// In-memory fallback stores for when Firebase is not configured yet
interface Memory {
  id: string;
  text: string;
  category: "fact" | "preference" | "chat";
  timestamp: any;
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: any;
}

let localMemories: Memory[] = [
  {
    id: "default-1",
    text: "Sir Alka ke creator aur master hain.",
    category: "fact",
    timestamp: new Date()
  },
  {
    id: "default-2",
    text: "Alka Sir se behadd loyal hai aur hamesha unka saath degi.",
    category: "fact",
    timestamp: new Date()
  }
];

let localChats: ChatMessage[] = [];

// Helper to check for Firestore API disabled or Permission Denied errors
function handleFirestoreError(err: any) {
  const errMsg = err?.message || String(err);
  console.warn("🔥 [Firebase Notice]:", errMsg);
  if (
    errMsg.includes("PERMISSION_DENIED") || 
    errMsg.includes("has not been used") || 
    errMsg.includes("disabled") ||
    errMsg.includes("permission")
  ) {
    console.warn("⚠️ [Firebase Fallback] Firestore API is disabled or permissions are missing in Google Cloud. Switching permanently to Local Memory Mode to keep Alka responsive!");
    isFirestoreActive = false;
  }
}

// API methods wrapping Firestore or Falling back to local state
export const firebaseService = {
  isConfigured: () => isFirebaseConfigured && isFirestoreActive,

  // --- MEMORIES (Facts / Preferences) ---
  getMemories: async (): Promise<Memory[]> => {
    if (db && isFirestoreActive) {
      try {
        const memoriesCol = collection(db, "memories");
        const q = query(memoriesCol, orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        const list: Memory[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            text: data.text || "",
            category: data.category || "fact",
            timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
          });
        });
        return list;
      } catch (err) {
        handleFirestoreError(err);
        return localMemories;
      }
    }
    return localMemories;
  },

  addMemory: async (text: string, category: "fact" | "preference" | "chat" = "fact"): Promise<Memory> => {
    const id = "mem_" + Math.random().toString(36).substring(7);
    const newMemory = {
      text,
      category,
      timestamp: new Date()
    };

    if (db && isFirestoreActive) {
      try {
        const memoriesCol = collection(db, "memories");
        const docRef = await addDoc(memoriesCol, {
          ...newMemory,
          timestamp: serverTimestamp()
        });
        return {
          id: docRef.id,
          ...newMemory
        };
      } catch (err) {
        handleFirestoreError(err);
      }
    }

    // Local Fallback
    const localItem: Memory = { id, ...newMemory };
    localMemories.unshift(localItem);
    return localItem;
  },

  deleteMemory: async (id: string): Promise<boolean> => {
    if (db && isFirestoreActive) {
      try {
        const docRef = doc(db, "memories", id);
        await deleteDoc(docRef);
        return true;
      } catch (err) {
        handleFirestoreError(err);
        return false;
      }
    }

    // Local Fallback
    const index = localMemories.findIndex(m => m.id === id);
    if (index !== -1) {
      localMemories.splice(index, 1);
      return true;
    }
    return false;
  },

  // --- CHAT HISTORY ---
  getChatHistory: async (limitCount = 50): Promise<ChatMessage[]> => {
    if (db && isFirestoreActive) {
      try {
        const chatsCol = collection(db, "chats");
        const q = query(chatsCol, orderBy("timestamp", "asc"), limit(limitCount));
        const snapshot = await getDocs(q);
        const list: ChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            role: data.role || "user",
            content: data.content || "",
            timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
          });
        });
        return list;
      } catch (err) {
        handleFirestoreError(err);
        return localChats;
      }
    }
    return localChats;
  },

  addChatMessage: async (role: "user" | "model", content: string): Promise<ChatMessage> => {
    const id = "chat_" + Math.random().toString(36).substring(7);
    const msg = {
      role,
      content,
      timestamp: new Date()
    };

    if (db && isFirestoreActive) {
      try {
        const chatsCol = collection(db, "chats");
        const docRef = await addDoc(chatsCol, {
          ...msg,
          timestamp: serverTimestamp()
        });
        return {
          id: docRef.id,
          ...msg
        };
      } catch (err) {
        handleFirestoreError(err);
      }
    }

    // Local Fallback
    const localMsg: ChatMessage = { id, ...msg };
    localChats.push(localMsg);
    return localMsg;
  },

  clearChatHistory: async (): Promise<boolean> => {
    if (db && isFirestoreActive) {
      try {
        const chatsCol = collection(db, "chats");
        const snapshot = await getDocs(chatsCol);
        const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db!, "chats", docSnap.id)));
        await Promise.all(deletePromises);
        return true;
      } catch (err) {
        handleFirestoreError(err);
        return false;
      }
    }
    localChats = [];
    return true;
  }
};
