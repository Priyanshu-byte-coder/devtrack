"use client";

import { useEffect, useState, useRef } from "react";

export default function CustomCursor() {
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isHidden, setIsHidden] = useState(true);

  // Target mouse coordinates
  const mouseRef = useRef({ x: -100, y: -100 });
  
  // Interpolated ring coordinates
  const ringRef = useRef({ x: -100, y: -100 });

  // Debounce resize timeout
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dotDomRef = useRef<HTMLDivElement>(null);
  const ringDomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    if (window.matchMedia("(pointer: coarse)").matches) {
      setIsHidden(true);
      return;
    }
    document.documentElement.style.cursor = "none";

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      setIsHidden(false);
    };

    const onMouseLeave = () => {
      setIsHidden(true);
    };

    const onMouseEnter = () => {
      setIsHidden(false);
    };

    // Check if user is hovering over interactive components
    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.closest("a") ||
          target.closest("button") ||
          target.closest(".lnd-cell") ||
          target.closest(".lnd-cta-primary") ||
          target.closest(".lnd-cta-secondary") ||
          target.closest(".lnd-nav-link") ||
          target.style.cursor === "pointer")
      ) {
        setIsHovered(true);
      } else {
        setIsHovered(false);
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseleave", onMouseLeave, { passive: true });
    window.addEventListener("mouseenter", onMouseEnter, { passive: true });
    window.addEventListener("mouseover", onMouseOver, { passive: true });

    let rafId: number;

    const render = () => {
      const targetX = mouseRef.current.x;
      const targetY = mouseRef.current.y;

      // Solid central core dot follows exactly
      if (dotDomRef.current) {
        dotDomRef.current.style.transform = `translate3d(${targetX - 4}px, ${targetY - 4}px, 0)`;
      }

      // Smooth lag-interpolation (lerp) for the outer concentric ring
      const rx = ringRef.current.x;
      const ry = ringRef.current.y;
      
      const nextRx = rx + (targetX - rx) * 0.15;
      const nextRy = ry + (targetY - ry) * 0.15;

      ringRef.current.x = nextRx;
      ringRef.current.y = nextRy;

      if (ringDomRef.current) {
        // Offset by -16px to align center (32px wide)
        ringDomRef.current.style.transform = `translate3d(${nextRx - 16}px, ${nextRy - 16}px, 0)`;
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        if (window.matchMedia("(pointer: coarse)").matches) {
          document.documentElement.style.cursor = "";
          setIsHidden(true);
        } else {
          document.documentElement.style.cursor = "none";
        }
      }, 150);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      document.documentElement.style.cursor = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mouseenter", onMouseEnter);
      window.removeEventListener("mouseover", onMouseOver);
      window.removeEventListener("resize", handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      cancelAnimationFrame(rafId);
    };
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* 1. Glowing Cyan Dot Core */}
      <div
        ref={dotDomRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: "#00f0ff",
          pointerEvents: "none",
          zIndex: 99999,
          opacity: isHidden ? 0 : 1,
          transform: "translate3d(-100px, -100px, 0)",
          boxShadow: "0 0 10px #00f0ff, 0 0 20px #00f0ff",
          transition: "opacity 0.25s ease-out, width 0.2s, height 0.2s, background-color 0.2s",
          ...(isHovered && {
            width: 5,
            height: 5,
            backgroundColor: "#ffffff",
            boxShadow: "0 0 8px #ffffff",
          }),
        }}
      />

      {/* 2. Concentric spring outer ring */}
      <div
        ref={ringDomRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 32,
          height: 32,
          borderRadius: "50%",
          borderWidth: "1.5px",
          borderStyle: "solid",
          borderColor: "#00f0ff",
          pointerEvents: "none",
          zIndex: 99997, // just below the dot
          opacity: isHidden ? 0 : 0.85,
          transform: "translate3d(-100px, -100px, 0)",
          boxShadow: "0 0 8px rgba(0, 240, 255, 0.4)",
          transition: "opacity 0.25s ease-out, border-color 0.2s, width 0.25s, height 0.25s, box-shadow 0.25s, margin 0.25s",
          ...(isHovered && {
            width: 48,
            height: 48,
            borderColor: "#ffffff",
            boxShadow: "0 0 16px rgba(255, 255, 255, 0.55)",
            marginLeft: -8, // offsets the larger width (48px vs 32px -> 16px diff -> 8px margin shift)
            marginTop: -8,
          }),
        }}
      />
    </>
  );
}
