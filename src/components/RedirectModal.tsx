import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, ExternalLink, Link, X } from 'lucide-react';
import { RedirectConfig } from '../types';

interface RedirectModalProps {
  config: RedirectConfig;
  onConfirm: (url: string) => void;
  onDismiss: () => void;
}

export default function RedirectModal({ config, onConfirm, onDismiss }: RedirectModalProps) {
  const { isOpen, toolName, args } = config;

  // Convert the tool name and arguments into beautiful, human-readable labels
  const getToolTitle = () => {
    switch (toolName) {
      case 'open_youtube': return 'YOUTUBE_STREAM_LINK';
      case 'open_spotify': return 'SPOTIFY_AUDIO_BRIDGE';
      case 'send_whatsapp': return 'WHATSAPP_MESSAGE_UPLINK';
      case 'google_search': return 'GOOGLE_SEARCH_GROUNDING';
      default: return 'EXTERNAL_CORE_REDIRECT';
    }
  };

  const getRedirectUrl = () => {
    if (!args) return '#';
    switch (toolName) {
      case 'open_youtube':
        const ytQuery = args.search_query || '';
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`;
      case 'open_spotify':
        const spotQuery = args.track_name || '';
        return `https://open.spotify.com/search/${encodeURIComponent(spotQuery)}`;
      case 'send_whatsapp':
        const phone = args.phone_number || '';
        const text = args.message || '';
        if (phone) {
          return `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}`;
        }
        return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      case 'google_search':
        const q = args.query || '';
        return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      default:
        return '#';
    }
  };

  const url = getRedirectUrl();

  const handleOpenLink = () => {
    onConfirm(url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/70 backdrop-blur-sm">
          {/* Overlay dismissal */}
          <div className="absolute inset-0" onClick={onDismiss} />

          <motion.div
            id="redirect-modal-dialog"
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 20, stiffness: 150 }}
            className="relative w-full max-w-md bg-[#03070b] border-2 border-pink-500/35 rounded-lg shadow-[0_0_50px_rgba(236,72,153,0.15)] overflow-hidden font-mono text-left"
          >
            {/* Corner cyber ticks */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-pink-500" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-pink-500" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-pink-500" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-pink-500" />

            {/* Glowing top line */}
            <div className="h-1 bg-gradient-to-r from-pink-500 via-violet-600 to-pink-500" />

            {/* Content body */}
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start gap-4 mb-5">
                <div className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg text-pink-400">
                  <ShieldAlert size={24} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-widest text-pink-400 uppercase">
                    ALKA_QUANTUM_BRIDGE
                  </h3>
                  <p className="text-[10px] text-violet-400/60 font-semibold tracking-wider">
                    ESTABLISHING OUTBOUND WEB UPLINK
                  </p>
                </div>
              </div>

              {/* URL Description Card */}
              <div className="mb-6 space-y-3">
                <div className="p-3.5 bg-violet-950/20 border border-violet-500/20 rounded text-xs text-violet-200">
                  <div className="flex items-center gap-1.5 text-[10px] text-pink-400/80 font-bold mb-1.5">
                    <Link size={12} />
                    <span>{getToolTitle()}</span>
                  </div>
                  
                  {/* JSON arguments debugger */}
                  <pre className="mt-1 p-2 bg-[#03070b]/80 border border-violet-500/10 rounded text-[10px] leading-relaxed max-h-24 overflow-y-auto font-mono text-violet-300">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </div>

                <div className="text-[10px] text-violet-400/60 leading-relaxed text-center">
                  Notice: Standard sandbox security policies restrict automated third-party navigation inside framed contexts. Click manually to deploy.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  id="redirect-confirm-btn"
                  onClick={handleOpenLink}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 text-white rounded font-bold text-xs flex items-center justify-center gap-2 border border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.3)] hover:shadow-[0_0_25px_rgba(236,72,153,0.55)] transition-all cursor-pointer group"
                >
                  <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  <span>[ OPEN LINK NOW ]</span>
                </button>

                <button
                  id="redirect-dismiss-btn"
                  onClick={onDismiss}
                  className="py-3 px-4 bg-violet-950/20 hover:bg-violet-900/30 border border-violet-500/30 hover:border-violet-400 text-violet-300 rounded text-xs font-bold transition-colors cursor-pointer"
                >
                  DISMISS
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
