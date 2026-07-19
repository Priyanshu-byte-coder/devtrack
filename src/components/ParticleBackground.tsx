"use client";

import { useEffect, useRef } from "react";

interface Particle3D {
  x: number; // Local 3D X
  y: number; // Local 3D Y
  z: number; // Local 3D Z
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  alpha: number;
  life: number;
}

interface TwinkleStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  phase: number;
  speed: number;
  color: string;
}

interface CursorSparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  color: string;
}

interface TechCrosshair {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
  speed: number;
  phase: number;
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    let animationId: number;
    let particles: Particle3D[] = [];
    let shootingStars: ShootingStar[] = [];
    let twinkleStars: TwinkleStar[] = [];
    let cursorSparkles: CursorSparkle[] = [];
    let techCrosshairs: TechCrosshair[] = [];
    let mouse = { x: -9999, y: -9999 };

    // 3D Gesture States (Orbit Camera Controls)
    let isDragging = false;
    let lastMousePos = { x: 0, y: 0 };
    let rotationX = 0.25; // initial tilt angle
    let rotationY = 0.45; // initial orbit angle
    let targetRotationX = 0.25;
    let targetRotationY = 0.45;
    let zoom = 1.0;
    let targetZoom = 1.0;
    
    let scopeRotation = 0;

