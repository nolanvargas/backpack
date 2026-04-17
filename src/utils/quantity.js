import { getCv, cv } from '../opencv.js';
import { activeConfig } from '../config';
const THRESH = 180;
const MATCH_THRESHOLD = 0.8;
const OVERLAP_TOLERANCE = 0.5;

const CHARS = ['x', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const templates = new Map();
let _loadedForConfig = null;
let _loaded = null;

function loadOneTemplate(char) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const src = `${activeConfig.digitsDir}/${char}.png`;
		img.src = src;
		img.onerror = () => reject(new Error(`Failed to load digit template: ${src}`));
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			canvas.getContext('2d').drawImage(img, 0, 0);
			const imageData = canvas
				.getContext('2d')
				.getImageData(0, 0, img.naturalWidth, img.naturalHeight);

			const rgba = cv.matFromImageData(imageData);
			const gray = new cv.Mat();
			const bw = new cv.Mat();
			cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
			cv.threshold(gray, bw, THRESH, 255, cv.THRESH_BINARY);
			rgba.delete();
			gray.delete();

			templates.set(char, bw);
			resolve();
		};
	});
}

export async function loadQuantityTemplates() {
	if (_loadedForConfig === activeConfig) return _loaded;

	for (const mat of templates.values()) mat.delete();
	templates.clear();

	_loadedForConfig = activeConfig;
	await getCv();

	_loaded = Promise.all(CHARS.map(loadOneTemplate)).then(() => {
		console.log('[quantity] templates ready:', CHARS.join(','));
	}).catch((err) => {
		_loadedForConfig = null;
		_loaded = null;
		return Promise.reject(err);
	});
	return _loaded;
}

function findPeaks(roiBw, tmpl, char) {
	const result = new cv.Mat();
	const peaks = [];
	try {
		cv.matchTemplate(roiBw, tmpl, result, cv.TM_CCOEFF_NORMED);

		const tw = tmpl.cols;
		const th = tmpl.rows;

		while (true) {
			const { maxVal, maxLoc } = cv.minMaxLoc(result);
			if (maxVal < MATCH_THRESHOLD) break;
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

function nonMaxSuppress(peaks) {
	const sorted = [...peaks].sort((a, b) => b.score - a.score);
	const accepted = [];

	for (const p of sorted) {
		const tw = templates.get(p.char).cols;
		const aStart = p.x;
		const aEnd = p.x + tw;

		let conflict = false;
		for (const acc of accepted) {
			const accW = templates.get(acc.char).cols;
			const bStart = acc.x;
			const bEnd = acc.x + accW;
			const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
			const minWidth = Math.min(tw, accW);
			if (overlap / minWidth > OVERLAP_TOLERANCE) {
				conflict = true;
				break;
			}
		}
		if (!conflict) accepted.push(p);
	}

	return accepted;
}

// Requires templates to already be loaded.
function detectQuantityFromCtx(ctx, slotX, slotY) {
	const { SLOT_W, SLOT_H, ROI_W, ROI_H } = activeConfig;
	const roiX = slotX + SLOT_W - ROI_W;
	const roiY = slotY + SLOT_H - ROI_H;
	const imageData = ctx.getImageData(roiX, roiY, ROI_W, ROI_H);

	const rgba = cv.matFromImageData(imageData);
	const gray = new cv.Mat();
	const bw = new cv.Mat();

	try {
		cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
		cv.threshold(gray, bw, THRESH, 255, cv.THRESH_BINARY);

		const allPeaks = [];
		for (const char of CHARS) {
			allPeaks.push(...findPeaks(bw, templates.get(char), char));
		}

		if (allPeaks.length === 0) {
			return { quantity: null, quantityScore: null };
		}

		const accepted = nonMaxSuppress(allPeaks).sort((a, b) => a.x - b.x);

		// Leftmost accepted peak must be the 'x' anchor.
		if (accepted.length < 2 || accepted[0].char !== 'x') {
			return { quantity: null, quantityScore: null };
		}

		const digits = accepted.slice(1);
		if (digits.length > 3) {
			return { quantity: null, quantityScore: null };
		}

		const text = digits.map((p) => p.char).join('');
		const quantity = parseInt(text, 10);
		if (Number.isNaN(quantity)) {
			return { quantity: null, quantityScore: null };
		}

		const minScore = accepted.reduce((m, p) => Math.min(m, p.score), 1);
		const quantityScore = Math.round(minScore * 100) / 100;

		return { quantity, quantityScore };
	} finally {
		rgba.delete();
		gray.delete();
		bw.delete();
	}
}

export async function detectQuantity(ctx, slotX, slotY) {
	await loadQuantityTemplates();
	return detectQuantityFromCtx(ctx, slotX, slotY);
}

export const BLUEPRINT_VALUE = 5000;

export async function applyQuantities(groupedResults, sourceCanvas) {
	await loadQuantityTemplates();

	const ctx = sourceCanvas.getContext('2d');

	return groupedResults.map((group) =>
		group.map((slot) => {
			if (slot.rarity === 'Blueprints') {
				return { ...slot, quantity: 1, quantityScore: null };
			}
			return { ...slot, ...detectQuantityFromCtx(ctx, slot.x, slot.y) };
		}),
	);
}
