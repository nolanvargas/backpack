export class ResolutionConfig {
	constructor({
		regions,
		slotW,
		slotH,
		gapX,
		gapY,
		sampleOffsetX,
		sampleOffsetYFromBottom,
		roiW,
		roiH,
		overlayH,
		ammoTemplateSrc,
		digitsDir,
		itemsDir,
		itemTypesDir,
		inventorySrc = null,
		inventoryX = null,
		inventoryY = null,
		inventoryW = null,
		inventoryH = null,
	}) {
		this.regions = regions;
		this.SLOT_W = slotW;
		this.SLOT_H = slotH;
		this.GAP_X = gapX;
		this.GAP_Y = gapY;
		this.SAMPLE_OFFSET_X = sampleOffsetX;
		this.SAMPLE_OFFSET_Y_FROM_BOTTOM = sampleOffsetYFromBottom;
		this.ROI_W = roiW;
		this.ROI_H = roiH;
		this.OVERLAY_H = overlayH;
		this.ammoTemplateSrc = ammoTemplateSrc;
		this.digitsDir = digitsDir;
		this.itemsDir = itemsDir;
		this.itemTypesDir = itemTypesDir;
		this.inventorySrc = inventorySrc;
		this.inventoryX = inventoryX;
		this.inventoryY = inventoryY;
		this.inventoryW = inventoryW;
		this.inventoryH = inventoryH;
	}

	get EFFECTIVE_H() {
		return this.SLOT_H - this.OVERLAY_H;
	}
}

export class Config1080p extends ResolutionConfig {
	constructor() {
		super({
			regions: [
				{ x: 158, y: 295, cols: 4, rows: 3 }, // CONTAINER
				{ x: 998, y: 296, cols: 4, rows: 6 }, // BACKPACK
				{ x: 1458, y: 296, cols: 3, rows: 2 }, // QUICK USE
				{ x: 1458, y: 567, cols: 3, rows: 1 }, // AUGMENTED
				{ x: 1458, y: 735, cols: 3, rows: 1 }, // SAFE
			],
			slotW: 96,
			slotH: 96,
			gapX: 8,
			gapY: 8,
			sampleOffsetX: 5,
			sampleOffsetYFromBottom: 30,
			roiW: 40,
			roiH: 24,
			overlayH: 24,
			ammoTemplateSrc: '/1080/light_ammo_screenshot.png',
			digitsDir: '/1080/digits',
			itemsDir: '/1080/items',
			itemTypesDir: '/1080/item_types',
		});
	}
}

// Values are scaled from 1080p (×4/3) and need in-game verification.
export class Config1440p extends ResolutionConfig {
	constructor() {
		super({
			regions: [
				{ x: 211, y: 394, cols: 4, rows: 3 }, // CONTAINER
				{ x: 1331, y: 395, cols: 4, rows: 6 }, // BACKPACK
				{ x: 1944, y: 395, cols: 3, rows: 2 }, // QUICK USE
				{ x: 1944, y: 757, cols: 3, rows: 1 }, // AUGMENTED
				{ x: 1944, y: 981, cols: 3, rows: 1 }, // SAFE
			],
			inventorySrc: '/1440/inventory.png',
			inventoryX: 973,
			inventoryY: 261,
			inventoryW: 30,
			inventoryH: 30,
			slotW: 128,
			slotH: 128,
			gapX: 11,
			gapY: 11,
			sampleOffsetX: 7,
			sampleOffsetYFromBottom: 40,
			roiW: 53,
			roiH: 32,
			overlayH: 32,
			ammoTemplateSrc: '/1440/light_ammo_screenshot.png',
			digitsDir: '/1440/digits',
			itemsDir: '/1440/items',
			itemTypesDir: '/1440/item_types',
		});
	}
}

// Values are scaled from 1080p (×2) and need in-game verification.
export class Config4K extends ResolutionConfig {
	constructor() {
		super({
			regions: [
				{ x: 316, y: 590, cols: 4, rows: 3 }, // CONTAINER
				{ x: 1996, y: 592, cols: 4, rows: 6 }, // BACKPACK
				{ x: 2916, y: 592, cols: 3, rows: 2 }, // QUICK USE
				{ x: 2916, y: 1134, cols: 3, rows: 1 }, // AUGMENTED
				{ x: 2916, y: 1470, cols: 3, rows: 1 }, // SAFE
			],
			slotW: 192,
			slotH: 192,
			gapX: 16,
			gapY: 16,
			sampleOffsetX: 10,
			sampleOffsetYFromBottom: 60,
			roiW: 80,
			roiH: 48,
			overlayH: 48,
			ammoTemplateSrc: '/2160/light_ammo_screenshot.png',
			digitsDir: '/2160/digits',
			itemsDir: '/2160/items',
			itemTypesDir: '/2160/item_types',
		});
	}
}
