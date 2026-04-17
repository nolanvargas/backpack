import { getCv, cv } from '../opencv.js';
import { activeConfig } from '../config';
import rawCsv from '../../data.csv?raw';

// Quote-aware CSV split so "1,000" sell prices don't shift columns
function splitCsvRow(line) {
	const cols = [];
	let cur = '';
	let inQuote = false;
	for (const ch of line) {
		if (ch === '"') { inQuote = !inQuote; }
		else if (ch === ',' && !inQuote) { cols.push(cur); cur = ''; }
		else { cur += ch; }
	}
	cols.push(cur);
	return cols;
}

const categoryByItem = new Map();
rawCsv.split('\n').slice(1).forEach((line) => {
	if (!line.trim()) return;
	const cols = splitCsvRow(line);
	const name = cols[0]?.trim();
	const category = cols[5]?.trim();
	if (name && category) categoryByItem.set(name, category);
});

const MATCH_THRESHOLD = 0.80;

const templates = new Map(); // itemName -> grayscale Mat
let _loadedForConfig = null;
let _loadedPromise = null;

function loadOneTemplate(name) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.src = `${activeConfig.itemsDir}/${name}.png`;
		img.onerror = () => reject(new Error(`Failed to load item template: ${name}`));
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			canvas.getContext('2d').drawImage(img, 0, 0);
			const imageData = canvas.getContext('2d').getImageData(0, 0, img.naturalWidth, img.naturalHeight);

			const rgba = cv.matFromImageData(imageData);
			const gray = new cv.Mat();
			cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
			rgba.delete();

			templates.set(name, gray);
			resolve();
		};
	});
}

export async function loadItemTemplates() {
	if (_loadedForConfig === activeConfig) return _loadedPromise;

	for (const mat of templates.values()) mat.delete();
	templates.clear();
	_loadedForConfig = activeConfig;

	_loadedPromise = getCv().then(async () => {
		const dir = activeConfig.itemsDir.replace(/^\//, '');
		const res = await fetch(`/api/list-items?dir=${encodeURIComponent(dir)}`);
		const names = await res.json();
		await Promise.all(names.map(loadOneTemplate));
		console.log(`[items] ${templates.size} templates ready`);
	}).catch((err) => {
		_loadedForConfig = null;
		_loadedPromise = null;
		return Promise.reject(err);
	});

	return _loadedPromise;
}

export async function matchItems(groupedResults, sourceCanvas) {
	await loadItemTemplates();
	if (templates.size === 0) return groupedResults;

	const ctx = sourceCanvas.getContext('2d');
	const { SLOT_W, EFFECTIVE_H } = activeConfig;

	return groupedResults.map((group) =>
		group.map((slot) => {
			if (slot.rarity.startsWith('empty')) return slot;

			const imageData = ctx.getImageData(slot.x, slot.y, SLOT_W, EFFECTIVE_H);
			const rgba = cv.matFromImageData(imageData);
			const gray = new cv.Mat();
			cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
			rgba.delete();

			let bestName = null;
			let bestScore = -Infinity;

			const allowed = slot.itemType
				? new Set([...templates.keys()].filter((n) => categoryByItem.get(n) === slot.itemType))
				: null;

			try {
				for (const [name, tmpl] of templates) {
					if (allowed && !allowed.has(name)) continue;
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

			if (bestScore >= MATCH_THRESHOLD) {
				return { ...slot, itemName: bestName, itemScore: Math.round(bestScore * 100) / 100 };
			}
			return slot;
		}),
	);
}
