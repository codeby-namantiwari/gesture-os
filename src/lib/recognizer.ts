// $1 Unistroke Recognizer — implemented from scratch
// Based on Wobbrock et al. 2007

interface Point {
  x: number;
  y: number;
}

const NumPoints = 64;
const SquareSize = 250;
const Origin: Point = { x: 0, y: 0 };
const Diagonal = Math.sqrt(SquareSize * SquareSize + SquareSize * SquareSize);
const HalfDiagonal = Diagonal / 2;
const AngleRange = 45;
const AnglePrecision = 2;
const Phi = 0.5 * (-1 + Math.sqrt(5)); // golden ratio

// ─── Math helpers ───────────────────────────────────────────────

function pathLength(pts: Point[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return d;
}

function resample(pts: Point[], n: number): Point[] {
  const I = pathLength(pts) / (n - 1);
  let D = 0;
  const newPts: Point[] = [{ ...pts[0] }];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (D + d >= I) {
      const qx = pts[i - 1].x + ((I - D) / d) * (pts[i].x - pts[i - 1].x);
      const qy = pts[i - 1].y + ((I - D) / d) * (pts[i].y - pts[i - 1].y);
      newPts.push({ x: qx, y: qy });
      pts.splice(i, 0, { x: qx, y: qy });
      D = 0;
    } else {
      D += d;
    }
  }
  if (newPts.length === n - 1) newPts.push({ ...pts[pts.length - 1] });
  return newPts;
}

function indicativeAngle(pts: Point[]): number {
  const c = centroid(pts);
  return Math.atan2(c.y - pts[0].y, c.x - pts[0].x);
}

