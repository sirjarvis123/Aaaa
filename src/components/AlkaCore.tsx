import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AssistantState } from '../types';

interface AlkaCoreProps {
  state: AssistantState;
  onClick?: () => void;
}

export default function AlkaCore({ state, onClick }: AlkaCoreProps) {
  const [phase, setPhase] = useState(0);

  // Run a continuous wave phase loop
  useEffect(() => {
    let animFrameId: number;
    let lastTime = performance.now();

    const updatePhase = (time: number) => {
      // Speed up wave motion depending on assistant state
      let speed = 0.05;
      if (state === 'listening') speed = 0.12;
      if (state === 'processing') speed = 0.18;
      if (state === 'speaking') speed = 0.10;

      setPhase((prev) => (prev + speed) % (Math.PI * 2));
      animFrameId = requestAnimationFrame(updatePhase);
    };

    animFrameId = requestAnimationFrame(updatePhase);
    return () => cancelAnimationFrame(animFrameId);
  }, [state]);

  // Generate SVG path for a responsive organic sine wave
  const generateSinePath = (phaseOffset: number, width: number, height: number) => {
    const midY = height / 2;
    const points: string[] = [];

    let amp = 8;
    let freq = 0.05;
    let noiseFreq = 2.1;
    let noiseAmp = 0.3;

    if (state === 'idle') {
      amp = 6;
      freq = 0.04;
      noiseFreq = 1.5;
      noiseAmp = 0.2;
    } else if (state === 'listening') {
      amp = 20;
      freq = 0.08;
      noiseFreq = 2.5;
      noiseAmp = 0.4;
    } else if (state === 'processing') {
      amp = 8;
      freq = 0.18;
      noiseFreq = 3.2;
      noiseAmp = 0.1;
    } else if (state === 'speaking') {
      amp = 28;
      freq = 0.06;
      noiseFreq = 1.9;
      noiseAmp = 0.5;
    }

    for (let x = 0; x <= width; x += 3) {
      const angle = (x / width) * Math.PI * 4 * freq + phase + phaseOffset;
      // Add a secondary harmonic for organic fluctuation
      const sineVal = Math.sin(angle);
      const harmonicVal = Math.cos(angle * noiseFreq) * noiseAmp;
      
      // Apply a Gaussian-like bell curve envelop so the ends of the wave taper off nicely
      const distanceToCenter = Math.abs(x - width / 2) / (width / 2);
      const envelope = Math.max(0, 1 - Math.pow(distanceToCenter, 2));

      const y = midY + (sineVal + harmonicVal) * amp * envelope;
      points.push(`${x},${y}`);
    }

    return `M ${points.join(' L ')}`;
  };

  // Color mapping based on assistant state
  const getThemeColor = (opacity: number = 1) => {
    switch (state) {
      case 'idle':
        return `rgba(20, 184, 166, ${opacity})`; // Teal (#14b8a6)
      case 'listening':
        return `rgba(139, 92, 246, ${opacity})`; // Violet (#8b5cf6)
      case 'processing':
        return `rgba(56, 189, 248, ${opacity})`; // Sky-blue (#38bdf8)
      case 'speaking':
        return `rgba(236, 72, 153, ${opacity})`; // Hot-pink (#ec4899)
    }
  };

  const getThemeHex = () => {
    switch (state) {
      case 'idle': return '#14b8a6';
      case 'listening': return '#8b5cf6';
      case 'processing': return '#38bdf8';
      case 'speaking': return '#ec4899';
    }
  };

  // Rotation speeds based on state
  const getRotationSpeed = (baseSpeed: number) => {
    if (state === 'processing') return baseSpeed * 0.4; // Double speed
    if (state === 'listening') return baseSpeed * 0.7;
    return baseSpeed;
  };

  return (
    <div className="relative flex items-center justify-center w-[340px] h-[340px] md:w-[400px] md:h-[400px]">
      {/* ========================================== */}
      {/* 5 CONCENTRIC CYBERNETIC RINGS (OUTERMOST TO INNER) */}
      {/* ========================================== */}

      {/* RING 5 (Outermost Grid Circle) */}
      <motion.div
        className="absolute inset-0 rounded-full border border-dashed border-violet-500/10"
        animate={{
          rotate: -360,
          scale: state === 'speaking' ? [1, 1.05, 1] : 1,
        }}
        transition={{
          rotate: { duration: getRotationSpeed(40), repeat: Infinity, ease: 'linear' },
          scale: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
        }}
      />

      {/* RING 4 (Segmented Arc Scanner) */}
      <motion.div
        className="absolute inset-4 rounded-full border-2 border-transparent border-t-pink-500/20 border-b-violet-500/20"
        animate={{
          rotate: 360,
          scale: state === 'listening' ? [1, 1.03, 1] : 1,
        }}
        transition={{
          rotate: { duration: getRotationSpeed(25), repeat: Infinity, ease: 'linear' },
          scale: { duration: 1, repeat: Infinity, ease: 'easeInOut' },
        }}
      />

      {/* RING 3 (Solid Circle with tick intervals) */}
      <motion.div
        className="absolute inset-10 rounded-full border border-violet-500/20 flex items-center justify-center"
        animate={{ rotate: -360 }}
        transition={{ duration: getRotationSpeed(35), repeat: Infinity, ease: 'linear' }}
      >
        {/* Render simple tech tick notches along the ring */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <div
            key={angle}
            className="absolute w-1 h-2 bg-pink-500/30"
            style={{
              transform: `rotate(${angle}deg) translateY(-145px)`,
            }}
          />
        ))}
      </motion.div>

      {/* RING 2 (Notched Orbital Ring) */}
      <motion.div
        className="absolute inset-16 rounded-full border border-dashed border-teal-500/20"
        style={{ borderWidth: '2px' }}
        animate={{ rotate: 360 }}
        transition={{ duration: getRotationSpeed(15), repeat: Infinity, ease: 'linear' }}
      />

      {/* RING 1 (Innermost Dash Circle) */}
      <motion.div
        className="absolute inset-24 rounded-full border border-dotted border-violet-500/40"
        style={{ borderWidth: '3px' }}
        animate={{ rotate: -360 }}
        transition={{ duration: getRotationSpeed(10), repeat: Infinity, ease: 'linear' }}
      />

      {/* ========================================== */}
      {/* CENTRAL CORE (Glassmorphic Button) */}
      {/* ========================================== */}
      <motion.button
        id="alka-core-button"
        onClick={onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="absolute inset-28 rounded-full flex flex-col items-center justify-center cursor-pointer overflow-hidden z-10 select-none group"
        style={{
          background: 'rgba(3, 7, 11, 0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1.5px solid ${getThemeColor(0.25)}`,
          boxShadow: `
            0 0 30px ${getThemeColor(0.12)},
            inset 0 0 15px ${getThemeColor(0.08)}
          `,
        }}
      >
        {/* Core Glowing Orb Background */}
        <div 
          className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-500 rounded-full blur-xl"
          style={{
            background: `radial-gradient(circle, ${getThemeColor(0.5)} 0%, transparent 70%)`
          }}
        />

        {/* Dual Overlapping Organic Waveforms */}
        <div className="absolute inset-x-4 h-24 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
          <svg width="200" height="100" viewBox="0 0 200 100" className="w-full h-full opacity-80">
            {/* Wave 1 */}
            <path
              d={generateSinePath(0, 200, 100)}
              fill="none"
              stroke={getThemeHex()}
              strokeWidth="2"
              className="transition-all duration-300"
            />
            {/* Wave 2 */}
            <path
              d={generateSinePath(Math.PI * 0.8, 200, 100)}
              fill="none"
              stroke={state === 'idle' ? '#ec4899' : '#14b8a6'}
              strokeWidth="1.5"
              strokeDasharray="4 2"
              className="opacity-60 transition-all duration-300"
            />
          </svg>
        </div>

        {/* HUD Text labels in center */}
        <div className="z-10 flex flex-col items-center gap-1">
          {/* Neon Title */}
          <span 
            className="text-2xl md:text-3xl font-sans font-bold tracking-[0.3em] uppercase select-none transition-all duration-300 ml-[0.3em]"
            style={{
              color: '#ffffff',
              textShadow: `0 0 12px ${getThemeColor(0.8)}, 0 0 20px ${getThemeColor(0.3)}`,
            }}
          >
            ALKA
          </span>

          {/* Subtitle / watermark */}
          <span className="text-[7px] md:text-[8px] font-mono tracking-[0.2em] text-violet-400/40 uppercase font-medium select-none group-hover:text-violet-300/60 transition-colors">
            ONLINE FOR SIR
          </span>
        </div>

        {/* Scanning beam effect inside the glass */}
        <motion.div
          className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      </motion.button>
    </div>
  );
}
