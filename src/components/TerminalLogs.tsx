import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Terminal, Monitor, CornerDownLeft, Play, ArrowUpRight } from 'lucide-react';
import { MessageLog } from '../types';

interface TerminalLogsProps {
  isOpen: boolean;
  logs: MessageLog[];
  onClose: () => void;
  onClear: () => void;
  activeState: string;
}

export default function TerminalLogs({ isOpen, logs, onClose, onClear, activeState }: TerminalLogsProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of terminal logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="alka-comms-log"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
          className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-[#03070b]/90 border-l border-violet-500/25 backdrop-blur-md z-40 flex flex-col font-mono"
        >
          {/* Header Bar */}
          <div className="p-4 border-b border-violet-500/20 flex items-center justify-between bg-violet-950/20">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-violet-400 animate-pulse" />
              <span className="text-xs font-semibold tracking-wider text-violet-300">
                ALKA_COMMS_LOG // V3.1
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                id="clear-logs-btn"
                onClick={onClear}
                className="text-[9px] px-2 py-1 border border-violet-500/30 rounded bg-violet-950/30 hover:bg-violet-900/50 hover:border-violet-400 text-violet-300 transition-all cursor-pointer"
              >
                CLEAR_LOGS
              </button>
              
              <button
                id="close-terminal-btn"
                onClick={onClose}
                className="text-violet-400 hover:text-pink-400 transition-colors p-1 rounded hover:bg-white/5 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Connection Status Banner */}
          <div className="px-4 py-2 border-b border-violet-500/10 bg-violet-950/10 flex items-center justify-between text-[10px] text-violet-400/70">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
              <span>CORE_GATEWAY: SEC_CONN_ESTABLISHED</span>
            </div>
            <div className="uppercase">
              STATE: <span className="text-teal-400 font-bold">{activeState}</span>
            </div>
          </div>

          {/* Interactive Logs Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-violet-500/20 scrollbar-track-transparent">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-violet-500/40 text-xs">
                <Monitor size={36} className="mb-3 opacity-25" />
                <p>--- NO TERMINAL DATA ---</p>
                <p className="mt-1 text-[10px]">AWAITING QUANTUM LINK OR VOICE_INPUT</p>
              </div>
            ) : (
              logs.map((log) => {
                const isUser = log.role === 'user';
                const isSystem = log.role === 'system';
                
                if (isSystem) {
                  return (
                    <div key={log.id} className="text-[10px] text-pink-500/80 bg-pink-950/10 border border-pink-500/20 p-2 rounded leading-relaxed">
                      <div className="flex items-center justify-between text-[9px] mb-1 font-semibold">
                        <span>[SYSTEM_ALERT // {log.timestamp}]</span>
                      </div>
                      <div className="whitespace-pre-wrap">{log.text}</div>
                    </div>
                  );
                }

                return (
                  <div key={log.id} className={`space-y-1.5 text-xs ${isUser ? 'text-violet-300' : 'text-teal-200'}`}>
                    {/* Log Header metadata */}
                    <div className="flex items-center justify-between text-[9px] text-violet-400/50 select-none">
                      <span>
                        {isUser ? `[USER_NODE // ${log.mode.toUpperCase()}]` : `[ALKA_REPLY // MODEL_LIVE]`}
                      </span>
                      <span>{log.timestamp}</span>
                    </div>

                    {/* Chat Bubble / Text */}
                    <div className={`p-3 rounded border text-left ${
                      isUser 
                        ? 'bg-violet-950/20 border-violet-500/25' 
                        : 'bg-teal-950/10 border-teal-500/25 shadow-[0_0_8px_rgba(20,184,166,0.05)]'
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed select-text">{log.text}</p>

                      {/* Display function call diagnostics if exists */}
                      {log.toolCall && (
                        <div className="mt-2.5 pt-2 border-t border-dashed border-teal-500/25 text-[10px] text-teal-400 font-mono">
                          <div className="flex items-center gap-1.5 font-semibold text-pink-400">
                            <ArrowUpRight size={12} />
                            <span>FUNCTION_CALL // {log.toolCall.name}</span>
                          </div>
                          <pre className="mt-1 p-1.5 bg-[#03070b] border border-teal-500/10 rounded overflow-x-auto text-[9px] leading-tight">
                            {JSON.stringify(log.toolCall.args, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Terminal Footer Indicator */}
          <div className="p-3 border-t border-violet-500/15 bg-violet-950/20 text-[9px] text-violet-400/40 flex justify-between">
            <span>SYS_VERSION_3.1_RELEASE</span>
            <span>UPLINK_STABLE</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
