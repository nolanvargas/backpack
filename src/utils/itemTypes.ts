import { getCv, cv } from '../opencv';
import type { Mat } from '../opencv';
import {
	activeConfig,
	ITEM_TYPE_MATCH_THRESHOLD,
	ICON_COLOR_RGB,
	ICON_COLOR_DELTA_MAX,
	ICON_PRESENCE_FRACTION,
} from '../config';
import type { ResolutionConfig } from '../config';
import type { SlotRect, SlotResult } from './slots';

// Pure-JS scan of the ROI's raw RGBA pixels. Counts how many are within
// ICON_COLOR_DELTA_MAX of the cream icon glyph color (#f9eedf), measured
// as sum of absolute per-channel deltas. Pure JS (no OpenCV crossing)
// because for empty slots this needs to be the *only* per-slot cost
// before bailing — we want to skip Mat allocation, cvtColor, and the
// matchTemplate loop entirely.
function countIconPixels(data: Uint8ClampedArray): number {
	const [tr, tg, tb] = ICON_COLOR_RGB;
	let count = 0;
	for (let i = 0; i < data.length; i += 4) {
		const d =
			Math.abs(data[i] - tr) +
			Math.abs(data[i + 1] - tg) +
			Math.abs(data[i + 2] - tb);
		if (d <= ICON_COLOR_DELTA_MAX) count++;
	}
	return count;
}

const typeTemplates = new Map<string, Mat>(); // typeName -> grayscale Mat
let _loadedForConfig: ResolutionConfig | null = null;
let _loadedPromise: Promise<void> | null = null;

function loadOneTypeTemplate(name: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const img = new Image();
		img.src = `${activeConfig.itemTypesDir}/${name}.png`;
		img.onerror = () =>
			reject(new Error(`Failed to load item type template: ${name}`));
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) return reject(new Error('itemTypes: 2D context unavailable'));
			ctx.drawImage(img, 0, 0);
			const imageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

			const rgba = cv.matFromImageData(imageData);
			const gray = new cv.Mat();
			cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
			rgba.delete();

			// EXPERIMENTAL: Soften cream strokes at the sub-pixel level
			// so a 1-px phase shift between ROI and template doesn't
			// collapse TM_CCOEFF_NORMED. Kernel and sigma must match
			// the ROI blur in matchItemTypes below.
			const blurred = new cv.Mat();
			cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0.7, 0.7, cv.BORDER_DEFAULT);
			gray.delete();

			typeTemplates.set(name, blurred);
			resolve();
		};
	});
}

