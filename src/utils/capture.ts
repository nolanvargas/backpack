import {
	setActiveConfig,
	Config1080p,
	Config1440p,
	Config4K,
} from '../config';
import type { ResolutionConfig } from '../config';

// Match either dimension (width OR height) instead of requiring both:
// getDisplayMedia sometimes reports a cropped capture (e.g. window
// share) where only one axis corresponds to the monitor's native
// resolution. A single-axis match is enough to pick the right config
// because our three supported resolutions have distinct widths AND
// distinct heights.
function detectConfig(width: number, height: number): ResolutionConfig {
	if (width == 1920 || height == 1080) return new Config1080p();
	if (width == 2560 || height == 1440) return new Config1440p();
	if (width == 3840 || height == 2160) return new Config4K();
	throw new Error(`Unsupported resolution: ${width}x${height}`);
}

// Module-level singletons: the browser's display-capture UX is modal
// (picker dialog + indicator bar), so we keep exactly one active stream
// for the lifetime of the app and share it between manual captures and
// the auto-capture loop.
let _stream: MediaStream | null = null;
let _video: HTMLVideoElement | null = null;

export async function startStream(): Promise<void> {
	if (_stream) {
		console.log('[capture] startStream: stream already active, skipping');
		return;
	}
	_stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
	_video = document.createElement('video');
	_video.srcObject = _stream;
	await _video.play();
	setActiveConfig(detectConfig(_video.videoWidth, _video.videoHeight));
	// The user can revoke screen share from the browser's capture bar at
	// any time; when they do, clear our singletons so the next
	// startStream() re-prompts instead of reusing a dead MediaStream.
	_stream.getTracks()[0].addEventListener('ended', () => {
		_stream = null;
		_video = null;
	});
}

export function grabFrame(): HTMLCanvasElement {
	if (!_video) throw new Error('No active stream');
	const canvas = document.createElement('canvas');
	canvas.width = _video.videoWidth;
	canvas.height = _video.videoHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('grabFrame: 2D context unavailable');
	ctx.drawImage(_video, 0, 0);
	return canvas;
}

export function stopStream(): void {
	if (_stream) {
		_stream.getTracks().forEach((t) => t.stop());
		_stream = null;
		_video = null;
	}
}

export function isStreaming(): boolean {
	return !!_stream;
}

export async function captureFrame(): Promise<HTMLCanvasElement> {
	await startStream();
	return grabFrame();
}
