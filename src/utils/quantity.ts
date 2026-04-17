import { getCv, cv } from '../opencv';
import type { Mat } from '../opencv';
import {
	activeConfig,
	QUANTITY_BINARIZE_THRESHOLD,
	QUANTITY_MATCH_THRESHOLD,
	QUANTITY_OVERLAP_TOLERANCE,
	QUANTITY_CHARS,
} from '../config';
import type { ResolutionConfig, QuantityChar } from '../config';
import type { SlotResult } from './slots';

type Peak = { char: QuantityChar; x: number; y: number; score: number };

const templates = new Map<QuantityChar, Mat>();
let _loadedForConfig: ResolutionConfig | null = null;
let _loaded: Promise<void> | null = null;

function loadOneTemplate(char: QuantityChar): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const img = new Image();
		const src = `${activeConfig.digitsDir}/${char}.png`;
		img.src = src;
		img.onerror = () => reject(new Error(`Failed to load digit template: ${src}`));
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) return reject(new Error('quantity: 2D context unavailable'));
			ctx.drawImage(img, 0, 0);
			const imageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

			const rgba = cv.matFromImageData(imageData);
			const gray = new cv.Mat();
			const bw = new cv.Mat();
			cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
			cv.threshold(gray, bw, QUANTITY_BINARIZE_THRESHOLD, 255, cv.THRESH_BINARY);
			rgba.delete();
			gray.delete();

			templates.set(char, bw);
			resolve();
		};
	});
}

export async function loadQuantityTemplates(): Promise<void> {
	if (_loadedForConfig === activeConfig && _loaded) {
		console.log('[quantity] loadQuantityTemplates: already loaded for active config, reusing promise');
		return _loaded;
	}

	for (const mat of templates.values()) mat.delete();
	templates.clear();

	_loadedForConfig = activeConfig;
	await getCv();

	_loaded = Promise.all(QUANTITY_CHARS.map(loadOneTemplate))
		.then(() => {
			console.log('[quantity] templates ready:', QUANTITY_CHARS.join(','));
		})
		.catch((err: unknown) => {
			_loadedForConfig = null;
			_loaded = null;
			return Promise.reject(err);
		});
	return _loaded;
}

// Find every occurrence of a single digit/anchor template in the binarized
// ROI. A standard matchTemplate gives one correlation map; we repeatedly
// take its argmax and zero out a template-sized window around it so the
// next iteration surfaces the next-best (spatially distinct) match. This
// "iterative peak extraction" is cheaper than running matchTemplate N
// times and naturally handles digits that repeat within a stack label
// (e.g. "x11", "x22").
function findPeaks(roiBw: Mat, tmpl: Mat, char: QuantityChar): Peak[] {
	const result = new cv.Mat();
	const peaks: Peak[] = [];
	try {
		cv.matchTemplate(roiBw, tmpl, result, cv.TM_CCOEFF_NORMED);

		const tw = tmpl.cols;
		const th = tmpl.rows;

		while (true) {
			const { maxVal, maxLoc } = cv.minMaxLoc(result);
			if (maxVal < QUANTITY_MATCH_THRESHOLD) {
				// No more peaks above threshold for this char — break ends the scan loop early
				break;
			}
			peaks.push({ char, x: maxLoc.x, y: maxLoc.y, score: maxVal });

			// Suppress a window around the just-accepted peak in result-space so
			// the next minMaxLoc finds a different character occurrence.
			const sx = Math.max(0, maxLoc.x - Math.floor(tw / 2));
			const sy = Math.max(0, maxLoc.y - Math.floor(th / 2));
			const ex = Math.min(result.cols, maxLoc.x + Math.ceil(tw / 2));
			const ey = Math.min(result.rows, maxLoc.y + Math.ceil(th / 2));
			const rect = new cv.Rect(sx, sy, ex - sx, ey - sy);
			const sub = result.roi(rect);
			sub.setTo(new cv.Scalar(0));
			sub.delete();
		}
	} finally {
		result.delete();
	}
	return peaks;
}

// Peaks from different characters can fire on the same glyph (e.g. a '3'
// template scoring well on an '8'). We resolve these conflicts greedily
// by score: walk peaks highest-first, accept each one, and reject any
// later peak whose horizontal span overlaps an accepted peak by more
// than QUANTITY_OVERLAP_TOLERANCE of the narrower glyph. Overlap is
// computed in 1-D (x only) because digits in the HUD label are always
// laid out on the same baseline.
function nonMaxSuppress(peaks: Peak[]): Peak[] {
	const sorted = [...peaks].sort((a, b) => b.score - a.score);
	const accepted: Peak[] = [];

	for (const p of sorted) {
		const tw = templates.get(p.char)!.cols;
		const aStart = p.x;
		const aEnd = p.x + tw;

		let conflict = false;
		for (const acc of accepted) {
			const accW = templates.get(acc.char)!.cols;
			const bStart = acc.x;
			const bEnd = acc.x + accW;
			const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
			const minWidth = Math.min(tw, accW);
			if (overlap / minWidth > QUANTITY_OVERLAP_TOLERANCE) {
				conflict = true;
				break;
			}
		}
		if (!conflict) accepted.push(p);
	}

	return accepted;
}

type QuantityResult = {
	quantity: number | null;
	quantityScore: number | null;
	// Always populated when at least one peak was found. Lets the
	// debug UI show "what did OCR see?" for slots whose label failed
	// one of the validity gates (missing 'x' anchor, too many digits,
	// NaN parse, etc.).
	quantityBest: string | null;
	quantityBestScore: number | null;
};

