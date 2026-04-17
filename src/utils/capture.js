import { setActiveConfig, Config1080p, Config1440p, Config4K } from '../config';

function detectConfig(width, height) {
	if (width >= 3840 || height >= 2160) return new Config4K();
	if (width >= 2560 || height >= 1440) return new Config1440p();
	return new Config1080p();
}

let _stream = null;
let _video = null;

export async function startStream() {
	if (_stream) return;
	_stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
	_video = document.createElement('video');
	_video.srcObject = _stream;
	await _video.play();
	setActiveConfig(detectConfig(_video.videoWidth, _video.videoHeight));
	_stream.getTracks()[0].addEventListener('ended', () => {
		_stream = null;
		_video = null;
	});
}

export function grabFrame() {
	if (!_video) throw new Error('No active stream');
	const canvas = document.createElement('canvas');
	canvas.width = _video.videoWidth;
	canvas.height = _video.videoHeight;
	canvas.getContext('2d').drawImage(_video, 0, 0);
	return canvas;
}

export function stopStream() {
	if (_stream) {
		_stream.getTracks().forEach((t) => t.stop());
		_stream = null;
		_video = null;
	}
}

export function isStreaming() {
	return !!_stream;
}

export async function captureFrame() {
	await startStream();
	return grabFrame();
}
