import { useEffect, useState, RefObject } from 'react';
import type { BadgeStatus, ROIConfig } from '../types';

interface Props {
  videoRef:         RefObject<HTMLVideoElement>;
  hiddenCanvasRef:  RefObject<HTMLCanvasElement>;
  overlayCanvasRef: RefObject<HTMLCanvasElement>;
  captureActive:    boolean;
  badge:            BadgeStatus;
  sessionStart:     number | null;
  ocrStatus:        string;
  lastScanTime:     string;
  confidence:       string;
  scanCount:        number;
  lastBlue:         number;
  roi:              ROIConfig;
  autoOcr:          boolean;
  setROI:           (roi: ROIConfig) => void;
  setAutoOcr:       (v: boolean) => void;
  startCapture:     () => void;
  stopCapture:      () => void;
  clearData:        () => void;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatElapsed(start: number | null): string {
  if (!start) return '00:00:00';
  const s = Math.floor((Date.now() - start) / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export default function CapturePanel({
  videoRef, hiddenCanvasRef, overlayCanvasRef,
  captureActive, badge, sessionStart,
  ocrStatus, lastScanTime, confidence, scanCount, lastBlue,
  roi, autoOcr, setROI, setAutoOcr,
  startCapture, stopCapture, clearData,
}: Props) {

  const [timerStr, setTimerStr] = useState('00:00:00');

  useEffect(() => {
    if (!sessionStart) { setTimerStr('00:00:00'); return; }
    const id = setInterval(() => setTimerStr(formatElapsed(sessionStart)), 1000);
    return () => clearInterval(id);
  }, [sessionStart]);

  return (
    <section className="panel panel--capture">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="panel-title">SCREEN CAPTURE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`badge badge--${badge}`}>
            {badge === 'offline' ? 'OFFLINE' : badge === 'scanning' ? 'SCANNING' : 'INVENTORY'}
          </span>
          <span className="session-timer">{timerStr}</span>
        </div>
      </div>

      {/* Video preview */}
      <div className="capture-wrap">
        <video id="capture-video" ref={videoRef} autoPlay muted playsInline />
        <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />
        <canvas id="roi-overlay" ref={overlayCanvasRef} style={{ display: captureActive ? 'block' : 'none' }} />

        {!captureActive && (
          <div className="capture-overlay">
            <p>No capture active</p>
            <button className="btn btn--primary" onClick={startCapture}>START CAPTURE</button>
          </div>
        )}

        {captureActive && <div className="scan-line" />}
      </div>

      {/* Controls */}
      <div className="controls">
        <button className="btn btn--danger" onClick={stopCapture} disabled={!captureActive}>STOP</button>
        <button className="btn btn--ghost"  onClick={clearData}>CLEAR DATA</button>
        <label className="toggle-wrap">
          <input type="checkbox" checked={autoOcr} onChange={e => setAutoOcr(e.target.checked)} />
          <span className="toggle-label">Auto-OCR</span>
        </label>
      </div>

      {/* OCR status */}
      <div className="ocr-status">
        {[
          ['OCR Engine',    ocrStatus],
          ['Last scan',     lastScanTime],
          ['Confidence',    confidence],
          ['Scans / session', String(scanCount)],
          ['Blue avg',      captureActive ? lastBlue.toFixed(1) : '—'],
        ].map(([label, value]) => (
          <div className="ocr-row" key={label}>
            <span className="ocr-label">{label}</span>
            <span className="ocr-value">{value}</span>
          </div>
        ))}
      </div>

      {/* Detection region sliders */}
      <div className="roi-config">
        <div className="panel-title" style={{ marginBottom: 8 }}>DETECTION REGION</div>

        <SliderRow
          label="X"
          value={Math.round(roi.xPct * 100)}
          min={0} max={90}
          onChange={v => setROI({ ...roi, xPct: v / 100 })}
          suffix="%"
        />
        <SliderRow
          label="Y"
          value={Math.round(roi.yPct * 100)}
          min={0} max={90}
          onChange={v => setROI({ ...roi, yPct: v / 100 })}
          suffix="%"
        />
        <SliderRow
          label="Size"
          value={Math.round(roi.sizePct * 100)}
          min={3} max={60}
          onChange={v => setROI({ ...roi, sizePct: v / 100 })}
          suffix="%"
        />
        <SliderRow
          label="Threshold"
          value={roi.threshold}
          min={0} max={255}
          onChange={v => setROI({ ...roi, threshold: v })}
          isThreshold
        />
      </div>
    </section>
  );
}

function SliderRow({
  label, value, min, max, suffix = '', onChange, isThreshold = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
  isThreshold?: boolean;
}) {
  return (
    <div className={`roi-slider-row${isThreshold ? ' roi-slider-row--threshold' : ''}`}>
      <label>{label} <span>{value}</span>{suffix}</label>
      <input
        type="range"
        min={min} max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}
