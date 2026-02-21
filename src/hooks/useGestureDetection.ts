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

export interface HandGesture {
  gesture: GestureType;
  cursorX: number;
  cursorY: number;
}

export interface GestureState {
  leftHand: HandGesture;
  rightHand: HandGesture;
  isReady: boolean;
}

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

// Purple for first hand, Cyan for second hand
const HAND_COLORS = ["#a855f7", "#06b6d4"];

function detectGesture(landmarks: any[]): { gesture: GestureType; x: number; y: number } {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];
  const indexMCP = landmarks[5];
  const middleMCP = landmarks[9];
  const ringMCP = landmarks[13];
  const pinkyMCP = landmarks[17];

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

function drawLandmarks(
  canvas: HTMLCanvasElement,
  result: HandLandmarkerResult
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!result.landmarks || result.landmarks.length === 0) return;

  const w = canvas.width;
  const h = canvas.height;

  result.landmarks.forEach((hand, handIndex) => {
    // Hand 0 = Purple, Hand 1 = Cyan
    const color = HAND_COLORS[handIndex] ?? "#ffffff";
    const label = handIndex === 0 ? "Left" : "Right";

    // Draw connections
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1;
    ctx.lineCap = "round";

    for (const [a, b] of HAND_CONNECTIONS) {
      const ax = (1 - hand[a].x) * w;
      const ay = hand[a].y * h;
      const bx = (1 - hand[b].x) * w;
      const by = hand[b].y * h;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    // Draw landmark dots
    for (let i = 0; i < hand.length; i++) {
      const x = (1 - hand[i].x) * w;
      const y = hand[i].y * h;
      const isIndexTip = i === 8;
      const isWrist = i === 0;

      // Colored outer circle
      ctx.beginPath();
      ctx.arc(x, y, isIndexTip ? 9 : 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowBlur = 0;
      ctx.fill();

      // White inner dot
      ctx.beginPath();
      ctx.arc(x, y, isIndexTip ? 5 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Label at wrist
      if (isWrist) {
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = color;
        ctx.fillText(label, x + 10, y - 10);
      }
    }
  });
}

const defaultHand: HandGesture = { gesture: "none", cursorX: 0, cursorY: 0 };

export function useGestureDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<GestureState>({
    leftHand: defaultHand,
    rightHand: defaultHand,
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
        numHands: 2,
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!videoRef.current || !isRunning) return;

      videoRef.current.srcObject = stream;

      await new Promise<void>((resolve) => {
        const video = videoRef.current!;
        video.onloadeddata = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) resolve();
        };
        video.play();
      });

      if (canvasRef.current && videoRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
      }

      setState((s) => ({ ...s, isReady: true }));
      detect();
    }

    function detect() {
      if (!isRunning || !videoRef.current) return;
      const video = videoRef.current;

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

        // Draw both hands on canvas
        if (canvasRef.current) {
          drawLandmarks(canvasRef.current, result);
        }

        // Detect gesture for each hand separately
        let leftHand: HandGesture = defaultHand;
        let rightHand: HandGesture = defaultHand;

        result.landmarks.forEach((landmarks, i) => {
          const handedness = result.handednesses[i]?.[0]?.displayName;
          const { gesture, x, y } = detectGesture(landmarks);
          const data: HandGesture = {
            gesture,
            cursorX: x * window.innerWidth,
            cursorY: y * window.innerHeight,
          };
          // MediaPipe labels are from camera POV so we flip them
          if (handedness === "Left") rightHand = data;
          else leftHand = data;
        });

        setState({ leftHand, rightHand, isReady: true });
      } catch (e) {
        // skip bad frames
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

  return { ...state, videoRef, canvasRef };
}