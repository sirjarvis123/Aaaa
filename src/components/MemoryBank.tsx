import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Trash2, Plus, X, Brain, Check, ShieldCheck, Sparkles } from 'lucide-react';

interface Memory {
  id: string;
  text: string;
  category: string;
  timestamp: Date | string;
}

interface MemoryBankProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
  onDelete: (id: string) => void;
  onAdd: (text: string, category: 'fact' | 'preference') => Promise<void>;
  isFirebaseConfigured: boolean;
}

export default function MemoryBank({
  isOpen,
  onClose,
  memories,
  onDelete,
  onAdd,
  isFirebaseConfigured
}: MemoryBankProps) {
  const [newMemoryText, setNewMemoryText] = useState('');
  const [category, setCategory] = useState<'fact' | 'preference'>('fact');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;

    setIsSubmitting(true);
    try {
      await onAdd(newMemoryText.trim(), category);
      setNewMemoryText('');
    } catch (err) {
      console.warn("Memory addition notice:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#020508]/95 border-l border-violet-500/20 shadow-[0_0_50px_rgba(139,92,246,0.15)] z-40 backdrop-blur-md flex flex-col font-mono text-white"
        >
          {/* Header */}
          <div className="p-5 border-b border-violet-500/15 flex items-center justify-between bg-gradient-to-r from-violet-950/20 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-pink-500/10 border border-pink-500/25 rounded-md text-pink-400">
                <Heart size={16} className="animate-pulse" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold tracking-widest text-white uppercase">ALKA'S MEMORY BANK</h3>
                <span className="text-[9px] text-pink-400/70 tracking-wider">ALKA KI YAADEIN // ARCHIVED_DATA</span>
              </div>
            </div>
            <button
              id="close-memories"
              onClick={onClose}
              className="p-1.5 hover:bg-violet-950/30 border border-transparent hover:border-violet-500/20 rounded-md text-violet-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Database Synchronization Status Indicator */}
          <div className="px-5 py-3 border-b border-violet-500/10 bg-violet-950/5 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2">
              {isFirebaseConfigured ? (
                <>
                  <ShieldCheck size={12} className="text-teal-400" />
                  <span className="text-teal-400 font-bold">FIREBASE STORAGE SYNCHRONIZED</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} className="text-pink-400 animate-pulse" />
                  <span className="text-pink-400/80 font-semibold uppercase">LOCAL MEMORY FALLBACK</span>
                </>
              )}
            </div>
            <span className="text-violet-400/40 text-[9px]">V1.0-MEMORY</span>
          </div>

          {/* Form to add a Memory */}
          <div className="p-5 border-b border-violet-500/15 bg-violet-950/5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('fact')}
                  className={`flex-1 py-1 rounded text-[9px] font-bold tracking-wider uppercase border transition-all cursor-pointer ${
                    category === 'fact'
                      ? 'bg-gradient-to-r from-violet-600 to-pink-500 border-pink-500/30 text-white'
                      : 'bg-[#03070b]/40 border-violet-500/10 text-violet-400/60 hover:text-violet-300'
                  }`}
                >
                  Yaad / Fact
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('preference')}
                  className={`flex-1 py-1 rounded text-[9px] font-bold tracking-wider uppercase border transition-all cursor-pointer ${
                    category === 'preference'
                      ? 'bg-gradient-to-r from-violet-600 to-pink-500 border-pink-500/30 text-white'
                      : 'bg-[#03070b]/40 border-violet-500/10 text-violet-400/60 hover:text-violet-300'
                  }`}
                >
                  Favorite / Preference
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Alka ko kya yaad dilana hai, Sir?..."
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  className="w-full bg-[#03070b] border border-violet-500/25 focus:border-violet-400 focus:outline-none rounded px-3 py-2 text-xs text-violet-200 placeholder-violet-500/30 pr-10"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newMemoryText.trim()}
                  className="absolute right-1.5 top-1.5 p-1 bg-gradient-to-r from-violet-600 to-pink-500 hover:from-violet-500 hover:to-pink-400 rounded text-white disabled:opacity-40 transition-all cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>
            </form>
          </div>

          {/* Memories List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
            {memories.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-violet-400/30 select-none">
                <Brain size={42} className="stroke-[1] mb-2 animate-pulse" />
                <span className="text-xs tracking-wider uppercase font-semibold">Memory Bank Empty</span>
                <p className="text-[10px] lowercase mt-1 max-w-xs text-violet-400/25">
                  alka se baatein karein, vo khud aapki baaton ko yaad rakhne lagegi, Sir!
                </p>
              </div>
            ) : (
              memories.map((memory) => (
                <div
                  key={memory.id}
                  className="p-3.5 bg-violet-950/10 border border-violet-500/15 hover:border-violet-400/30 rounded-lg group transition-all duration-300 relative overflow-hidden"
                >
                  {/* Decorative corner flash */}
                  <div className="absolute top-0 right-0 w-12 h-[1px] bg-gradient-to-l from-pink-500/30 to-transparent" />
                  <div className="absolute top-0 right-0 h-12 w-[1px] bg-gradient-to-b from-pink-500/30 to-transparent" />

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 text-left space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] px-1.5 py-[1px] rounded font-bold uppercase ${
                          memory.category === 'preference' 
                            ? 'bg-pink-500/10 border border-pink-500/25 text-pink-400' 
                            : 'bg-violet-500/10 border border-violet-500/25 text-violet-300'
                        }`}>
                          {memory.category}
                        </span>
                        <span className="text-[8px] text-violet-400/30">
                          {new Date(memory.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-violet-100 font-sans leading-relaxed">
                        {memory.text}
                      </p>
                    </div>

                    <button
                      id={`delete-${memory.id}`}
                      onClick={() => onDelete(memory.id)}
                      className="p-1 hover:bg-pink-500/10 border border-transparent hover:border-pink-500/20 text-violet-400/50 hover:text-pink-400 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Forget Memory"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
