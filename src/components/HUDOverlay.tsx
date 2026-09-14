import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Cpu, Wifi, Activity } from 'lucide-react';
import { LatencyStats } from '../types';

interface HUDOverlayProps {
  stats: LatencyStats;
}

export default function HUDOverlay({ stats }: HUDOverlayProps) {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate sci-fi micro-particles drifting in the background
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    size: Math.random() * 3 + 1,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * -10,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* 1. Technical Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #1e293b 1px, transparent 1px),
            linear-gradient(to bottom, #1e293b 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* 2. Cyberpunk Ambient Radial Glows */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-violet-600/10 blur-[120px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-pink-500/10 blur-[150px] translate-x-1/2 translate-y-1/2" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-500/[0.04] blur-[160px]" />

      {/* 3. Slow-Drifting Glowing Micro-Particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-violet-400/40 shadow-[0_0_8px_rgba(139,92,246,0.5)]"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            top: p.top,
          }}
          animate={{
            y: ['0px', '-100px', '0px'],
            x: ['0px', '50px', '0px'],
            opacity: [0.1, 0.8, 0.1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}

      {/* 4. Cinematic HUD Corner Brackets */}
      {/* Top Left */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-violet-500/30">
        <div className="absolute top-0 left-0 w-2 h-2 bg-violet-400/70" />
      </div>
      {/* Top Right */}
      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-violet-500/30">
        <div className="absolute top-0 right-0 w-2 h-2 bg-violet-400/70" />
      </div>
      {/* Bottom Left */}
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-violet-500/30">
        <div className="absolute bottom-0 left-0 w-2 h-2 bg-violet-400/70" />
      </div>
      {/* Bottom Right */}
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-violet-500/30">
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-violet-400/70" />
      </div>

      {/* 5. Left-Side Telemetry Panel */}
      <div className="absolute left-6 top-24 hidden md:flex flex-col gap-4 text-[10px] font-mono text-violet-400/60 leading-relaxed tracking-wider">
        <div className="flex items-center gap-2 border-l-2 border-violet-500/50 pl-2">
          <Cpu size={12} className="text-violet-400 animate-pulse" />
          <span>ALKA_CORE // V3.1_LIVE</span>
        </div>
        <div className="flex items-center gap-2 border-l-2 border-pink-500/50 pl-2">
          <Shield size={12} className="text-pink-400" />
          <span>SECURITY_HASH // SECURE_SSL</span>
        </div>
        <div className="flex items-center gap-2 border-l-2 border-teal-500/50 pl-2">
          <Wifi size={12} className="text-teal-400" />
          <span>UPLINK_STATUS // {stats.status}</span>
        </div>
        <div className="flex items-center gap-2 border-l-2 border-sky-500/50 pl-2">
          <Activity size={12} className="text-sky-400 animate-bounce" />
          <span>SENSORS // {stats.sensors}</span>
        </div>
      </div>

      {/* 6. Right-Side Telemetry Panel */}
      <div className="absolute right-6 top-24 hidden lg:flex flex-col gap-3 text-[10px] font-mono text-violet-400/60 tracking-widest text-right">
        <div>SYS_LATENCY // {stats.ping}</div>
        <div>SEC_NODE_PORT // 3000_PROX</div>
        <div>TIME_STAMP // {timeStr}</div>
        <div>CREATOR_LOC // GLOBAL_GRID</div>
        <div className="mt-4 flex flex-col gap-1 items-end opacity-40">
          <div className="w-24 h-[1px] bg-gradient-to-l from-violet-500 to-transparent" />
          <div className="w-16 h-[1px] bg-gradient-to-l from-pink-500 to-transparent" />
        </div>
      </div>
    </div>
  );
}
