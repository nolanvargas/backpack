// Thresholds for rarity classification
export const THRESHOLDS = {
	empty: { maxR: 90, maxG: 90, maxB: 100 },
	rare: { minB: 140, minG: 120, maxR: 120, bLeadsRBy: 60 },
	uncommon: { minG: 140, gLeadsRBy: 60, gLeadsBBy: 40 },
	epic: { minR: 140, minB: 100, rLeadsGBy: 40 },
	legendary: { minR: 150, minG: 130, maxB: 100 },
	common: { maxDelta: 30, minR: 80 },
	blueprints: { minR: 12, maxR: 50, minG: 29, maxG: 60, minB: 73 },
};