    // Window gesture event handlers
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Exclude interactive elements so clicking them does not trigger rotation
      if (target.closest("a, button, [role='button'], input, textarea, .lnd-cta-primary, .lnd-cta-secondary")) {
        return;
      }
      isDragging = true;
      lastMousePos.x = e.clientX;
      lastMousePos.y = e.clientY;
    };

    const handleMouseMoveWindow = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      
      targetRotationY += dx * 0.0035; // orbit
      targetRotationX += dy * 0.0035; // tilt
      
      // Limit vertical tilt to avoid camera flipping
      targetRotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, targetRotationX));

      lastMousePos.x = e.clientX;
      lastMousePos.y = e.clientY;
    };

    const handleMouseUpWindow = () => {
      isDragging = false;
    };

    const handleWheelWindow = (e: WheelEvent) => {
      // Zoom factor adjustment (smooth delta interpolation)
      targetZoom = Math.max(0.45, Math.min(2.0, targetZoom + e.deltaY * -0.0006));
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;

      // Spawn subtle electric blue sparks on cursor hover
      const colors = ["#00f0ff", "#00b8ff", "#818cf8", "#22d3ee", "#ffffff"];
      for (let i = 0; i < 2; i++) {
        cursorSparkles.push({
          x: e.clientX,
          y: e.clientY,
          vx: (Math.random() - 0.5) * 2.2,
          vy: (Math.random() - 0.5) * 2.2 - 0.2,
          size: Math.random() * 2.5 + 1.2,
          alpha: 0.85,
          life: 1.0,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    const handleMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const handleClick = (e: MouseEvent) => {
      const cx = e.clientX;
      const cy = e.clientY;
      // Burst effect on click
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const speed = Math.random() * 3.5 + 1.5;
        cursorSparkles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 2.8 + 1.2,
          alpha: 0.9,
          life: 1.0,
          color: "#00f0ff",
        });
      }
    };

    // Attach global gesture events to window
    window.addEventListener("mousedown", handleMouseDown, { passive: true });
    window.addEventListener("mousemove", handleMouseMoveWindow, { passive: true });
    window.addEventListener("mouseup", handleMouseUpWindow, { passive: true });
    window.addEventListener("wheel", handleWheelWindow, { passive: true });

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave, { passive: true });
    window.addEventListener("click", handleClick);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createShootingStar = (): ShootingStar => ({
      x: Math.random() * canvas.width * 0.7,
      y: Math.random() * canvas.height * 0.35,
      vx: Math.random() * 7 + 4,
      vy: Math.random() * 3 + 1.5,
      length: Math.random() * 80 + 50,
      alpha: 0.7,
      life: 1,
    });

    const init = () => {
      resize();
      
      // Initialize 3D Constellation particles — higher count for visible network
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 12000), 90);
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          // Setup initial coords relative to center
          x: (Math.random() - 0.5) * canvas.width * 0.9,
          y: (Math.random() - 0.5) * canvas.height * 0.9,
          z: (Math.random() - 0.5) * 500,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          vz: (Math.random() - 0.5) * 0.35,
          radius: Math.random() * 2.2 + 1.4,
          alpha: Math.random() * 0.35 + 0.45,
          baseAlpha: Math.random() * 0.35 + 0.45,
        });
      }

      // Initialize background stars
      const starCount = Math.min(Math.floor((canvas.width * canvas.height) / 26000), 40);
      twinkleStars = Array.from({ length: starCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.2 + 0.5,
        alpha: Math.random(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.01 + Math.random() * 0.018,
        color: "hsl(190, 100%, 94%)",
      }));

      // Technical target crosshairs
      const crosshairCount = 18;
      techCrosshairs = [];
      for (let i = 0; i < crosshairCount; i++) {
        techCrosshairs.push({
          x: (Math.random() - 0.5) * canvas.width * 0.85,
          y: (Math.random() - 0.5) * canvas.height * 0.85,
          z: (Math.random() - 0.5) * 500,
          size: Math.random() * 3.5 + 3.0,
          alpha: Math.random() * 0.22 + 0.08,
          speed: 0.006 + Math.random() * 0.01,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const perspective = 800; // 3D Focal perspective depth

    const animate = () => {
      // Full clear each frame for crisp rendering (no ghosting)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      scopeRotation += 1;

      // Draw soft cinematic radial backlights
      const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, canvas.width * 0.55);
      g1.addColorStop(0, "rgba(0, 240, 255, 0.045)");
      g1.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const g2 = ctx.createRadialGradient(canvas.width, canvas.height * 0.45, 0, canvas.width, canvas.height * 0.45, canvas.width * 0.45);
      g2.addColorStop(0, "rgba(129, 140, 248, 0.035)");
      g2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Smooth interpolation for 3D gesture camera inputs (Lerp)
      rotationX += (targetRotationX - rotationX) * 0.07;
      rotationY += (targetRotationY - rotationY) * 0.07;
      zoom += (targetZoom - zoom) * 0.07;

      // Slowly auto-rotate constellation when not dragging
      if (!isDragging) {
        targetRotationY += 0.00045; // passive revolving drift
      }

      const cosY = Math.cos(rotationY), sinY = Math.sin(rotationY);
      const cosX = Math.cos(rotationX), sinX = Math.sin(rotationX);

      // 1. Twinkling Background Stars
      twinkleStars.forEach((star) => {
        star.phase += star.speed;
        star.alpha = 0.18 + Math.sin(star.phase) * 0.3;

        ctx.save();
        ctx.globalAlpha = star.alpha;
        ctx.strokeStyle = star.color;
        ctx.lineWidth = 0.5;
        
        ctx.beginPath();
        ctx.moveTo(star.x, star.y - star.size * 1.5);
        ctx.lineTo(star.x, star.y + star.size * 1.5);
        ctx.moveTo(star.x - star.size * 1.5, star.y);
        ctx.lineTo(star.x + star.size * 1.5, star.y);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 2. Rotate and Draw 3D Dashed HUD Scope Rings (Very low opacity)
      const rings = [
        { radius: 180, dashes: 32, speed: 0.45, color: "rgba(0, 240, 255, 0.12)", glowOpacity: 0.04 },
        { radius: 300, dashes: 48, speed: -0.25, color: "rgba(129, 140, 248, 0.08)", glowOpacity: 0.03 },
        { radius: 450, dashes: 64, speed: 0.12, color: "rgba(0, 240, 255, 0.06)", glowOpacity: 0.02 }
      ];

      rings.forEach((ring, ringIdx) => {
        const segments = 120;
        let first = true;
        ctx.save();
        
        const opacityScale = Math.min(1.0, zoom);
        
        // Pass A: Outer Neon Glow (faint)
        ctx.strokeStyle = `rgba(0, 240, 255, ${ring.glowOpacity * opacityScale})`;
        ctx.lineWidth = (ringIdx === 1 ? 3.0 : 2.0) * zoom;
        
        ctx.beginPath();
        const rotAngle = ringIdx * 0.8 + scopeRotation * ring.speed * 0.015;
        
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2 + rotAngle;
          const lx = ring.radius * Math.cos(angle);
          const ly = ring.radius * Math.sin(angle);
          const lz = 0;
          
          const rx1 = lx * cosY - lz * sinY;
          const rz1 = lz * cosY + lx * sinY;
          const ry2 = ly * cosX - rz1 * sinX;
          const rz2 = rz1 * cosX + ly * sinX;

          const zoomedX = rx1 * zoom;
          const zoomedY = ry2 * zoom;
          const zoomedZ = rz2 * zoom;
          
          const scale = perspective / (perspective + zoomedZ);
          const sx = cx + zoomedX * scale;
          const sy = cy + zoomedY * scale;
          
          const dashSegments = Math.floor(segments / ring.dashes);
          const isDraw = (i % (dashSegments * 2)) < dashSegments;
          
          if (isDraw) {
            if (first) {
              ctx.moveTo(sx, sy);
              first = false;
            } else {
              ctx.lineTo(sx, sy);
            }
          } else {
            first = true;
          }
        }
        ctx.stroke();

        // Pass B: Inner Core
        first = true;
        ctx.strokeStyle = ring.color.replace(/[\d.]+\)$/, `${0.35 * opacityScale})`);
        ctx.lineWidth = (ringIdx === 1 ? 1.2 : 0.75) * zoom;
        
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2 + rotAngle;
          const lx = ring.radius * Math.cos(angle);
          const ly = ring.radius * Math.sin(angle);
          const lz = 0;
          
          const rx1 = lx * cosY - lz * sinY;
          const rz1 = lz * cosY + lx * sinY;
          const ry2 = ly * cosX - rz1 * sinX;
          const rz2 = rz1 * cosX + ly * sinX;

          const zoomedX = rx1 * zoom;
          const zoomedY = ry2 * zoom;
          const zoomedZ = rz2 * zoom;
          
          const scale = perspective / (perspective + zoomedZ);
          const sx = cx + zoomedX * scale;
          const sy = cy + zoomedY * scale;
          
          const dashSegments = Math.floor(segments / ring.dashes);
          const isDraw = (i % (dashSegments * 2)) < dashSegments;
          
          if (isDraw) {
            if (first) {
              ctx.moveTo(sx, sy);
              first = false;
            } else {
              ctx.lineTo(sx, sy);
            }
          } else {
            first = true;
          }
        }
        ctx.stroke();
        ctx.restore();
      });

      // 3. Rotate and Draw 3D Technical target crosshairs (+) (very low opacity)
      techCrosshairs.forEach((tc) => {
        // Rotate local coordinates
        const ryX = tc.x * cosY - tc.z * sinY;
        const ryZ = tc.z * cosY + tc.x * sinY;
        const rxY = tc.y * cosX - ryZ * sinX;
        const rxZ = ryZ * cosX + tc.y * sinX;

        const zoomedX = ryX * zoom;
        const zoomedY = rxY * zoom;
        const zoomedZ = rxZ * zoom;

        // Apply slight alpha wave
        tc.phase += tc.speed;
        const baseAlpha = 0.08 + Math.sin(tc.phase) * 0.04;

        const scale = perspective / (perspective + zoomedZ);
        const sx = cx + zoomedX * scale;
        const sy = cy + zoomedY * scale;
        
        const alpha = baseAlpha * scale * Math.min(1.0, zoom);

        ctx.save();
        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.75})`;
        ctx.lineWidth = 0.55;
        
        ctx.beginPath();
        ctx.moveTo(sx - tc.size * scale * 0.7, sy);
        ctx.lineTo(sx + tc.size * scale * 0.7, sy);
        ctx.moveTo(sx, sy - tc.size * scale * 0.7);
        ctx.lineTo(sx, sy + tc.size * scale * 0.7);
        ctx.stroke();
        ctx.restore();
      });

      // Update particle local positions and project to 3D orbit system
      const projected = particles.map((p) => {
        // Drift in local space
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Keep inside 3D local boundaries
        const bound = 420;
        if (Math.abs(p.x) > bound) p.vx *= -1;
        if (Math.abs(p.y) > bound) p.vy *= -1;
        if (Math.abs(p.z) > bound) p.vz *= -1;

        // Rotate local coordinate Copy to preserve physics stability
        const ryX = p.x * cosY - p.z * sinY;
        const ryZ = p.z * cosY + p.x * sinY;
        
        const rxY = p.y * cosX - ryZ * sinX;
        const rxZ = ryZ * cosX + p.y * sinX;

        // Apply scale zoom
        const zoomedX = ryX * zoom;
        const zoomedY = rxY * zoom;
        const zoomedZ = rxZ * zoom;

        const scale = perspective / (perspective + zoomedZ);
        const sx = cx + zoomedX * scale;
        const sy = cy + zoomedY * scale;

        return { p, sx, sy, scale, rxZ: zoomedZ };
      });

      // 4. Draw 3D Web Connections — BRIGHT visible lines matching reference
      const connectionDist3D = 260;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].p.x - projected[j].p.x;
          const dy = projected[i].p.y - projected[j].p.y;
          const dz = projected[i].p.z - projected[j].p.z;
          const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist3D < connectionDist3D) {
            ctx.beginPath();
            ctx.moveTo(projected[i].sx, projected[i].sy);
            ctx.lineTo(projected[j].sx, projected[j].sy);
            
            const scaleAvg = (projected[i].scale + projected[j].scale) / 2;
            
            // Brighter line opacity for visible constellation web
            const opacity = (1 - dist3D / connectionDist3D) * 0.55 * scaleAvg * Math.min(1.0, zoom);
            
            ctx.strokeStyle = `rgba(0, 210, 220, ${opacity})`;
            ctx.lineWidth = 0.8 * scaleAvg;
            ctx.stroke();
          }
        }
      }

      // 5. Draw Constellation Web Nodes — BRIGHT glowing dots matching reference
      projected.forEach(({ p, sx, sy, scale }) => {
        const radius = p.radius * scale;
        
        // Bright visible alpha values
        const alpha = p.alpha * scale * 0.85 * Math.min(1.0, zoom);

        ctx.save();
        // Outer glow halo
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 6);
        g.addColorStop(0, `rgba(0, 210, 220, ${alpha * 0.7})`);
        g.addColorStop(0.3, `rgba(0, 210, 220, ${alpha * 0.25})`);
        g.addColorStop(1, "rgba(0, 0, 0, 0)");
        
        ctx.beginPath();
        ctx.arc(sx, sy, radius * 6, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        // Inner solid node core — bright cyan/teal dot
        ctx.fillStyle = `rgba(0, 230, 230, ${Math.min(1, alpha * 2.5)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius * 1.1, 0, Math.PI * 2);
        ctx.fill();

        // Bright white center point
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha * 1.8)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 6. Cursor Sparkles (Slightly larger, dynamic sparks)
      cursorSparkles = cursorSparkles.filter((p) => p.life > 0);
      cursorSparkles.forEach((p) => {
        p.life -= 0.024;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.vy -= 0.01;

        const size = Math.max(0, p.size * p.life);
        const alpha = Math.max(0, p.life);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.75;
        
        ctx.beginPath();
        ctx.moveTo(p.x - size, p.y);
        ctx.lineTo(p.x + size, p.y);
        ctx.moveTo(p.x, p.y - size);
        ctx.lineTo(p.x, p.y + size);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 7. Shooting Stars
      if (Math.random() < 0.005) shootingStars.push(createShootingStar());
      shootingStars = shootingStars.filter((s) => s.alpha > 0);
      shootingStars.forEach((s) => {
        s.life -= 0.015;
        s.alpha = s.life;
        s.x += s.vx;
        s.y += s.vy;
        const tailX = s.x - s.length * 0.7;
        const tailY = s.y - s.length * 0.35;
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${s.alpha * 0.45})`);
        grad.addColorStop(0.3, `rgba(0, 240, 255, ${s.alpha * 0.3})`);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      });

      animationId = requestAnimationFrame(animate);
    };

    init();
    animate();

    const handleResize = () => init();
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMoveWindow);
      window.removeEventListener("mouseup", handleMouseUpWindow);
      window.removeEventListener("wheel", handleWheelWindow);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0, background: "#050505" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      />
      {/* Cinematic Film Grain Overlay */}
      <div 
        className="absolute inset-0 w-full h-full opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
