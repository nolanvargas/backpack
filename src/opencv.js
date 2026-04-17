import cvModule from '@techstark/opencv-js';

// Re-export the cv object as a named export.
// Callers import this directly; getCv() is only used to await readiness.
export { cvModule as cv };

let _ready = null;

export const getCv = () => {
	if (_ready) return _ready;
	if (cvModule.Mat) {
		_ready = Promise.resolve();
	} else {
		// Resolve with undefined — never pass cvModule through the promise chain.
		// If cvModule has a .then property (Emscripten WASM modules sometimes do),
		// passing it to resolve() triggers thenable detection and hangs the chain.
		_ready = new Promise((resolve) => {
			cvModule.onRuntimeInitialized = resolve;
		});
	}
	return _ready;
};
