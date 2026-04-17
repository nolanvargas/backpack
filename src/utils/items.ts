import { getCv, cv } from '../opencv';
import type { Mat } from '../opencv';
import { activeConfig, ITEM_MATCH_THRESHOLD } from '../config';
import type { ResolutionConfig } from '../config';
import type { SlotResult } from './slots';
import rawCsv from '../../data.csv?raw';

// data.csv layout: [name, ..., category, ...]. We only need the mapping
// name -> category so we can constrain item-template matching to templates
// whose category matches the slot's detected itemType (huge speedup, and
// prevents cross-category false positives). .slice(1) drops the header row.
const categoryByItem = new Map<string, string>();
rawCsv.split('\n').slice(1).forEach((line) => {
	if (!line.trim()) return;
	const cols = line.split(',');
	const name = cols[0]?.trim();
	const category = cols[5]?.trim();
	if (name && category) categoryByItem.set(name, category);
});

const templates = new Map<string, Mat>(); // itemName -> grayscale Mat
let _loadedForConfig: ResolutionConfig | null = null;
let _loadedPromise: Promise<void> | null = null;

function loadOneTemplate(name: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const img = new Image();
		img.src = `${activeConfig.itemsDir}/${name}.png`;
		img.onerror = () => reject(new Error(`Failed to load item template: ${name}`));
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) return reject(new Error('items: 2D context unavailable'));
			ctx.drawImage(img, 0, 0);
			const imageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

			const rgba = cv.matFromImageData(imageData);
			const gray = new cv.Mat();
			cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
			rgba.delete();

			// EXPERIMENTAL: Sub-pixel blur to reduce phase sensitivity.
			// See matchItems for rationale. Must match the ROI-side
			// blur kernel/sigma exactly.
			const blurred = new cv.Mat();
			cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0.7, 0.7, cv.BORDER_DEFAULT);
			gray.delete();

			templates.set(name, blurred);
			resolve();
		};
	});
}

// Templates are cached per-ResolutionConfig identity. On a resolution
// change the old grayscale Mats must be freed (they live in WASM heap,
// not GC'd by JS) before we rebuild the map for the new config.
export async function loadItemTemplates(): Promise<void> {
	if (_loadedForConfig === activeConfig && _loadedPromise) {
		console.log('[items] loadItemTemplates: already loaded for active config, reusing promise');
		return _loadedPromise;
	}

	for (const mat of templates.values()) mat.delete();
	templates.clear();
	_loadedForConfig = activeConfig;

	_loadedPromise = getCv()
		.then(async () => {
			const dir = activeConfig.itemsDir.replace(/^\//, '');
			const res = await fetch(`/api/list-items?dir=${encodeURIComponent(dir)}`);
			const names: string[] = await res.json();
			await Promise.all(names.map(loadOneTemplate));
			console.log(`[items] ${templates.size} templates ready`);
		})
		.catch((err: unknown) => {
			_loadedForConfig = null;
			_loadedPromise = null;
			return Promise.reject(err);
		});

	return _loadedPromise;
}

export async function matchItems(
	groupedResults: SlotResult[][],
	sourceCanvas: HTMLCanvasElement,
): Promise<SlotResult[][]> {
	await loadItemTemplates();
	if (templates.size === 0) {
		console.log('[items] matchItems: no item templates loaded, returning results unchanged');
		return groupedResults;
	}

	const ctx = sourceCanvas.getContext('2d');
	if (!ctx) throw new Error('matchItems: 2D context unavailable');
	const { SLOT_W, EFFECTIVE_H } = activeConfig;

	return groupedResults.map((group) =>
		group.map((slot): SlotResult => {
			// The item-type stage is the canonical empty-vs-filled gate:
			// no itemType means the slot is empty, so there's nothing to
			// match against our item-template set.
			if (!slot.itemType) {
				console.log(`[items] skip slot @(${slot.x},${slot.y}): no itemType, slot is empty`);
				return slot;
			}

			const imageData = ctx.getImageData(slot.x, slot.y, SLOT_W, EFFECTIVE_H);
			const rgba = cv.matFromImageData(imageData);
			const gray = new cv.Mat();
			cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
			rgba.delete();

			// EXPERIMENTAL: Sub-pixel softening so a 1-px shift between
			// capture and template doesn't crater normalized correlation.
			// Same kernel/sigma as the load-time template blur.
			cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0.7, 0.7, cv.BORDER_DEFAULT);

			let bestName: string | null = null;
			let bestScore = -Infinity;

			// If the previous stage detected an item-type icon, restrict the
			// candidate set to templates in that category. This both speeds
			// up the scan (fewer matchTemplate calls per slot) and avoids
			// cross-category collisions between visually similar items.
			const allowed = slot.itemType
				? new Set([...templates.keys()].filter((n) => categoryByItem.get(n) === slot.itemType))
				: null;

			try {
				for (const [name, tmpl] of templates) {
					if (allowed && !allowed.has(name)) continue;
					// Item templates are rendered at the exact slot size for
					// the active resolution, so we expect a 1:1 size match.
					// Any mismatch means the template is for a different
					// resolution or the slot was cropped incorrectly —
					// matchTemplate would either throw or return garbage.
					if (tmpl.rows !== gray.rows || tmpl.cols !== gray.cols) continue;
					const result = new cv.Mat();
					try {
						cv.matchTemplate(gray, tmpl, result, cv.TM_CCOEFF_NORMED);
						const { maxVal } = cv.minMaxLoc(result);
						if (maxVal > bestScore) {
							bestScore = maxVal;
							bestName = name;
						}
					} finally {
						result.delete();
					}
				}
			} finally {
				gray.delete();
			}

			// Always surface the top candidate for debugging, even when
			// it fails the qualifying threshold (shaky match or wrong
			// category). Pipeline consumers still key off `itemName`,
			// which is only set when the score clears ITEM_MATCH_THRESHOLD.
			const debug: Partial<SlotResult> = {};
			if (bestName !== null && Number.isFinite(bestScore)) {
				debug.itemNameBest = bestName;
				debug.itemNameBestScore = Math.round(bestScore * 100) / 100;
			}
			if (bestScore >= ITEM_MATCH_THRESHOLD && bestName !== null) {
				return {
					...slot,
					...debug,
					itemName: bestName,
					itemScore: Math.round(bestScore * 100) / 100,
				};
			}
			return { ...slot, ...debug };
		}),
	);
}
