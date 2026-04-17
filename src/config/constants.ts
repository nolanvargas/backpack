// ===== Runtime / UI =====
export const AUTO_CAPTURE_INTERVAL_MS = 2000;

// ===== Template match thresholds (TM_CCOEFF_NORMED, range 0..1) =====
export const INVENTORY_MATCH_THRESHOLD = 0.8;
export const ITEM_MATCH_THRESHOLD = 0.8;
export const ITEM_TYPE_MATCH_THRESHOLD = 0.7;
export const QUANTITY_MATCH_THRESHOLD = 0.8;

// ===== Item-type icon presence pre-filter =====
// The cream icon glyph (#f9eedf) renders against a dark in the slot's
// bottom-left corner. A pure-JS scan of that
// ROI counting near-target pixels gates the (much more expensive)
// matchTemplate stage: empty slots reliably show ~0 cream pixels and
// can be short-circuited entirely. Tune DELTA / FRACTION from the
// rendered debug overlay if real items start getting filtered out.
export const ICON_COLOR_RGB = [0xf9, 0xee, 0xdf] as const;
export const ICON_COLOR_DELTA_MAX = 30;
export const ICON_PRESENCE_FRACTION = 0.04;

// ===== Quantity (digit) detection =====
export const QUANTITY_BINARIZE_THRESHOLD = 180;
export const QUANTITY_OVERLAP_TOLERANCE = 0.5;
export const QUANTITY_CHARS = [
	'x',
	'0',
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
] as const;
export type QuantityChar = (typeof QUANTITY_CHARS)[number];

// ===== Item values =====
export const BLUEPRINT_VALUE = 5000;

// ===== Rarity classification (pixel-color thresholds) =====
// No `empty` entry: emptiness is determined by the item-type icon stage,
// not by sampling the border pixel. These thresholds only need to
// distinguish between the five real rarities on slots we already know
// contain an item.
export const RARITY_COLOR_THRESHOLDS = {
	rare: { minB: 140, minG: 120, maxR: 120, bLeadsRBy: 60 },
	uncommon: { minG: 140, gLeadsRBy: 60, gLeadsBBy: 40 },
	epic: { minR: 140, minB: 100, rLeadsGBy: 40 },
	legendary: { minR: 150, minG: 130, maxB: 100 },
	common: { maxDelta: 30, minR: 80 },
} as const;

// ===== Rarity display =====
export const RARITY_ORDER = [
	'Common',
	'Uncommon',
	'Rare',
	'Epic',
	'Legendary',
] as const;

export const RARITY_COLORS: Record<string, string> = {
	Common: '#888',
	Uncommon: '#3a3',
	Rare: '#38b',
	Epic: '#90f',
	Legendary: '#f80',
};

// ===== Region display =====
export const REGION_NAMES = [
	'Container',
	'Backpack',
	'Quick Use',
	'Augmented',
	'Safe Pocket',
] as const;
