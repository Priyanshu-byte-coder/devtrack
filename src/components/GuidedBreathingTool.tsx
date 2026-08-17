"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

type Phase = "idle" | "inhale" | "hold-in" | "exhale" | "hold-out";

interface BreathingConfig {
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
}

const CONFIG: BreathingConfig = {
  inhale: 4000,
  holdIn: 4000,
  exhale: 4000,
  holdOut: 4000,
};

export default function GuidedBreathingTool() {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<number>(0);

  const phaseRef = useRef<Phase>("idle");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const runAnimation = useCallback((duration: number) => {
    startTimeRef.current = performance.now();
    
    const animate = (time: number) => {
      const elapsed = time - startTimeRef.current;
      const currentProgress = Math.min(Math.max(elapsed / duration, 0), 1);
      setProgress(currentProgress);
      
      if (currentProgress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const runPhase = useCallback((currentPhase: Phase) => {
    setPhase(currentPhase);
    phaseRef.current = currentPhase;
    
    let duration = 0;
    let nextPhase: Phase = "idle";

    switch (currentPhase) {
      case "inhale":
        duration = CONFIG.inhale;
        nextPhase = "hold-in";
        break;
      case "hold-in":
        duration = CONFIG.holdIn;
        nextPhase = "exhale";
        break;
      case "exhale":
        duration = CONFIG.exhale;
        nextPhase = "hold-out";
        break;
      case "hold-out":
        duration = CONFIG.holdOut;
        nextPhase = "inhale";
        break;
      default:
        return;
    }

    runAnimation(duration);

    timerRef.current = setTimeout(() => {
      if (isActive) {
        runPhase(nextPhase);
      }
    }, duration);
  }, [isActive, runAnimation]);

  useEffect(() => {
    if (isActive) {
      runPhase("inhale");
    } else {
      clearAllTimers();
      setPhase("idle");
      setProgress(0);
      phaseRef.current = "idle";
    }

    return () => {
      clearAllTimers();
    };
  }, [isActive, runPhase, clearAllTimers]);

  const toggleActive = () => setIsActive(!isActive);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleActive();
    }
  };

  const getInstruction = () => {
    switch (phase) {
      case "inhale": return "Breathe In...";
      case "hold-in": return "Hold...";
      case "exhale": return "Breathe Out...";
      case "hold-out": return "Hold...";
      default: return "Ready to relax?";
    }
  };

  // Calculate scaling for CSS
  let scale = 1;
  if (phase === "inhale") scale = 1 + progress * 0.5;
  if (phase === "hold-in") scale = 1.5;
  if (phase === "exhale") scale = 1.5 - progress * 0.5;
  if (phase === "hold-out" || phase === "idle") scale = 1;

  return (
    <div 
      className="flex flex-col items-center justify-center p-6 w-full md:w-3/4 lg:w-1/2 mx-auto bg-[var(--card)] rounded-2xl shadow-lg border border-[var(--border)]"
      role="region"
      aria-label="Guided Breathing Tool"
    >
      <h2 className="text-xl font-bold mb-6 text-[var(--foreground)]">Guided Breathing</h2>
      
      <div 
        className="relative flex items-center justify-center w-48 h-48 md:w-64 md:h-64 mb-8"
        aria-hidden="true"
      >
        <div 
          className="absolute rounded-full bg-[var(--accent)] opacity-20 transition-transform duration-75"
          style={{ 
            width: '100%', 
            height: '100%',
            transform: `scale(${scale})` 
          }}
        />
        <div 
          className="absolute rounded-full bg-[var(--accent)] opacity-40 transition-transform duration-75"
          style={{ 
            width: '80%', 
            height: '80%',
            transform: `scale(${scale})` 
          }}
        />
        <div className="z-10 text-center">
          <p 
            className="text-lg md:text-2xl font-semibold text-[var(--accent-foreground)]"
            role="timer"
            aria-live="polite"
          >
            {getInstruction()}
          </p>
        </div>
      </div>

      <button
        onClick={toggleActive}
        onKeyDown={handleKeyDown}
        className="px-8 py-3 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] font-medium hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-[var(--ring)] transition-all"
        aria-pressed={isActive}
        aria-label={isActive ? "Stop breathing exercise" : "Start breathing exercise"}
      >
        {isActive ? "Stop" : "Start"}
      </button>
    </div>
  );
}