// Requires templates to already be loaded.
function detectQuantityFromCtx(
	ctx: CanvasRenderingContext2D,
	slotX: number,
	slotY: number,
): QuantityResult {
	// Quantity label ("x12" / "x 5" / etc.) is drawn in the bottom-right
	// corner of a slot. ROI_W/ROI_H crop just that corner so matchTemplate
	// doesn't waste work on item art above.
	const { SLOT_W, SLOT_H, ROI_W, ROI_H } = activeConfig;
	const roiX = slotX + SLOT_W - ROI_W;
	const roiY = slotY + SLOT_H - ROI_H;
	const imageData = ctx.getImageData(roiX, roiY, ROI_W, ROI_H);

	const rgba = cv.matFromImageData(imageData);
	const gray = new cv.Mat();
	const bw = new cv.Mat();

	try {
		// Binarize on a bright threshold: the label is near-white against a
		// dark/semi-transparent background, so a simple fixed threshold
		// isolates glyph strokes from slot art with minimal noise.
		cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
		cv.threshold(gray, bw, QUANTITY_BINARIZE_THRESHOLD, 255, cv.THRESH_BINARY);

		const allPeaks: Peak[] = [];
		for (const char of QUANTITY_CHARS) {
			allPeaks.push(...findPeaks(bw, templates.get(char)!, char));
		}

		if (allPeaks.length === 0) {
			console.log(`[quantity] detectQuantity @(${slotX},${slotY}): no peaks found above MATCH_THRESHOLD=${QUANTITY_MATCH_THRESHOLD}, no quantity detected`);
			return {
				quantity: null,
				quantityScore: null,
				quantityBest: null,
				quantityBestScore: null,
			};
		}

		const accepted = nonMaxSuppress(allPeaks).sort((a, b) => a.x - b.x);

		// Debug attempt: raw left-to-right concatenation of accepted
		// peaks, regardless of whether the label eventually validates
		// as a real "x<digits>" stack count. Confidence mirrors the
		// real path — min of peak scores — so the UI can show the
		// weakest glyph as the label's confidence.
		const bestText = accepted.map((p) => p.char).join('');
		const bestMin = accepted.reduce((m, p) => Math.min(m, p.score), 1);
		const bestScoreRounded = Math.round(bestMin * 100) / 100;

		// The game always renders the label as "x<digits>". Requiring 'x'
		// as the leftmost accepted peak acts as an anchor: it rejects
		// stray digit-shaped artifacts (item art, shield icons, etc.)
		// that happen to light up a single digit template but aren't a
		// real quantity label. It also tells us where the digits start.
		if (accepted.length < 2 || accepted[0].char !== 'x') {
			console.log(`[quantity] detectQuantity @(${slotX},${slotY}): leftmost peak is "${accepted[0]?.char}" (need "x"), or only ${accepted.length} peak(s) (need >=2)`);
			return {
				quantity: null,
				quantityScore: null,
				quantityBest: bestText,
				quantityBestScore: bestScoreRounded,
			};
		}

		const digits = accepted.slice(1);
		if (digits.length > 3) {
			console.log(`[quantity] detectQuantity @(${slotX},${slotY}): found ${digits.length} digits, more than max of 3, bailing`);
			return {
				quantity: null,
				quantityScore: null,
				quantityBest: bestText,
				quantityBestScore: bestScoreRounded,
			};
		}

		const text = digits.map((p) => p.char).join('');
		const quantity = parseInt(text, 10);
		if (Number.isNaN(quantity)) {
			console.log(`[quantity] detectQuantity @(${slotX},${slotY}): parseInt("${text}") is NaN, bailing`);
			return {
				quantity: null,
				quantityScore: null,
				quantityBest: bestText,
				quantityBestScore: bestScoreRounded,
			};
		}

		// Report the weakest peak as the label's confidence: a label is
		// only as trustworthy as its worst-matching glyph, so taking the
		// min avoids a confident 'x' masking a shaky digit.
		const quantityScore = bestScoreRounded;

		return {
			quantity,
			quantityScore,
			quantityBest: bestText,
			quantityBestScore: bestScoreRounded,
		};
	} finally {
		rgba.delete();
		gray.delete();
		bw.delete();
	}
}

export async function detectQuantity(
	ctx: CanvasRenderingContext2D,
	slotX: number,
	slotY: number,
): Promise<QuantityResult> {
	await loadQuantityTemplates();
	return detectQuantityFromCtx(ctx, slotX, slotY);
}

export async function applyQuantities(
	groupedResults: SlotResult[][],
	sourceCanvas: HTMLCanvasElement,
): Promise<SlotResult[][]> {
	await loadQuantityTemplates();

	const ctx = sourceCanvas.getContext('2d');
	if (!ctx) throw new Error('applyQuantities: 2D context unavailable');

	return groupedResults.map((group) =>
		group.map((slot): SlotResult => {
			// Empty slots (no item-type icon) have no stack label — skip
			// OCR entirely rather than scan an empty background.
			if (!slot.itemType) return slot;

			// Blueprint slots never render a stack label (a blueprint is
			// intrinsically a single item), so skip the OCR pass and
			// hard-code 1 — running detection here would only produce
			// false positives from the decorative border art.
			if (slot.itemType === 'blueprint') {
				console.log(`[quantity] skip slot @(${slot.x},${slot.y}): itemType is blueprint, hard-coding quantity=1`);
				return {
					...slot,
					quantity: 1,
					quantityScore: null,
					quantityBest: 'x1',
					quantityBestScore: null,
				};
			}
			return { ...slot, ...detectQuantityFromCtx(ctx, slot.x, slot.y) };
		}),
	);
}
