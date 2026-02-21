import { useEffect, useRef, useState } from "react";
import {
  HandLandmarker,
  FilesetResolver,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type GestureType =
  | "open_palm"
  | "fist"
  | "pointing"
  | "pinch"
  | "peace"
  | "none";

export interface GestureState {
  gesture: GestureType;
  cursorX: number;
  cursorY: number;
  isReady: boolean;
}

function detectGesture(result: HandLandmarkerResult): {
  gesture: GestureType;
  x: number;
  y: number;
} {
  if (!result.landmarks || result.landmarks.length === 0) {
    return { gesture: "none", x: 0, y: 0 };
  }

  const hand = result.landmarks[0];
  const thumbTip = hand[4];
  const indexTip = hand[8];
  const middleTip = hand[12];
  const ringTip = hand[16];
  const pinkyTip = hand[20];
  const indexMCP = hand[5];
  const middleMCP = hand[9];
  const ringMCP = hand[13];
  const pinkyMCP = hand[17];

  const x = 1 - indexTip.x;
  const y = indexTip.y;

  const indexUp = indexTip.y < indexMCP.y;
  const middleUp = middleTip.y < middleMCP.y;
  const ringUp = ringTip.y < ringMCP.y;
  const pinkyUp = pinkyTip.y < pinkyMCP.y;

  const pinchDist = Math.hypot(
    thumbTip.x - indexTip.x,
    thumbTip.y - indexTip.y
  );
  if (pinchDist < 0.05) return { gesture: "pinch", x, y };
  if (indexUp && middleUp && !ringUp && !pinkyUp) return { gesture: "peace", x, y };
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return { gesture: "pointing", x, y };
  if (indexUp && middleUp && ringUp && pinkyUp) return { gesture: "open_palm", x, y };
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) return { gesture: "fist", x, y };

  return { gesture: "none", x, y };
}

export function useGestureDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<GestureState>({
    gesture: "none",
    cursorX: 0,
    cursorY: 0,
    isReady: false,
  });

  useEffect(() => {
    let handLandmarker: HandLandmarker;
    let animationId: number;
    let lastVideoTime = -1;
    let isRunning = true;

    async function init() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      if (!videoRef.current || !isRunning) return;

      videoRef.current.srcObject = stream;

      // ✅ Wait for video to be truly ready with real dimensions
      await new Promise<void>((resolve) => {
        const video = videoRef.current!;
        video.onloadeddata = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            resolve();
          }
        };
        video.play();
      });

      setState((s) => ({ ...s, isReady: true }));
      detect();
    }

    function detect() {
      if (!isRunning || !videoRef.current) return;

      const video = videoRef.current;

      // ✅ Guard: skip if video not ready or same frame
      if (
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0 ||
        video.currentTime === lastVideoTime
      ) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      lastVideoTime = video.currentTime;

      try {
        const result = handLandmarker.detectForVideo(video, performance.now());
        const { gesture, x, y } = detectGesture(result);
        setState({
          gesture,
          cursorX: x * window.innerWidth,
          cursorY: y * window.innerHeight,
          isReady: true,
        });
      } catch (e) {
        // silently skip bad frames
      }

      animationId = requestAnimationFrame(detect);
    }

    init().catch(console.error);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationId);
      if (handLandmarker) handLandmarker.close();
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
      }
    };
  }, []);

  return { ...state, videoRef };
}