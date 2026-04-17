import { activeConfig, RARITY_COLOR_THRESHOLDS } from '../config';

export type SlotRect = {
	x: number;
	y: number;
	w: number;
	h: number;
};

export type SlotResult = {
	x: number;
	y: number;
	// `src`, `color`, and `rarity` are only populated for non-empty slots
	// (those the item-type stage identified). Truly empty slots carry just
	// their rect position so downstream stages/UI can render a placeholder
	// without paying for a crop and pixel sample.
	src?: string;
	color?: string;
	rarity?: string;
	matchScore?: number;

	// Each CV stage exposes two parallel fields for debugging: the
	// `*Best` / `*BestScore` pair is always populated with the top
	// match from that stage regardless of whether it cleared the
	// qualifying threshold, while the un-prefixed field (`itemType`,
	// `itemName`, `quantity`) is only set when the threshold passed
	// and carries the canonical downstream semantics. UI can always
	// render the best-* pair to show confidence; pipeline logic keeps
	// reading the un-prefixed fields to gate behavior.
	itemType?: string;
	itemTypeBest?: string;
	itemTypeBestScore?: number;
	// Cream-pixel presence pre-filter — populated for every slot the
	// item-type stage scanned. The rectangle position itself comes
	// from `activeConfig`'s ICON_ROI_* fields, so the renderer can
	// place a debug overlay without each result carrying geometry.
	iconPixelCount?: number;
	iconRoiTotalPixels?: number;
	iconPresent?: boolean;

	quantity?: number | null;
	quantityScore?: number | null;
	quantityBest?: string | null;
	quantityBestScore?: number | null;

	itemName?: string;
	itemScore?: number;
	itemNameBest?: string;
	itemNameBestScore?: number;
};

// Build one SlotRect[] per UI region (Container, Backpack, Quick Use, ...).
// Slot origins are derived from the region's top-left anchor plus a fixed
// stride (slot size + gutter) — the game never shifts slots within a region,
// so a pure arithmetic layout is cheaper and more reliable than detecting
// slot boundaries per frame.
export function getGroupedSlots(): SlotRect[][] {
	const { regions, SLOT_W, SLOT_H, GAP_X, GAP_Y } = activeConfig;

	return regions.map((r) => {
		const slots: SlotRect[] = [];

		for (let row = 0; row < r.rows; row++) {
			for (let col = 0; col < r.cols; col++) {
				slots.push({
					x: r.x + col * (SLOT_W + GAP_X),
					y: r.y + row * (SLOT_H + GAP_Y),
					w: SLOT_W,
					h: SLOT_H,
				});
			}
		}

		return slots;
	});
}

// Populate crop thumbnail, border color, and rarity label for every slot
// the item-type stage already marked as non-empty. The gate uses the
// presence pre-filter (`iconPresent`) in addition to `itemType` so that
// slots which passed presence but failed matchTemplate still get a
// thumbnail — the debug overlay in RegionGrid needs that thumbnail to
// draw the ROI rectangle on top of. True-empty slots (no presence, no
// type) are skipped to avoid the per-slot crop+sample cost.
export function extractSlotImages(
	canvas: HTMLCanvasElement,
	groupedResults: SlotResult[][],
): SlotResult[][] {
	const { SAMPLE_OFFSET_X, SAMPLE_OFFSET_Y_FROM_BOTTOM, SLOT_W, SLOT_H } =
		activeConfig;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('extractSlotImages: 2D context unavailable');

	return groupedResults.map((group) =>
		group.map((slot) => {
			if (!slot.itemType && !slot.iconPresent) return slot;

			const temp = document.createElement('canvas');
			temp.width = SLOT_W;
			temp.height = SLOT_H;

			const tctx = temp.getContext('2d');
			if (!tctx) throw new Error('extractSlotImages: temp 2D context unavailable');
			tctx.putImageData(ctx.getImageData(slot.x, slot.y, SLOT_W, SLOT_H), 0, 0);

			// Rarity is read from a single pixel on the slot's bottom border,
			// where the game draws a solid rarity-colored stroke. Sampling the
			// whole slot would pick up item art and be far less stable; the
			// exact (x, y-from-bottom) offset comes from the active resolution
			// config.
			const pixel = ctx.getImageData(
				slot.x + SAMPLE_OFFSET_X,
				slot.y + SLOT_H - SAMPLE_OFFSET_Y_FROM_BOTTOM,
				1,
				1,
			).data;
			const r = pixel[0];
			const g = pixel[1];
			const b = pixel[2];

			return {
				...slot,
				src: temp.toDataURL(),
				color: `rgb(${r},${g},${b})`,
				rarity: classifyColor([r, g, b]),
			};
		}),
	);
}

// Classify a single sampled RGB pixel into a rarity label. Only called for
// slots already confirmed non-empty by the item-type stage, so there is no
// `empty` branch here — truly empty borders would have been filtered before
// we ever sample the pixel. The tests below are ordered by specificity:
// `common` (gray) is last because its "all channels roughly equal" rule
// would otherwise swallow near-neutral variants of other rarities. Each
// threshold bundle is tuned per-resolution in RARITY_COLOR_THRESHOLDS.
function classifyColor([r, g, b]: number[]): string {
	const DEBUG = false;
	const rgb = DEBUG ? ` rgb(${r},${g},${b})` : '';

	const labeled = (label: string) => `${label}${rgb}`;

	const { rare, uncommon, epic, legendary, common } = RARITY_COLOR_THRESHOLDS;

	// bright cyan/blue — Rare
	if (b > rare.minB && g > rare.minG && r < rare.maxR && b > r + rare.bLeadsRBy)
		return labeled('Rare');

	// bright green — Uncommon
	if (
		g > uncommon.minG &&
		g > r + uncommon.gLeadsRBy &&
		g > b + uncommon.gLeadsBBy
	)
		return labeled('Uncommon');

	// pink / purple — Epic
	if (r > epic.minR && b > epic.minB && r > g + epic.rLeadsGBy)
		return labeled('Epic');

	// bright yellow — Legendary
	if (r > legendary.minR && g > legendary.minG && b < legendary.maxB)
		return labeled('Legendary');

	// gray — Common
	if (
		Math.abs(r - g) < common.maxDelta &&
		Math.abs(g - b) < common.maxDelta &&
		r > common.minR
	)
		return labeled('Common');

	return labeled('unknown');
}
