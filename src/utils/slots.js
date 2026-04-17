import { activeConfig } from '../config';
import { THRESHOLDS } from '../constants/detection';

export function getGroupedSlots() {
	const { regions, SLOT_W, SLOT_H, GAP_X, GAP_Y } = activeConfig;

	return regions.map((r) => {
		const slots = [];

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

export function extractSlotImages(canvas, groupedSlots) {
	const { SAMPLE_OFFSET_X, SAMPLE_OFFSET_Y_FROM_BOTTOM } = activeConfig;
	const ctx = canvas.getContext('2d');

	return groupedSlots.map((group) =>
		group.map((s) => {
			const temp = document.createElement('canvas');
			temp.width = s.w;
			temp.height = s.h;

			const tctx = temp.getContext('2d');
			tctx.putImageData(ctx.getImageData(s.x, s.y, s.w, s.h), 0, 0);

			const pixel = ctx.getImageData(
				s.x + SAMPLE_OFFSET_X,
				s.y + s.h - SAMPLE_OFFSET_Y_FROM_BOTTOM,
				1,
				1,
			).data;
			const [r, g, b] = pixel;
			const color = `rgb(${r},${g},${b})`;
			const rarity = classifyColor([r, g, b]);

			// debug: item type ROI (bottom-left 25%×25%)
			const typeRoiX = 0;
			const typeRoiY = Math.round(s.h * 0.75);
			const typeRoiW = Math.round(s.w * 0.25);
			const typeRoiH = s.h - typeRoiY;
			tctx.strokeStyle = 'lime';
			tctx.lineWidth = 1;
			tctx.strokeRect(typeRoiX + 0.5, typeRoiY + 0.5, typeRoiW - 1, typeRoiH - 1);

			return { src: temp.toDataURL(), color, rarity, x: s.x, y: s.y };
		}),
	);
}

function classifyColor([r, g, b]) {
	const DEBUG = false;
	const rgb = DEBUG ? ` rgb(${r},${g},${b})` : '';

	const labeled = (label) => `${label}${rgb}`;

	const { empty, rare, uncommon, epic, legendary, common, blueprints } = THRESHOLDS;

	// dark blue — Blueprints (checked before empty, as its low values pass the empty test)
	if (
		r >= blueprints.minR && r < blueprints.maxR &&
		g >= blueprints.minG && g < blueprints.maxG &&
		b > blueprints.minB
	)
		return labeled('Blueprints');

	if (r < empty.maxR && g < empty.maxG && b < empty.maxB)
		return labeled('empty');

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