export async function loadItemTypeTemplates(): Promise<void> {
	if (_loadedForConfig === activeConfig && _loadedPromise) {
		console.log(
			'[itemTypes] loadItemTypeTemplates: already loaded for active config, reusing promise',
		);
		return _loadedPromise;
	}

	for (const mat of typeTemplates.values()) mat.delete();
	typeTemplates.clear();
	_loadedForConfig = activeConfig;

	_loadedPromise = getCv()
		.then(async () => {
			const dir = activeConfig.itemTypesDir.replace(/^\//, '');
			const res = await fetch(`/api/list-items?dir=${encodeURIComponent(dir)}`);
			const names: string[] = await res.json();
			await Promise.all(names.map(loadOneTypeTemplate));
			console.log(`[itemTypes] ${typeTemplates.size} templates ready`);
		})
		.catch((err: unknown) => {
			_loadedForConfig = null;
			_loadedPromise = null;
			return Promise.reject(err);
		});

	return _loadedPromise;
}

// Primary empty-vs-filled gate. Every real item in the game renders an
// item-type icon in the slot's bottom-left corner, so if matchTemplate
// fails to score above ITEM_TYPE_MATCH_THRESHOLD the slot is empty and we
// can short-circuit the rest of the pipeline (crop, rarity pixel read,
// quantity OCR, item-template match). Input is the raw SlotRect layout;
// output is a SlotResult[][] carrying just {x, y, itemType?} — later
// stages layer on src/color/rarity/quantity/itemName.
export async function matchItemTypes(
	groupedSlots: SlotRect[][],
	sourceCanvas: HTMLCanvasElement,
): Promise<SlotResult[][]> {
	await loadItemTypeTemplates();
	if (typeTemplates.size === 0) {
		console.log(
			'[itemTypes] matchItemTypes: no type templates loaded, returning empty slot results',
		);
		return groupedSlots.map((group) => group.map((s) => ({ x: s.x, y: s.y })));
	}

	const ctx = sourceCanvas.getContext('2d');
	if (!ctx) throw new Error('matchItemTypes: 2D context unavailable');
	const {
		ICON_ROI_OFFSET_X,
		ICON_ROI_OFFSET_Y_FROM_BOTTOM,
		ICON_ROI_W,
		ICON_ROI_H,
		SLOT_H,
	} = activeConfig;

	// Tight bottom-left ROI sized to where the cream icon glyph
	// actually renders. Geometry is per-resolution in ResolutionConfig
	// (see ICON_ROI_* fields) rather than fractional, so 1080p / 4K
	// can be tuned independently from 1440p without recomputing
	// percentages.
	const roiX = ICON_ROI_OFFSET_X;
	const roiY = SLOT_H - ICON_ROI_OFFSET_Y_FROM_BOTTOM - ICON_ROI_H;
	const roiW = ICON_ROI_W;
	const roiH = ICON_ROI_H;
	const totalPixels = roiW * roiH;

	return groupedSlots.map((group) =>
		group.map((s): SlotResult => {
			const imageData = ctx.getImageData(
				s.x + roiX,
				s.y + roiY,
				roiW,
				roiH,
			);

			// Presence pre-filter: a pure-JS pixel scan that gates the
			// far more expensive matchTemplate loop below. Empty slots
			// reliably produce ~0 cream pixels and short-circuit here,
			// avoiding Mat allocation, cvtColor, and N matchTemplate
			// calls per empty slot.
			const iconPixelCount = countIconPixels(imageData.data);
			const iconPresent =
				iconPixelCount / totalPixels >= ICON_PRESENCE_FRACTION;

			const base: SlotResult = {
				x: s.x,
				y: s.y,
				iconPixelCount,
				iconRoiTotalPixels: totalPixels,
				iconPresent,
			};

			if (!iconPresent) return base;

			const rgba = cv.matFromImageData(imageData);
			const gray = new cv.Mat();
			cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
			rgba.delete();

			// EXPERIMENTAL: Same blur as applied to templates at load
			// time. Blurring both sides lets matchTemplate tolerate
			// sub-pixel phase differences between where the cream glyph
			// lands in the captured ROI vs. the reference crop.
			cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0.7, 0.7, cv.BORDER_DEFAULT);

			let bestName: string | null = null;
			let bestScore = -Infinity;

			try {
				for (const [name, tmpl] of typeTemplates) {
					// Unlike the item-template stage we only require the
					// template to *fit* inside the ROI, not to match it
					// exactly: type icons are smaller than the ROI and
					// may vary slightly in size between rarities. Skip
					// any template that would be larger than the ROI,
					// since matchTemplate would otherwise throw.
					if (tmpl.rows > gray.rows || tmpl.cols > gray.cols) continue;
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

			// Always record the best match + score so the UI can surface
			// the top candidate for debugging even when it falls below
			// ITEM_TYPE_MATCH_THRESHOLD.
			if (bestName !== null && Number.isFinite(bestScore)) {
				base.itemTypeBest = bestName;
				base.itemTypeBestScore = Math.round(bestScore * 100) / 100;
			}
			if (bestScore >= ITEM_TYPE_MATCH_THRESHOLD && bestName !== null) {
				base.itemType = bestName;
			}
			return base;
		}),
	);
}
