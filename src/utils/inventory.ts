import { getCv, cv } from '../opencv';
import type { Mat } from '../opencv';
import { activeConfig, INVENTORY_MATCH_THRESHOLD } from '../config';

// `templateMat` is a WASM-heap Mat shared across every isInventoryView
// call. We key the cache on the source URL (not the ResolutionConfig
// instance) because the inventory reference image is the one piece of
// state that stays identical across configs that share a resolution —
// if the src string hasn't changed, the decoded Mat is still valid.
let templateMat: Mat | null = null;
let _loadedForSrc: string | null = null;

export async function loadInventoryTemplate(): Promise<void> {
	const { inventorySrc } = activeConfig;
	if (_loadedForSrc === inventorySrc) {
		console.log(
			'[inventory] loadInventoryTemplate: already loaded for this source, skipping',
		);
		return;
	}

	// Free the prior Mat before overwriting — WASM-backed Mats are not
	// reclaimed by the JS GC, so dropping the reference would leak.
	if (templateMat) {
		templateMat.delete();
		templateMat = null;
	}

	_loadedForSrc = inventorySrc;

	await getCv();
	await new Promise<void>((resolve, reject) => {
		const img = new Image();
		img.src = inventorySrc;
		img.onerror = () => {
			_loadedForSrc = null;
			reject(new Error(`Failed to load inventory template: ${inventorySrc}`));
		};
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx)
				return reject(new Error('inventory template: 2D context unavailable'));
			ctx.drawImage(img, 0, 0);
			const imageData = ctx.getImageData(
				0,
				0,
				img.naturalWidth,
				img.naturalHeight,
			);
			const rgba = cv.matFromImageData(imageData);
			templateMat = new cv.Mat();
			cv.cvtColor(rgba, templateMat, cv.COLOR_RGBA2GRAY);
			rgba.delete();
			resolve();
		};
	});
}

export type InventoryViewResult = {
	match: boolean;
	score: number;
	regionCanvas: HTMLCanvasElement | null;
};

export async function isInventoryView(
	sourceCanvas: HTMLCanvasElement,
): Promise<InventoryViewResult> {
	const { inventorySrc, inventoryX, inventoryY, inventoryW, inventoryH } =
		activeConfig;
	// Not every ResolutionConfig ships with a captured inventory reference
	// image yet (e.g. 4K is still placeholder-only). When any piece of the
	// detection rect is missing we default to match=true so the caller
	// falls through to full processing instead of stalling — better to
	// process a non-inventory frame than to never process at all.
	if (
		!inventorySrc ||
		inventoryX === null ||
		inventoryY === null ||
		inventoryW === null ||
		inventoryH === null
	) {
		console.log(
			'[inventory] isInventoryView: no inventorySrc in active config, assuming match=true',
		);
		return { match: true, score: 1, regionCanvas: null };
	}

	await loadInventoryTemplate();
	if (!templateMat)
		throw new Error('isInventoryView: inventory template not loaded');
	const tmpl = templateMat;

	const srcCtx = sourceCanvas.getContext('2d');
	if (!srcCtx)
		throw new Error('isInventoryView: source 2D context unavailable');
	const imageData = srcCtx.getImageData(
		inventoryX,
		inventoryY,
		inventoryW,
		inventoryH,
	);

	const regionCanvas = document.createElement('canvas');
	regionCanvas.width = inventoryW;
	regionCanvas.height = inventoryH;
	const regionCtx = regionCanvas.getContext('2d');
	if (!regionCtx)
		throw new Error('isInventoryView: region 2D context unavailable');
	regionCtx.putImageData(imageData, 0, 0);

	const rgba = cv.matFromImageData(imageData);
	const gray = new cv.Mat();
	const result = new cv.Mat();
	try {
		cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
		cv.matchTemplate(gray, tmpl, result, cv.TM_CCOEFF_NORMED);
		const { maxVal } = cv.minMaxLoc(result);
		const score = Math.round(maxVal * 100) / 100;
		return { match: maxVal >= INVENTORY_MATCH_THRESHOLD, score, regionCanvas };
	} finally {
		rgba.delete();
		gray.delete();
		result.delete();
	}
}
