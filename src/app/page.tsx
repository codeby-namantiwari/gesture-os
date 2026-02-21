"use client";
import { useGestureDetection } from "@/hooks/useGestureDetection";

const gestureEmoji: Record<string, string> = {
  open_palm: "🖐️ Open Palm",
  fist: "✊ Fist",
  pointing: "👆 Pointing",
  pinch: "🤏 Pinch",
  peace: "✌️ Peace",
  none: "🤚 Show your hand...",
};

export default function Home() {
  const { gesture, cursorX, cursorY, isReady, videoRef } = useGestureDetection();

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Hidden video for MediaPipe */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Gesture Cursor */}
      {isReady && (
        <div
          className="fixed w-8 h-8 rounded-full border-4 border-purple-400 pointer-events-none z-50 transition-all duration-75"
          style={{
            left: cursorX - 16,
            top: cursorY - 16,
            backgroundColor:
              gesture === "pinch" ? "rgba(168,85,247,0.8)" : "transparent",
          }}
        />
      )}

      {/* UI */}
      <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
        GestureOS
      </h1>
      <p className="text-gray-400 mb-12 text-lg">Control your computer with hand gestures</p>

      <div className="bg-gray-900 rounded-2xl p-10 text-center border border-gray-700">
        <p className="text-gray-400 text-sm mb-2">Detected Gesture</p>
        <p className="text-4xl font-bold text-purple-400">
          {isReady ? gestureEmoji[gesture] : "⏳ Loading camera..."}
        </p>
        {isReady && (
          <p className="text-gray-500 text-xs mt-4">
            Cursor: ({Math.round(cursorX)}, {Math.round(cursorY)})
          </p>
        )}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3 text-center text-sm">
        {Object.entries(gestureEmoji).filter(([k]) => k !== "none").map(([key, label]) => (
          <div
            key={key}
            className={`px-4 py-2 rounded-lg border transition-all ${
              gesture === key
                ? "border-purple-400 bg-purple-900 text-purple-200"
                : "border-gray-700 text-gray-500"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    </main>
  );
}