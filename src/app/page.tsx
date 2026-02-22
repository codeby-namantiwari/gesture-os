"use client";
import { useGestureDetection } from "@/hooks/useGestureDetection";
import type { GestureType } from "@/hooks/useGestureDetection";

const gestureEmoji: Record<GestureType, string> = {
  open_palm: "🖐️ Open Palm",
  fist: "✊ Fist",
  pointing: "👆 Pointing",
  pinch: "🤏 Pinch",
  peace: "✌️ Peace",
  gun: "🔫 Gun",
  none: "—",
};

export default function Home() {
  const { leftHand, rightHand, isReady, videoRef, canvasRef } =
    useGestureDetection();

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <h1 className="text-5xl font-bold mb-1 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
        GestureOS
      </h1>
      <p className="text-gray-500 mb-8 text-sm tracking-wide">
        Dual hand tracking — Sign Language Ready 🤟
      </p>

      <div className="flex flex-col lg:flex-row gap-8 items-start w-full max-w-5xl">

        {/* Camera Feed */}
        <div
          className="relative rounded-2xl overflow-hidden border border-gray-700 shadow-2xl flex-shrink-0"
          style={{ width: 640, height: 480 }}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
          />

          {/* Status badge */}
          <div className="absolute top-3 left-3 bg-black/60 rounded-full px-3 py-1 text-xs backdrop-blur-sm">
            {isReady ? (
              <span className="text-green-400">● Live</span>
            ) : (
              <span className="text-yellow-400">⏳ Loading...</span>
            )}
          </div>

          {/* Hand color legend */}
          <div className="absolute bottom-3 left-3 flex gap-3 text-xs">
            <span className="bg-black/60 px-2 py-1 rounded-full text-purple-400 backdrop-blur-sm">
              ● Left Hand
            </span>
            <span className="bg-black/60 px-2 py-1 rounded-full text-cyan-400 backdrop-blur-sm">
              ● Right Hand
            </span>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-4 flex-1 w-full">

          {/* Left Hand Panel */}
          <div className="bg-gray-900/80 rounded-2xl p-5 border border-purple-800/60 backdrop-blur-sm">
            <p className="text-purple-400 text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
              Left Hand
            </p>
            <p className="text-2xl font-bold text-white min-h-[2rem]">
              {rightHand.gesture !== "none"
                ? gestureEmoji[rightHand.gesture]
                : <span className="text-gray-600 text-lg">No hand detected</span>}
            </p>
            {rightHand.gesture !== "none" && (
              <p className="text-gray-500 text-xs mt-2">
                X: {Math.round(rightHand.cursorX)}px &nbsp;|&nbsp; Y: {Math.round(rightHand.cursorY)}px
              </p>
            )}
          </div>

          {/* Right Hand Panel */}
          <div className="bg-gray-900/80 rounded-2xl p-5 border border-cyan-800/60 backdrop-blur-sm">
            <p className="text-cyan-400 text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              Right Hand
            </p>
            <p className="text-2xl font-bold text-white min-h-[2rem]">
              {leftHand.gesture !== "none"
                ? gestureEmoji[leftHand.gesture]
                : <span className="text-gray-600 text-lg">No hand detected</span>}
            </p>
            {leftHand.gesture !== "none" && (
              <p className="text-gray-500 text-xs mt-2">
                X: {Math.round(leftHand.cursorX)}px &nbsp;|&nbsp; Y: {Math.round(leftHand.cursorY)}px
              </p>
            )}
          </div>

          {/* Gesture Reference */}
          <div className="bg-gray-900/80 rounded-2xl p-5 border border-gray-700/60 backdrop-blur-sm">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-3">
              Gesture Reference
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(gestureEmoji) as [GestureType, string][])
                .filter(([k]) => k !== "none")
                .map(([key, label]) => (
                  <div
                    key={key}
                    className={`px-2 py-2 rounded-lg border text-xs text-center transition-all duration-150 ${
                      leftHand.gesture === key || rightHand.gesture === key
                        ? "border-purple-400 bg-purple-900/40 text-white scale-105 shadow-lg shadow-purple-900/30"
                        : "border-gray-700/60 text-gray-500"
                    }`}
                  >
                    {label}
                  </div>
                ))}
            </div>
          </div>

          {/* Air Canvas Button */}
          <a
            href="/canvas"
            className="w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-lg hover:scale-105 hover:shadow-xl hover:shadow-purple-900/40 transition-all duration-200 text-center block"
          >
            {"✍️ Try Air Canvas ➜"}
          </a>

        </div>
      </div>
    </main>
  );
}