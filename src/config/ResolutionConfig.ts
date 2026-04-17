export type RegionDef = {
	x: number;
	y: number;
	cols: number;
	rows: number;
};

export type ResolutionConfigOptions = {
	regions: RegionDef[];
	slotW: number;
	slotH: number;
	gapX: number;
	gapY: number;
	sampleOffsetX: number;
	sampleOffsetYFromBottom: number;
	roiW: number;
	roiH: number;
	overlayH: number;
	iconRoiOffsetX: number;
	iconRoiOffsetYFromBottom: number;
	iconRoiW: number;
	iconRoiH: number;
	digitsDir: string;
	itemsDir: string;
	itemTypesDir: string;
	inventorySrc?: string;
	inventoryX?: number;
	inventoryY?: number;
	inventoryW?: number;
	inventoryH?: number;
};

export class ResolutionConfig {
	regions: RegionDef[];
	SLOT_W: number;
	SLOT_H: number;
	GAP_X: number;
	GAP_Y: number;
	SAMPLE_OFFSET_X: number;
	SAMPLE_OFFSET_Y_FROM_BOTTOM: number;
	ROI_W: number;
	ROI_H: number;
	OVERLAY_H: number;
	// Item-type icon presence-check / matchTemplate ROI: a tight
	// rectangle in the slot's bottom-left corner where the cream-
	// colored type icon renders. Stored per-resolution so the offsets
	// can be tuned independently if a resolution's UI scaling drifts
	// from the 1440p-derived defaults.
	ICON_ROI_OFFSET_X: number;
	ICON_ROI_OFFSET_Y_FROM_BOTTOM: number;
	ICON_ROI_W: number;
	ICON_ROI_H: number;
	digitsDir: string;
	itemsDir: string;
	itemTypesDir: string;
	inventorySrc: string;
	inventoryX: number;
	inventoryY: number;
	inventoryW: number;
	inventoryH: number;

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
		iconRoiOffsetX,
		iconRoiOffsetYFromBottom,
		iconRoiW,
		iconRoiH,
		digitsDir,
		itemsDir,
		itemTypesDir,
		inventorySrc,
		inventoryX,
		inventoryY,
		inventoryW,
		inventoryH,
	}: ResolutionConfigOptions) {
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
		this.ICON_ROI_OFFSET_X = iconRoiOffsetX;
		this.ICON_ROI_OFFSET_Y_FROM_BOTTOM = iconRoiOffsetYFromBottom;
		this.ICON_ROI_W = iconRoiW;
		this.ICON_ROI_H = iconRoiH;
		this.digitsDir = digitsDir;
		this.itemsDir = itemsDir;
		this.itemTypesDir = itemTypesDir;
		this.inventorySrc = inventorySrc ?? '';
		this.inventoryX = inventoryX ?? 0;
		this.inventoryY = inventoryY ?? 0;
		this.inventoryW = inventoryW ?? 0;
		this.inventoryH = inventoryH ?? 0;
	}

	get EFFECTIVE_H(): number {
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
			iconRoiOffsetX: 4,
			iconRoiOffsetYFromBottom: 4,
			iconRoiW: 19,
			iconRoiH: 19,
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
			overlayH: 3,
			iconRoiOffsetX: 4,
			iconRoiOffsetYFromBottom: 4,
			iconRoiW: 30,
			iconRoiH: 30,
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
			iconRoiOffsetX: 8,
			iconRoiOffsetYFromBottom: 8,
			iconRoiW: 38,
			iconRoiH: 38,
			digitsDir: '/2160/digits',
			itemsDir: '/2160/items',
			itemTypesDir: '/2160/item_types',
		});
	}
}
