import { getCv, cv } from '../opencv.js';
import { activeConfig } from '../config';

const MATCH_THRESHOLD = 0.85;             // TM_CCOEFF_NORMED; true positive ~0.99, nearest false ~0.74

let templateMat = null;
let _loadedForConfig = null;
let _loadedPromise = null;

export async function loadAmmoTemplate() {
	if (_loadedForConfig === activeConfig) return _loadedPromise;

	if (templateMat) {
		templateMat.delete();
		templateMat = null;
	}

	_loadedForConfig = activeConfig;
	_loadedPromise = getCv().then(() => new Promise((resolve, reject) => {
		const img = new Image();
		img.src = activeConfig.ammoTemplateSrc;
		img.onerror = () => {
			_loadedForConfig = null;
			_loadedPromise = null;
			reject(new Error(`Failed to load ammo template: ${activeConfig.ammoTemplateSrc}`));
		};
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			canvas.getContext('2d').drawImage(img, 0, 0);
			const imageData = canvas.getContext('2d').getImageData(0, 0, img.naturalWidth, img.naturalHeight);

			const rgba = cv.matFromImageData(imageData);
			templateMat = new cv.Mat();
			cv.cvtColor(rgba, templateMat, cv.COLOR_RGBA2GRAY);
			rgba.delete();

			console.log('[ammo] templateMat ready, size:', templateMat.rows, 'x', templateMat.cols);
			resolve();
		};
	}));

	return _loadedPromise;
}

export async function matchLightAmmo(groupedResults, sourceCanvas) {
	await loadAmmoTemplate();
	const ctx = sourceCanvas.getContext('2d');

	return groupedResults.map((group) =>
		group.map((slot) => {
			if (!slot.rarity.startsWith('empty')) return slot;

			const { SLOT_W, EFFECTIVE_H } = activeConfig;
			const imageData = ctx.getImageData(slot.x, slot.y, SLOT_W, EFFECTIVE_H);
			const rgba = cv.matFromImageData(imageData);
			const gray = new cv.Mat();
			const result = new cv.Mat();
			try {
				cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
				cv.matchTemplate(gray, templateMat, result, cv.TM_CCOEFF_NORMED);
				const { maxVal } = cv.minMaxLoc(result);
				const score = Math.round(maxVal * 100) / 100;
				if (maxVal >= MATCH_THRESHOLD) {
					return { ...slot, rarity: 'Light Ammo', color: '#FFD700', matchScore: score };
				}
				return { ...slot, matchScore: score };
			} finally {
				rgba.delete();
				gray.delete();
				result.delete();
			}
		}),
	);
}
