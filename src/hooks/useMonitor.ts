import { useRef, useState, useEffect, useCallback } from 'react';
import { createWorker, Worker as TesseractWorker } from 'tesseract.js';
import type { Item, ROIConfig, ActivityPoint, LogEntry, BadgeStatus, LogType, Rarity } from '../types';

// ── Constants ─────────────────────────────────────────────────────
const ITEM_PATTERNS = [
  /^([A-Za-z][A-Za-z0-9 \-']+?)\s+[x×]?\s*(\d+)$/,
  /^([A-Za-z][A-Za-z0-9 \-']+?)\s*\((\d+)\)$/,
  /^(\d+)\s+([A-Za-z][A-Za-z0-9 \-']+)$/,
] as const;

const RARITY_KEYWORDS: Record<Rarity, string[]> = {
  legendary: ['legendary', 'exotic', 'artifact'],
  epic:      ['epic', 'advanced', 'enhanced'],
  rare:      ['rare', 'superior', 'tactical'],
  uncommon:  ['uncommon', 'improved', 'standard'],
  common:    ['common', 'basic', 'scrap', 'component'],
};

let logIdCounter = 0;

function guessRarity(name: string): Rarity {
  const lower = name.toLowerCase();
  for (const [rarity, keywords] of Object.entries(RARITY_KEYWORDS) as [Rarity, string[]][]) {
    if (keywords.some(kw => lower.includes(kw))) return rarity;
  }
  return 'common';
}

function parseInventoryText(rawText: string): { name: string; qty: number; rarity: Rarity }[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const results: { name: string; qty: number; rarity: Rarity }[] = [];

  for (const line of lines) {
    if (line.length < 3 || line.length > 60) continue;
    let matched = false;

    for (let pi = 0; pi < ITEM_PATTERNS.length; pi++) {
      const m = line.match(ITEM_PATTERNS[pi]);
      if (m) {
        const name = (pi === 2 ? m[2] : m[1]).trim();
        const qty  = parseInt(pi === 2 ? m[1] : m[2], 10);
        if (name.length >= 2 && qty > 0 && qty < 9999) {
          results.push({ name, qty, rarity: guessRarity(name) });
          matched = true;
          break;
        }
      }
    }

    if (!matched && /^[A-Za-z][A-Za-z0-9 \-']{2,29}$/.test(line)) {
      results.push({ name: line, qty: 1, rarity: guessRarity(line) });
    }
  }

  return results;
}

// ── Hook ──────────────────────────────────────────────────────────
export function useMonitor() {
  // ── DOM refs ─────────────────────────────────────────────────
  const videoRef         = useRef<HTMLVideoElement>(null);
  const hiddenCanvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── Internal mutable refs (not React state) ───────────────────
  const streamRef       = useRef<MediaStream | null>(null);
  const ocrWorkerRef    = useRef<TesseractWorker | null>(null);
  const ocrReadyRef     = useRef(false);
  const autoOcrRef      = useRef(true);
  const scanningRef     = useRef(false);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const overlayRafRef   = useRef<number | null>(null);
  const roiRef          = useRef<ROIConfig>({ xPct: 0.10, yPct: 0.10, sizePct: 0.25, threshold: 80 });
  const lastBlueRef     = useRef(0);
  const itemsRef        = useRef<Map<string, Item>>(new Map());

  // ── React state (drives re-renders) ──────────────────────────
  const [captureActive, setCaptureActive] = useState(false);
  const [ocrStatus,     setOcrStatus]     = useState('Loading…');
  const [ocrReady,      setOcrReady]      = useState(false);
  const [badge,         setBadge]         = useState<BadgeStatus>('offline');
  const [items,         setItems]         = useState<Map<string, Item>>(new Map());
  const [activityHistory, setActivityHistory] = useState<ActivityPoint[]>([]);
  const [logs,          setLogs]          = useState<LogEntry[]>([]);
  const [scanCount,     setScanCount]     = useState(0);
  const [detectionCount,setDetectionCount]= useState(0);
  const [lastBlue,      setLastBlue]      = useState(0);
  const [sessionStart,  setSessionStart]  = useState<number | null>(null);
  const [lastScanTime,  setLastScanTime]  = useState('—');
  const [confidence,    setConfidence]    = useState('—');
  const [roi,           setROIState]      = useState<ROIConfig>({ xPct: 0.10, yPct: 0.10, sizePct: 0.25, threshold: 80 });
  const [autoOcr,       setAutoOcrState]  = useState(true);

  // ── Helpers ────────────────────────────────────────────────────
  const addLog = useCallback((msg: string, type: LogType = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [{ id: ++logIdCounter, time, msg, type }, ...prev].slice(0, 40));
  }, []);

  const setROI = useCallback((next: ROIConfig) => {
    roiRef.current = next;
    setROIState(next);
  }, []);

  const setAutoOcr = useCallback((v: boolean) => {
    autoOcrRef.current = v;
    setAutoOcrState(v);
  }, []);

  // ── OCR worker init / cleanup ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const worker = await createWorker('eng', 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              setOcrStatus(`${Math.round(m.progress * 100)}%`);
            }
          },
        });
        if (cancelled) { await worker.terminate(); return; }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 :-×x()[].', preserve_interword_spaces: '1' } as any);

        ocrWorkerRef.current = worker;
        ocrReadyRef.current  = true;
        setOcrReady(true);
        setOcrStatus('Ready');
        addLog('OCR engine initialized', 'success');
      } catch (e) {
        if (!cancelled) {
          setOcrStatus('Error');
          addLog(`OCR init failed: ${(e as Error).message}`, 'warn');
        }
      }
    })();

    return () => {
      cancelled = true;
      ocrWorkerRef.current?.terminate();
    };
  }, [addLog]);

  // ── avgBlueInROI ───────────────────────────────────────────────
  // Reads average blue channel of the configured square from the hidden canvas.
  const avgBlueInROI = useCallback((): number => {
    const canvas = hiddenCanvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return 0;
    const ctx = canvas.getContext('2d')!;
    const { xPct, yPct, sizePct } = roiRef.current;
    const side = Math.floor(sizePct * Math.min(canvas.width, canvas.height));
    const px   = Math.floor(xPct * canvas.width);
    const py   = Math.floor(yPct * canvas.height);
    const safe = Math.max(1, Math.min(side, canvas.width - px, canvas.height - py));
    const data = ctx.getImageData(px, py, safe, safe).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += data[i + 2];
    return sum / (safe * safe);
  }, []);

  // ── getVideoRenderBounds ────────────────────────────────────────
  // Returns where the video actually renders inside the overlay canvas,
  // accounting for object-fit:contain letterboxing.
  const getVideoRenderBounds = useCallback(() => {
    const video   = videoRef.current;
    const overlay = overlayCanvasRef.current;
    if (!video || !overlay) return null;
    const vW = video.videoWidth, vH = video.videoHeight;
    const cW = overlay.clientWidth, cH = overlay.clientHeight;
    if (!vW || !vH || !cW || !cH) return null;
    const scale = Math.min(cW / vW, cH / vH);
    return { x: (cW - vW * scale) / 2, y: (cH - vH * scale) / 2, w: vW * scale, h: vH * scale };
  }, []);

  // ── Overlay RAF loop ───────────────────────────────────────────
  // Draws the ROI box + live blue value on the overlay canvas.
  // Uses only refs for mutable values — no stale closure issues.
  const startOverlayLoop = useCallback(() => {
    if (overlayRafRef.current !== null) cancelAnimationFrame(overlayRafRef.current);

    const draw = () => {
      const video   = videoRef.current;
      const canvas  = hiddenCanvasRef.current;
      const overlay = overlayCanvasRef.current;

      if (!video || !canvas || !overlay) {
        overlayRafRef.current = requestAnimationFrame(draw);
        return;
      }

      const roiCtx = overlay.getContext('2d')!;
      const cW = overlay.clientWidth, cH = overlay.clientHeight;
      if (overlay.width !== cW || overlay.height !== cH) {
        overlay.width = cW; overlay.height = cH;
      }
      roiCtx.clearRect(0, 0, cW, cH);

      const bounds = getVideoRenderBounds();
      if (!bounds) { overlayRafRef.current = requestAnimationFrame(draw); return; }

      // Sample current frame for blue average
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const ctx = canvas.getContext('2d')!;
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        lastBlueRef.current = avgBlueInROI();
      }

      const { xPct, yPct, sizePct, threshold } = roiRef.current;
      const side      = sizePct * Math.min(bounds.w, bounds.h);
      const rx        = bounds.x + xPct * bounds.w;
      const ry        = bounds.y + yPct * bounds.h;
      const detected  = lastBlueRef.current >= threshold;
      const color     = detected ? '#22c55e' : '#00d4ff';

      // Fill
      roiCtx.fillStyle = detected ? 'rgba(34,197,94,0.08)' : 'rgba(0,212,255,0.06)';
      roiCtx.fillRect(rx, ry, side, side);

      // Border
      roiCtx.strokeStyle = color;
      roiCtx.lineWidth = 1.5;
      roiCtx.setLineDash([]);
      roiCtx.strokeRect(rx + 0.75, ry + 0.75, side - 1.5, side - 1.5);

      // Corner ticks
      const t = 8;
      roiCtx.lineWidth = 2;
      const corners: [number, number, number, number, number, number][] = [
        [rx,        ry,        t,  0,  0,  t],
        [rx + side, ry,       -t,  0,  0,  t],
        [rx,        ry + side, t,  0,  0, -t],
        [rx + side, ry + side,-t,  0,  0, -t],
      ];
      for (const [cx, cy, dx1, dy1, dx2, dy2] of corners) {
        roiCtx.beginPath();
        roiCtx.moveTo(cx + dx1, cy + dy1);
        roiCtx.lineTo(cx, cy);
        roiCtx.lineTo(cx + dx2, cy + dy2);
        roiCtx.stroke();
      }

      // Label
      const label    = `BLUE AVG: ${lastBlueRef.current.toFixed(1)}`;
      const subLabel = `THRESH: ${threshold}`;
      roiCtx.font = 'bold 10px Courier New';
      const lw = Math.max(roiCtx.measureText(label).width, roiCtx.measureText(subLabel).width) + 10;
      roiCtx.fillStyle = 'rgba(10,12,16,0.82)';
      roiCtx.fillRect(rx, ry - 30, lw, 28);
      roiCtx.fillStyle = color;
      roiCtx.fillText(label, rx + 5, ry - 18);
      roiCtx.fillStyle = '#556070';
      roiCtx.fillText(subLabel, rx + 5, ry - 6);

      // Meter bar
      const barY = ry + side + 4;
      roiCtx.fillStyle = 'rgba(30,42,58,0.9)';
      roiCtx.fillRect(rx, barY, side, 3);
      roiCtx.fillStyle = color;
      roiCtx.fillRect(rx, barY, side * Math.min(1, lastBlueRef.current / 255), 3);
      // Threshold tick
      roiCtx.strokeStyle = '#ff6b35';
      roiCtx.lineWidth = 1;
      roiCtx.setLineDash([2, 2]);
      const tx = rx + side * (threshold / 255);
      roiCtx.beginPath();
      roiCtx.moveTo(tx, barY - 2);
      roiCtx.lineTo(tx, barY + 5);
      roiCtx.stroke();
      roiCtx.setLineDash([]);

      overlayRafRef.current = requestAnimationFrame(draw);
    };

    overlayRafRef.current = requestAnimationFrame(draw);
  }, [avgBlueInROI, getVideoRenderBounds]);

  const stopOverlayLoop = useCallback(() => {
    if (overlayRafRef.current !== null) {
      cancelAnimationFrame(overlayRafRef.current);
      overlayRafRef.current = null;
    }
  }, []);

  // ── Item management ────────────────────────────────────────────
  const addOrUpdateItem = useCallback((name: string, qty: number, rarity: Rarity) => {
    setItems(prev => {
      const next = new Map(prev);
      const key  = name.toLowerCase();
      const existing = next.get(key);
      next.set(key, existing
        ? { ...existing, qty, lastSeen: Date.now() }
        : { name, qty, rarity, lastSeen: Date.now() }
      );
      itemsRef.current = next;
      return next;
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems(prev => {
      const next = new Map(prev);
      next.delete(key);
      itemsRef.current = next;
      return next;
    });
  }, []);

  // ── Record activity after items change ─────────────────────────
  useEffect(() => {
    if (!captureActive) return;
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setActivityHistory(prev => [...prev.slice(-19), { time, count: items.size }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ── doScan (called from setInterval — uses refs for fresh values)
  const startScanLoop = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(async () => {
      if (!autoOcrRef.current || !ocrReadyRef.current || scanningRef.current) return;
      const video  = videoRef.current;
      const canvas = hiddenCanvasRef.current;
      if (!video || !canvas || !video.videoWidth) return;

      scanningRef.current = true;
      try {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')!.drawImage(video, 0, 0);

        const blue   = avgBlueInROI();
        lastBlueRef.current = blue;
        setLastBlue(blue);

        if (blue >= roiRef.current.threshold) {
          setBadge('detected');
          setDetectionCount(c => c + 1);
          addLog(`Inventory detected (blue avg ${blue.toFixed(1)} ≥ ${roiRef.current.threshold}) — scanning…`, 'detect');

          const ctx = canvas.getContext('2d')!;
          const x = Math.floor(canvas.width  * 0.05);
          const y = Math.floor(canvas.height * 0.05);
          const w = Math.floor(canvas.width  * 0.90);
          const h = Math.floor(canvas.height * 0.90);
          const imageData = ctx.getImageData(x, y, w, h);

          const tmp = document.createElement('canvas');
          tmp.width = w; tmp.height = h;
          tmp.getContext('2d')!.putImageData(imageData, 0, 0);
          const blob = await new Promise<Blob>(res => tmp.toBlob(b => res(b!), 'image/png'));

          const { data } = await ocrWorkerRef.current!.recognize(blob);
          setConfidence(`${Math.round(data.confidence)}%`);

          const parsed = parseInventoryText(data.text);
          if (parsed.length > 0) {
            parsed.forEach(({ name, qty, rarity }) => addOrUpdateItem(name, qty, rarity));
            addLog(`Parsed ${parsed.length} item(s) from OCR`, 'success');
          } else {
            addLog('OCR ran but no items matched pattern', 'warn');
          }
        } else {
          setBadge('scanning');
        }

        setScanCount(c => c + 1);
        setLastScanTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
      } catch (e) {
        addLog(`Scan error: ${(e as Error).message}`, 'warn');
      } finally {
        scanningRef.current = false;
      }
    }, 2000);
  }, [avgBlueInROI, addOrUpdateItem, addLog]);

  // ── Capture start / stop ───────────────────────────────────────
  // stopCapture is stable and used via ref inside startCapture's event listener.
  const stopCaptureRef = useRef<() => void>(() => {});

  const stopCapture = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) video.srcObject = null;

    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    stopOverlayLoop();

    setCaptureActive(false);
    setBadge('offline');
    setSessionStart(null);
    setLastBlue(0);
    addLog('Capture stopped');
  }, [stopOverlayLoop, addLog]);

  // Keep the ref in sync with the latest stopCapture
  useEffect(() => { stopCaptureRef.current = stopCapture; }, [stopCapture]);

  const startCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false });
      streamRef.current = stream;

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      stream.getVideoTracks()[0].addEventListener('ended', () => stopCaptureRef.current());

      setCaptureActive(true);
      setBadge('scanning');
      setSessionStart(Date.now());
      startOverlayLoop();
      startScanLoop();
      addLog('Screen capture started', 'success');
    } catch (e) {
      addLog(`Capture failed: ${(e as Error).message}`, 'warn');
    }
  }, [startOverlayLoop, startScanLoop, addLog]);

  // ── Clear all data ─────────────────────────────────────────────
  const clearData = useCallback(() => {
    setItems(new Map());
    itemsRef.current = new Map();
    setActivityHistory([]);
    setScanCount(0);
    setDetectionCount(0);
    setLastScanTime('—');
    setConfidence('—');
    setLastBlue(0);
    addLog('All data cleared');
  }, [addLog]);

  // ── Cleanup on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      stopOverlayLoop();
    };
  }, [stopOverlayLoop]);

  return {
    // DOM refs
    videoRef,
    hiddenCanvasRef,
    overlayCanvasRef,
    // Capture
    captureActive,
    startCapture,
    stopCapture,
    badge,
    sessionStart,
    // OCR / scan status
    ocrStatus,
    ocrReady,
    lastScanTime,
    confidence,
    scanCount,
    detectionCount,
    lastBlue,
    // ROI
    roi,
    setROI,
    // Auto-OCR toggle
    autoOcr,
    setAutoOcr,
    // Items
    items,
    addOrUpdateItem,
    removeItem,
    // Activity
    activityHistory,
    // Logs
    logs,
    addLog,
    // Clear
    clearData,
  };
}
