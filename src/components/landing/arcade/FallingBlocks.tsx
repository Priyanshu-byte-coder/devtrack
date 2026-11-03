"use client";

import { useEffect, useRef } from "react";

const CELL = 14;
const GAP = 3;
const MAX_STACK = 7;

/**
 * Decorative hero backdrop: contribution squares fall like Tetris pieces and
 * stack into a heatmap along the bottom, then clear and start again.
 *
 * A canvas, so it costs one draw per frame. It stops while scrolled out of
 * view or in a background tab, and draws a still heatmap instead when the
 * visitor prefers reduced motion.
 */
export default function FallingBlocks({
  className = "",
}: {
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const accent =
      getComputedStyle(canvas).getPropertyValue("--accent").trim() || "#6ba8ff";
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let cols = 0;
    let heights: number[] = [];
    let levels: number[][] = [];
    type Block = { col: number; y: number; speed: number; level: number };
    let falling: Block[] = [];
    let raf = 0;
    let running = false;
    let last = 0;
    let spawnIn = 0;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = Math.round(rect.width * dpr);
      canvas!.height = Math.round(rect.height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(1, Math.floor(rect.width / (CELL + GAP)));
      heights = Array(cols).fill(0);
      levels = Array.from({ length: cols }, () => []);
      falling = [];
      // Start part-built so the heatmap reads at once, not after a minute.
      for (let c = 0; c < cols; c++) {
        const h = Math.floor(Math.random() * 4);
        for (let i = 0; i < h; i++)
          levels[c].push(1 + Math.floor(Math.random() * 4));
        heights[c] = h;
      }
      if (reduce) {
        // A still heatmap for reduced motion.
        for (let c = 0; c < cols; c++) {
          levels[c] = [];
          const h = 1 + ((c * 7) % 5);
          for (let i = 0; i < h; i++) levels[c].push(1 + ((c + i) % 4));
          heights[c] = h;
        }
      }
    }

    function cellAlpha(level: number) {
      return [0.18, 0.35, 0.55, 0.8][level - 1] ?? 0.18;
    }

    function draw() {
      const rect = canvas!.getBoundingClientRect();
      ctx!.clearRect(0, 0, rect.width, rect.height);
      ctx!.fillStyle = accent;
      const bottom = rect.height;
      for (let c = 0; c < cols; c++) {
        const x = c * (CELL + GAP);
        levels[c].forEach((level, i) => {
          ctx!.globalAlpha = cellAlpha(level);
          ctx!.fillRect(x, bottom - (i + 1) * (CELL + GAP), CELL, CELL);
        });
      }
      for (const b of falling) {
        ctx!.globalAlpha = cellAlpha(b.level);
        ctx!.fillRect(b.col * (CELL + GAP), b.y, CELL, CELL);
      }
      ctx!.globalAlpha = 1;
    }

    function step(now: number) {
      const dt = Math.min(50, now - (last || now));
      last = now;
      const rect = canvas!.getBoundingClientRect();

      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = 70 + Math.random() * 150;
        const col = Math.floor(Math.random() * cols);
        falling.push({
          col,
          y: -CELL,
          speed: 0.12 + Math.random() * 0.12,
          level: 1 + Math.floor(Math.random() * 4),
        });
      }

      falling = falling.filter((b) => {
        b.y += b.speed * dt;
        const floor = rect.height - (heights[b.col] + 1) * (CELL + GAP);
        if (b.y >= floor) {
          levels[b.col].push(b.level);
          heights[b.col] += 1;
          return false;
        }
        return true;
      });

      // A full stack clears, like a completed line.
      for (let c = 0; c < cols; c++) {
        if (heights[c] > MAX_STACK) {
          heights[c] = 0;
          levels[c] = [];
        }
      }

      draw();
      if (running) raf = requestAnimationFrame(step);
    }

    function start() {
      if (running || reduce) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(step);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();
    draw();

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !document.hidden) start();
      else stop();
    });
    observer.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    const onResize = () => {
      resize();
      draw();
    };
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    />
  );
}
