import cvModule from '@techstark/opencv-js';
import type { Mat, MinMaxLoc } from '@techstark/opencv-js';

// Re-export the types we use so callers don't have to depend on the package.
export type { Mat, Rect, Scalar, Point, MinMaxLoc } from '@techstark/opencv-js';

// The @techstark/opencv-js types are largely accurate but `minMaxLoc`'s
// declared signature mirrors the C++ API (requiring out-parameter pointers),
// whereas the JS binding is `(src, mask?) => MinMaxLoc`. We patch that one
// function and otherwise use the package's real types.
type RawCv = typeof cvModule;
export type Cv = Omit<RawCv, 'minMaxLoc'> & {
	minMaxLoc(src: Mat, mask?: Mat): MinMaxLoc;
};

export const cv = cvModule as unknown as Cv;

interface EmscriptenModule {
	Mat?: unknown;
	onRuntimeInitialized?: () => void;
}

let _ready: Promise<void> | null = null;

export const getCv = (): Promise<void> => {
	if (_ready) return _ready;
	const mod = cvModule as unknown as EmscriptenModule;
	if (mod.Mat) {
		_ready = Promise.resolve();
	} else {
		// Resolve with undefined — never pass cvModule through the promise chain.
		// If cvModule has a .then property (Emscripten WASM modules sometimes do),
		// passing it to resolve() triggers thenable detection and hangs the chain.
		_ready = new Promise<void>((resolve) => {
			mod.onRuntimeInitialized = () => resolve();
		});
	}
	return _ready;
};
