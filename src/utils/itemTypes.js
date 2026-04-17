import { getCv, cv } from '../opencv.js';
import { activeConfig } from '../config';

const TYPE_MATCH_THRESHOLD = 0.70;

const typeTemplates = new Map(); // typeName -> grayscale Mat
let _loadedForConfig = null;
let _loadedPromise = null;

function loadOneTypeTemplate(name) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.src = `${activeConfig.itemTypesDir}/${name}.png`;
		img.onerror = () => reject(new Error(`Failed to load item type template: ${name}`));
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

			typeTemplates.set(name, gray);
			resolve();
		};
	});
}

export async function loadItemTypeTemplates() {
	if (_loadedForConfig === activeConfig) return _loadedPromise;

	for (const mat of typeTemplates.values()) mat.delete();
	typeTemplates.clear();
	_loadedForConfig = activeConfig;

	_loadedPromise = getCv().then(async () => {
		const dir = activeConfig.itemTypesDir.replace(/^\//, '');
		const res = await fetch(`/api/list-items?dir=${encodeURIComponent(dir)}`);
		const names = await res.json();
		await Promise.all(names.map(loadOneTypeTemplate));
		console.log(`[itemTypes] ${typeTemplates.size} templates ready`);
	}).catch((err) => {
		_loadedForConfig = null;
		_loadedPromise = null;
		return Promise.reject(err);
	});

	return _loadedPromise;
}

export async function matchItemTypes(groupedResults, sourceCanvas) {
	await loadItemTypeTemplates();
	if (typeTemplates.size === 0) return groupedResults;

	const ctx = sourceCanvas.getContext('2d');
	const { SLOT_W, SLOT_H } = activeConfig;

	const roiX = 0;
	const roiY = Math.round(SLOT_H * 0.75);
	const roiW = Math.round(SLOT_W * 0.25);
	const roiH = SLOT_H - roiY;

	return groupedResults.map((group) =>
		group.map((slot) => {
			if (slot.rarity.startsWith('empty')) return slot;

			const imageData = ctx.getImageData(slot.x + roiX, slot.y + roiY, roiW, roiH);
			const rgba = cv.matFromImageData(imageData);
			const gray = new cv.Mat();
			cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
			rgba.delete();

			let bestName = null;
			let bestScore = -Infinity;

			try {
				for (const [name, tmpl] of typeTemplates) {
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

			if (bestScore >= TYPE_MATCH_THRESHOLD) {
				return { ...slot, itemType: bestName };
			}
			return slot;
		}),
	);
}
