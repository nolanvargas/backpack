/// <reference lib="webworker" />

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent) => {
	const frame = e.data;
	// placeholder for OpenCV.js processing
	ctx.postMessage([]);
};
