"use client";
import { useEffect, useRef, useState } from "react";
import { useGestureDetection } from "@/hooks/useGestureDetection";
import type { GestureType } from "@/hooks/useGestureDetection";

// Fire particle
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

// Draw stroke point
interface Point {
  x: number;
  y: number;
  color: string;
}

const DRAW_COLORS = ["#a855f7", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#ffffff"];

export default function AirCanvas() {
  const { leftHand, rightHand, isReady, videoRef, canvasRef } = useGestureDetection();

  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const pointsRef = useRef<Point[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const colorIndexRef = useRef(0);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [currentColor, setCurrentColor] = useState(DRAW_COLORS[0]);
  const [activeGesture, setActiveGesture] = useState<GestureType>("none");

  useEffect(() => {
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;
    drawCanvas.width = window.innerWidth;
    drawCanvas.height = window.innerHeight;
  }, []);

  useEffect(() => {
    // Use right hand as drawing hand
    const hand = rightHand;
    const gesture = hand.gesture;
    setActiveGesture(gesture);

    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;

    const W = drawCanvas.width;
    const H = drawCanvas.height;

    // Map cursor to canvas
    const cx = hand.cursorX;
    const cy = hand.cursorY;

    if (gesture === "pointing") {
      // Draw trail
      if (lastPointRef.current) {
        pointsRef.current.push({ x: cx, y: cy, color: currentColor });
      }
      lastPointRef.current = { x: cx, y: cy };
    } else {
      lastPointRef.current = null;
    }

    if (gesture === "open_palm") {
      // Cycle color on open palm (debounce via ref)
      colorIndexRef.current = (colorIndexRef.current + 1) % DRAW_COLORS.length;
      setCurrentColor(DRAW_COLORS[colorIndexRef.current]);
    }

    if (gesture === "gun") {
      // Spawn fire particles at cursor position
      for (let i = 0; i < 8; i++) {
        particlesRef.current.push({
          x: cx,
          y: cy,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          life: 1,
          maxLife: 1,
          size: Math.random() * 20 + 10,
        });
      }

      // Erase points near cursor
      pointsRef.current = pointsRef.current.filter((p) => {
        const dist = Math.hypot(p.x - cx, p.y - cy);
        return dist > 60;
      });
    }
  }, [rightHand, currentColor]);

  // Animation loop
  useEffect(() => {
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;
    const ctx = drawCanvas.getContext("2d")!;

    function animate() {
      ctx.clearRect(0, 0, drawCanvas!.width, drawCanvas!.height);

      // Draw strokes
      const points = pointsRef.current;
      if (points.length > 1) {
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          // Only connect nearby points (avoid lines across canvas)
          const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
          if (dist < 80) {
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.strokeStyle = curr.color;
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.shadowColor = curr.color;
            ctx.shadowBlur = 10;
            ctx.stroke();
          }
        }
      }

      // Update and draw fire particles
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.2; // rise up
        p.life -= 0.03;

        const alpha = p.life;
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
        gradient.addColorStop(0.3, `rgba(255, 150, 0, ${alpha})`);
        gradient.addColorStop(0.7, `rgba(255, 50, 0, ${alpha * 0.8})`);
        gradient.addColorStop(1, `rgba(100, 0, 0, 0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.shadowColor = "#ff6600";
        ctx.shadowBlur = 20;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  return (
    <main className="w-screen h-screen bg-black overflow-hidden relative">

      {/* Webcam feed - full background */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)", opacity: 0.6 }}
        playsInline
        muted
      />

      {/* Hand skeleton overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Drawing canvas on top */}
      <canvas
        ref={drawCanvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* UI Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
        <div className="bg-black/70 rounded-2xl px-4 py-3 backdrop-blur">
          <p className="text-white text-xs uppercase tracking-widest mb-2">Gesture</p>
          <p className="text-xl font-bold" style={{ color: currentColor }}>
            {activeGesture === "pointing" && "✍️ Drawing"}
            {activeGesture === "gun" && "🔫 Fire Eraser!"}
            {activeGesture === "open_palm" && "🎨 Color Changed!"}
            {activeGesture === "fist" && "✊ Pen Up"}
            {activeGesture === "peace" && "✌️ Peace"}
            {activeGesture === "pinch" && "🤏 Pinch"}
            {activeGesture === "none" && "🤚 Show hand"}
          </p>
        </div>

        {/* Color palette */}
        <div className="bg-black/70 rounded-2xl px-4 py-3 backdrop-blur">
          <p className="text-white text-xs uppercase tracking-widest mb-2">Color</p>
          <div className="flex gap-2">
            {DRAW_COLORS.map((c, i) => (
              <div
                key={c}
                onClick={() => {
                  colorIndexRef.current = i;
                  setCurrentColor(c);
                }}
                className="w-6 h-6 rounded-full cursor-pointer border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: currentColor === c ? "#ffffff" : "transparent",
                  transform: currentColor === c ? "scale(1.3)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Clear button */}
        <button
          onClick={() => { pointsRef.current = []; }}
          className="bg-red-900/70 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-xl backdrop-blur transition-all"
        >
          🗑️ Clear All
        </button>
      </div>

      {/* Gesture Guide */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-black/70 rounded-2xl px-6 py-3 backdrop-blur flex gap-6 text-xs text-gray-400">
          <span>👆 Point → Draw</span>
          <span>✊ Fist → Stop</span>
          <span>🔫 Gun → Fire Erase</span>
          <span>🖐️ Palm → Change Color</span>
        </div>
      </div>

      {/* Status */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-black/70 rounded-full px-3 py-1 text-xs backdrop-blur">
          {isReady
            ? <span className="text-green-400">● Live</span>
            : <span className="text-yellow-400">⏳ Loading...</span>}
        </div>
      </div>
    </main>
  );
}