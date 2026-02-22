"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useGestureDetection } from "@/hooks/useGestureDetection";
import type { GestureType } from "@/hooks/useGestureDetection";
import { recognize } from "@/lib/recognizer";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

interface Point {
  x: number;
  y: number;
}

interface DrawnPoint extends Point {
  color: string;
}

const DRAW_COLORS = ["#ffffff", "#a855f7", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444"];

export default function AirCanvas() {
  const { rightHand, isReady, videoRef, canvasRef } = useGestureDetection();

  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const drawnPointsRef = useRef<DrawnPoint[]>([]);
  const currentStrokeRef = useRef<Point[]>([]); // raw stroke for recognition
  const particlesRef = useRef<Particle[]>([]);
  const colorIndexRef = useRef(0);
  const lastPointRef = useRef<Point | null>(null);
  const lastGestureRef = useRef<GestureType>("none");
  const colorCooldownRef = useRef(false);
  const gestureStableRef = useRef<GestureType>("none");
  const gestureCountRef = useRef(0);
  const fistCooldownRef = useRef(false);

  const [currentColor, setCurrentColor] = useState(DRAW_COLORS[0]);
  const [activeGesture, setActiveGesture] = useState<GestureType>("none");
  const [sentence, setSentence] = useState<string[]>([]);
  const [lastRecognized, setLastRecognized] = useState<string>("");
  const [recognizeFlash, setRecognizeFlash] = useState(false);
  const [gunActive, setGunActive] = useState(false);

  useEffect(() => {
    const dc = drawCanvasRef.current;
    if (!dc) return;
    dc.width = window.innerWidth;
    dc.height = window.innerHeight;
  }, []);

  // ─── Gesture handler ───────────────────────────────────────────
  useEffect(() => {
    const hand = rightHand;
    const gesture = hand.gesture;

    // Stabilize gesture — must hold 3 frames
    if (gesture === gestureStableRef.current) {
      gestureCountRef.current += 1;
    } else {
      gestureStableRef.current = gesture;
      gestureCountRef.current = 1;
    }
    if (gestureCountRef.current < 3) return;

    const stable = gestureStableRef.current;
    setActiveGesture(stable);

    const cx = hand.cursorX;
    const cy = hand.cursorY;

    // ✍️ POINTING → draw + record stroke
    if (stable === "pointing") {
      setGunActive(false);
      if (
        lastPointRef.current &&
        Math.hypot(cx - lastPointRef.current.x, cy - lastPointRef.current.y) < 100
      ) {
        drawnPointsRef.current.push({ x: cx, y: cy, color: currentColor });
        currentStrokeRef.current.push({ x: cx, y: cy });
      }
      lastPointRef.current = { x: cx, y: cy };
    } else {
      lastPointRef.current = null;
    }

    // ✊ FIST → recognize current stroke as letter/word
    if (stable === "fist" && lastGestureRef.current !== "fist" && !fistCooldownRef.current) {
      fistCooldownRef.current = true;
      setGunActive(false);

      const stroke = currentStrokeRef.current;
      if (stroke.length > 10) {
        const result = recognize(stroke);
        if (result && result.score > 0.4) {
          setLastRecognized(result.name);
          setSentence((prev) => [...prev, result.name]);
          setRecognizeFlash(true);
          setTimeout(() => setRecognizeFlash(false), 800);
        } else {
          setLastRecognized("?");
        }
      }

      // Clear current stroke after recognition
      currentStrokeRef.current = [];
      drawnPointsRef.current = [];

      setTimeout(() => { fistCooldownRef.current = false; }, 1000);
    }

    // 🖐️ OPEN PALM → cycle color
    if (stable === "open_palm" && lastGestureRef.current !== "open_palm" && !colorCooldownRef.current) {
      colorCooldownRef.current = true;
      setGunActive(false);
      const next = (colorIndexRef.current + 1) % DRAW_COLORS.length;
      colorIndexRef.current = next;
      setCurrentColor(DRAW_COLORS[next]);
      setTimeout(() => { colorCooldownRef.current = false; }, 1500);
    }

    // 🔫 GUN → fire erase
    if (stable === "gun") {
      setGunActive(true);
      for (let i = 0; i < 10; i++) {
        particlesRef.current.push({
          x: cx + (Math.random() - 0.5) * 20,
          y: cy + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 8,
          vy: -(Math.random() * 5 + 2),
          life: 1,
          size: Math.random() * 25 + 10,
        });
      }
      drawnPointsRef.current = drawnPointsRef.current.filter(
        (p) => Math.hypot(p.x - cx, p.y - cy) > 70
      );
      currentStrokeRef.current = currentStrokeRef.current.filter(
        (p) => Math.hypot(p.x - cx, p.y - cy) > 70
      );
    } else {
      setGunActive(false);
    }

    lastGestureRef.current = stable;
  }, [rightHand, currentColor]);

  // ─── Animation loop ────────────────────────────────────────────
  useEffect(() => {
    const dc = drawCanvasRef.current;
    if (!dc) return;
    const ctx = dc.getContext("2d")!;

    function animate() {
      ctx.clearRect(0, 0, dc!.width, dc!.height);

      // Draw strokes
      const pts = drawnPointsRef.current;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        if (Math.hypot(curr.x - prev.x, curr.y - prev.y) < 80) {
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.strokeStyle = curr.color;
          ctx.lineWidth = 5;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.shadowColor = curr.color;
          ctx.shadowBlur = 15;
          ctx.stroke();
        }
      }

      ctx.shadowBlur = 0;

      // Fire particles
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.vx *= 0.98;
        p.life -= 0.025;
        p.size *= 0.97;

        const a = Math.max(0, p.life);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, `rgba(255,255,200,${a})`);
        g.addColorStop(0.2, `rgba(255,200,0,${a})`);
        g.addColorStop(0.5, `rgba(255,80,0,${a * 0.9})`);
        g.addColorStop(0.8, `rgba(200,20,0,${a * 0.5})`);
        g.addColorStop(1, `rgba(50,0,0,0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.shadowColor = "#ff4400";
        ctx.shadowBlur = 25;
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      animFrameRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const clearAll = useCallback(() => {
    drawnPointsRef.current = [];
    currentStrokeRef.current = [];
    particlesRef.current = [];
    setSentence([]);
    setLastRecognized("");
  }, []);

  const deleteLast = useCallback(() => {
    setSentence((prev) => prev.slice(0, -1));
  }, []);

  const gestureLabel = () => {
    switch (activeGesture) {
      case "pointing": return { text: "✍️ Writing...", color: currentColor };
      case "fist": return { text: "✊ Recognizing!", color: "#22c55e" };
      case "gun": return { text: "🔫 Fire Erasing!", color: "#ff4400" };
      case "open_palm": return { text: "🎨 Color Changed!", color: currentColor };
      case "peace": return { text: "✌️ Peace", color: "#22c55e" };
      default: return { text: "🤚 Show right hand", color: "#6b7280" };
    }
  };

  const label = gestureLabel();
  const fullSentence = sentence.join(" ");

  return (
    <main className="w-screen h-screen bg-black overflow-hidden relative cursor-none">

      {/* Camera */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)", opacity: 0.5 }}
        playsInline
        muted
      />

      {/* Skeleton */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Drawing */}
      <canvas ref={drawCanvasRef} className="absolute inset-0 w-full h-full" />

      {/* Recognition flash */}
      {recognizeFlash && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="text-9xl font-black animate-ping opacity-60"
            style={{ color: currentColor }}>
            {lastRecognized}
          </div>
        </div>
      )}

      {/* Gun overlay */}
      {gunActive && (
        <div className="absolute inset-0 pointer-events-none z-10"
          style={{ background: "radial-gradient(circle at center, rgba(255,68,0,0.08) 0%, transparent 70%)" }}
        />
      )}

      {/* ── Left panel ── */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-3 w-56">

        {/* Gesture */}
        <div className="bg-black/70 rounded-2xl px-4 py-3 backdrop-blur-sm border border-white/10">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Right Hand</p>
          <p className="text-base font-bold transition-all" style={{ color: label.color }}>
            {label.text}
          </p>
        </div>

        {/* Last recognized */}
        {lastRecognized && (
          <div className="bg-black/70 rounded-2xl px-4 py-3 backdrop-blur-sm border border-white/10">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Recognized</p>
            <p className="text-4xl font-black" style={{ color: currentColor }}>
              {lastRecognized}
            </p>
          </div>
        )}

        {/* Color palette */}
        <div className="bg-black/70 rounded-2xl px-4 py-3 backdrop-blur-sm border border-white/10">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Ink Color</p>
          <div className="flex gap-2 flex-wrap">
            {DRAW_COLORS.map((c, i) => (
              <button
                key={c}
                onClick={() => { colorIndexRef.current = i; setCurrentColor(c); }}
                className="w-6 h-6 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: currentColor === c ? "#fff" : "transparent",
                  transform: currentColor === c ? "scale(1.3)" : "scale(1)",
                  boxShadow: currentColor === c ? `0 0 8px ${c}` : "none",
                }}
              />
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-2">🖐️ Palm to cycle</p>
        </div>

        {/* Buttons */}
        <button onClick={deleteLast}
          className="bg-yellow-950/80 hover:bg-yellow-700/80 border border-yellow-700 text-white text-xs px-4 py-2 rounded-xl backdrop-blur-sm transition-all">
          ← Delete Last
        </button>
        <button onClick={clearAll}
          className="bg-red-950/80 hover:bg-red-700/80 border border-red-700 text-white text-xs px-4 py-2 rounded-xl backdrop-blur-sm transition-all">
          🗑️ Clear All
        </button>
      </div>

      {/* ── Top right ── */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
        <div className="bg-black/70 rounded-full px-3 py-1 text-xs backdrop-blur-sm border border-white/10">
          {isReady
            ? <span className="text-green-400">● Live</span>
            : <span className="text-yellow-400">⏳ Loading...</span>}
        </div>
        <a href="/"
          className="bg-black/70 rounded-full px-3 py-1 text-xs text-gray-400 hover:text-white backdrop-blur-sm border border-white/10 transition-all">
          {"← Back"}
        </a>
      </div>

      {/* ── Sentence builder — bottom center ── */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 w-full max-w-3xl px-4">
        <div className="bg-black/80 rounded-2xl px-6 py-4 backdrop-blur-sm border border-white/10 min-h-16 flex items-center justify-center">
          {fullSentence ? (
            <p className="text-white text-2xl font-bold tracking-wider text-center">
              {fullSentence}
              <span className="animate-pulse text-gray-500 ml-1">|</span>
            </p>
          ) : (
            <p className="text-gray-600 text-sm">
              Write letters in air → ✊ Fist to recognize → builds sentence here
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom guide ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-black/70 rounded-2xl px-5 py-2 backdrop-blur-sm border border-white/10 flex gap-5 text-xs text-gray-400">
          <span>👆 <span className="text-white">Point</span> = Write</span>
          <span>✊ <span className="text-white">Fist</span> = Recognize</span>
          <span>🔫 <span className="text-white">Gun</span> = Erase</span>
          <span>🖐️ <span className="text-white">Palm</span> = Color</span>
        </div>
      </div>

    </main>
  );
}