function rotateBy(pts: Point[], radians: number): Point[] {
  const c = centroid(pts);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return pts.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function scaleTo(pts: Point[], size: number): Point[] {
  const b = boundingBox(pts);
  return pts.map((p) => ({
    x: p.x * (size / Math.max(b.width, 1)),
    y: p.y * (size / Math.max(b.height, 1)),
  }));
}

function translateTo(pts: Point[], pt: Point): Point[] {
  const c = centroid(pts);
  return pts.map((p) => ({ x: p.x + pt.x - c.x, y: p.y + pt.y - c.y }));
}

function centroid(pts: Point[]): Point {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

function boundingBox(pts: Point[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function pathDistance(a: Point[], b: Point[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  }
  return d / a.length;
}

function distanceAtBestAngle(
  pts: Point[],
  tmpl: Point[],
  a: number,
  b: number,
  threshold: number
): number {
  let x1 = Phi * a + (1 - Phi) * b;
  let f1 = pathDistance(rotateBy(pts, x1), tmpl);
  let x2 = (1 - Phi) * a + Phi * b;
  let f2 = pathDistance(rotateBy(pts, x2), tmpl);
  while (Math.abs(b - a) > threshold) {
    if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = Phi * a + (1 - Phi) * b; f1 = pathDistance(rotateBy(pts, x1), tmpl); }
    else { a = x1; x1 = x2; f1 = f2; x2 = (1 - Phi) * a + Phi * b; f2 = pathDistance(rotateBy(pts, x2), tmpl); }
  }
  return Math.min(f1, f2);
}

// ─── Normalize a stroke ──────────────────────────────────────────

function normalize(pts: Point[]): Point[] {
  let p = resample([...pts], NumPoints);
  const radians = indicativeAngle(p);
  p = rotateBy(p, -radians);
  p = scaleTo(p, SquareSize);
  p = translateTo(p, Origin);
  return p;
}

// ─── Template definitions ────────────────────────────────────────

interface Template {
  name: string;
  points: Point[];
}

function mkPts(coords: number[][]): Point[] {
  return coords.map(([x, y]) => ({ x, y }));
}

const RAW_TEMPLATES: { name: string; pts: number[][] }[] = [
  // Letters
  { name: "A", pts: [[0,100],[50,0],[100,100],[25,60],[75,60]] },
  { name: "B", pts: [[0,0],[0,100],[50,80],[0,50],[50,20],[0,0]] },
  { name: "C", pts: [[100,10],[50,0],[0,20],[0,80],[50,100],[100,90]] },
  { name: "D", pts: [[0,0],[0,100],[60,90],[90,60],[90,40],[60,10],[0,0]] },
  { name: "E", pts: [[100,0],[0,0],[0,50],[70,50],[0,50],[0,100],[100,100]] },
  { name: "F", pts: [[100,0],[0,0],[0,50],[70,50],[0,50],[0,100]] },
  { name: "G", pts: [[100,10],[50,0],[0,20],[0,80],[50,100],[100,80],[100,50],[60,50]] },
  { name: "H", pts: [[0,0],[0,100],[0,50],[100,50],[100,0],[100,100]] },
  { name: "I", pts: [[0,0],[100,0],[50,0],[50,100],[0,100],[100,100]] },
  { name: "J", pts: [[50,0],[100,0],[100,80],[80,100],[20,100],[0,80]] },
  { name: "K", pts: [[0,0],[0,100],[0,50],[100,0],[0,50],[100,100]] },
  { name: "L", pts: [[0,0],[0,100],[100,100]] },
  { name: "M", pts: [[0,100],[0,0],[50,50],[100,0],[100,100]] },
  { name: "N", pts: [[0,100],[0,0],[100,100],[100,0]] },
  { name: "O", pts: [[50,0],[100,50],[50,100],[0,50],[50,0]] },
  { name: "P", pts: [[0,100],[0,0],[60,10],[80,30],[60,50],[0,50]] },
  { name: "Q", pts: [[50,0],[100,50],[50,100],[0,50],[50,0],[75,75]] },
  { name: "R", pts: [[0,100],[0,0],[60,10],[80,30],[60,50],[0,50],[100,100]] },
  { name: "S", pts: [[100,10],[50,0],[0,20],[50,50],[100,80],[50,100],[0,90]] },
  { name: "T", pts: [[0,0],[100,0],[50,0],[50,100]] },
  { name: "U", pts: [[0,0],[0,80],[20,100],[80,100],[100,80],[100,0]] },
  { name: "V", pts: [[0,0],[50,100],[100,0]] },
  { name: "W", pts: [[0,0],[25,100],[50,50],[75,100],[100,0]] },
  { name: "X", pts: [[0,0],[100,100],[50,50],[0,100],[100,0]] },
  { name: "Y", pts: [[0,0],[50,50],[100,0],[50,50],[50,100]] },
  { name: "Z", pts: [[0,0],[100,0],[0,100],[100,100]] },
  // Numbers
  { name: "0", pts: [[50,0],[100,50],[50,100],[0,50],[50,0]] },
  { name: "1", pts: [[30,20],[50,0],[50,100]] },
  { name: "2", pts: [[0,20],[50,0],[100,20],[0,100],[100,100]] },
  { name: "3", pts: [[0,0],[100,0],[50,50],[100,100],[0,100]] },
  { name: "4", pts: [[0,0],[0,50],[100,50],[100,0],[100,100]] },
  { name: "5", pts: [[100,0],[0,0],[0,50],[80,50],[100,80],[50,100],[0,90]] },
  { name: "6", pts: [[100,0],[20,0],[0,50],[0,100],[100,100],[100,50],[0,50]] },
  { name: "7", pts: [[0,0],[100,0],[0,100]] },
  { name: "8", pts: [[50,50],[0,20],[50,0],[100,20],[50,50],[100,80],[50,100],[0,80],[50,50]] },
  { name: "9", pts: [[100,50],[50,0],[0,50],[50,100],[100,50],[100,0]] },
  // Common words (drawn as gestures)
  { name: "check", pts: [[0,50],[40,100],[100,0]] },
  { name: "delete", pts: [[0,0],[100,100],[50,50],[100,0],[0,100]] },
  { name: "circle", pts: [[50,0],[100,50],[50,100],[0,50],[50,0]] },
];

const TEMPLATES: Template[] = RAW_TEMPLATES.map((t) => ({
  name: t.name,
  points: normalize(mkPts(t.pts)),
}));

// ─── Main recognize function ─────────────────────────────────────

export interface RecognizeResult {
  name: string;
  score: number; // 0-1, higher is better
}

export function recognize(rawPoints: Point[]): RecognizeResult | null {
  if (rawPoints.length < 10) return null;

  const pts = normalize([...rawPoints]);
  let bestScore = -Infinity;
  let bestName = "";

  for (const tmpl of TEMPLATES) {
    const d = distanceAtBestAngle(
      pts,
      tmpl.points,
      (-AngleRange * Math.PI) / 180,
      (AngleRange * Math.PI) / 180,
      (AnglePrecision * Math.PI) / 180
    );
    const score = 1 - d / HalfDiagonal;
    if (score > bestScore) {
      bestScore = score;
      bestName = tmpl.name;
    }
  }

  // Only return if confident enough
  if (bestScore < 0.4) return null;

  return { name: bestName, score: bestScore };
}