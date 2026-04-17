import { getCv, cv } from '../opencv.js';
import { activeConfig } from '../config';

const MATCH_THRESHOLD = 0.80;

let templateMat = null;
let _loadedForSrc = null;

export async function loadInventoryTemplate() {
	const { inventorySrc } = activeConfig;
	if (!inventorySrc) return;
	if (_loadedForSrc === inventorySrc) return;

	if (templateMat) {
		templateMat.delete();
		templateMat = null;
	}

	_loadedForSrc = inventorySrc;

	await getCv();
	await new Promise((resolve, reject) => {
		const img = new Image();
		img.src = inventorySrc;
		img.onerror = () => { _loadedForSrc = null; reject(new Error(`Failed to load inventory template: ${inventorySrc}`)); };
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
			resolve();
		};
	});
}

export async function isInventoryView(sourceCanvas) {
	const { inventorySrc, inventoryX, inventoryY, inventoryW, inventoryH } = activeConfig;
	if (!inventorySrc) return { match: true, score: 1, regionCanvas: null };

	await loadInventoryTemplate();

	const imageData = sourceCanvas.getContext('2d').getImageData(inventoryX, inventoryY, inventoryW, inventoryH);

	const regionCanvas = document.createElement('canvas');
	regionCanvas.width = inventoryW;
	regionCanvas.height = inventoryH;
	regionCanvas.getContext('2d').putImageData(imageData, 0, 0);

	const rgba = cv.matFromImageData(imageData);
	const gray = new cv.Mat();
	const result = new cv.Mat();
	try {
		cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
		cv.matchTemplate(gray, templateMat, result, cv.TM_CCOEFF_NORMED);
		const { maxVal } = cv.minMaxLoc(result);
		const score = Math.round(maxVal * 100) / 100;
		return { match: maxVal >= MATCH_THRESHOLD, score, regionCanvas };
	} finally {
		rgba.delete();
		gray.delete();
		result.delete();
	}
}
