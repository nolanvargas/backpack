import { activeConfig, REGION_NAMES } from '../config';
import type { SlotResult } from '../utils/slots';

type RegionGridProps = {
	index: number;
	images: SlotResult[];
};

type DebugRow = {
	label: string;
	value: string;
	score: number | null;
	passed: boolean;
};

const PRESENT_COLOR = '#1a8';
const ABSENT_COLOR = '#b00';
const LOW_CONFIDENCE_COLOR = '#d8a300'; // < 90%
const VERY_LOW_CONFIDENCE_COLOR = '#c00'; // < 85%
const ICON_PRESENCE_LOW_THRESHOLD = 0.05; // < 5% = yellow
const ICON_PRESENCE_VERY_LOW_THRESHOLD = 0.04; // < 4% = red

// Build the per-stage debug rows for a slot. Each stage reports both
// a passed value (canonical pipeline output) and a best-guess value
// (top candidate even when the qualifying threshold failed). We show
// whichever is present, coloring passed rows dark/green and failed
// best-guesses red so the below-threshold state is obvious at a glance.
function buildDebugRows(slot: SlotResult): DebugRow[] {
	const rows: DebugRow[] = [];

	// Icon presence pre-filter row — shown for every rendered slot so
	// the count next to the on-image rectangle is always visible. The
	// "score" cell holds the percentage of cream pixels in the ROI.
	if (slot.iconRoiTotalPixels != null && slot.iconPixelCount != null) {
		const pct = slot.iconPixelCount / slot.iconRoiTotalPixels;
		rows.push({
			label: 'Icon',
			value: `${slot.iconPixelCount}/${slot.iconRoiTotalPixels}`,
			score: pct,
			passed: !!slot.iconPresent,
		});
	}

	if (slot.itemType) {
		rows.push({
			label: 'Type',
			value: slot.itemType,
			score: slot.itemTypeBestScore ?? null,
			passed: true,
		});
	} else if (slot.itemTypeBest) {
		// Slot passed presence but matchTemplate failed to clear
		// ITEM_TYPE_MATCH_THRESHOLD. Show the best guess in red so
		// it's obvious this is a tunable failure case rather than an
		// empty slot.
		rows.push({
			label: 'Type',
			value: slot.itemTypeBest,
			score: slot.itemTypeBestScore ?? null,
			passed: false,
		});
	}

	if (slot.itemName) {
		rows.push({
			label: 'Item',
			value: slot.itemName,
			score: slot.itemScore ?? slot.itemNameBestScore ?? null,
			passed: true,
		});
	} else if (slot.itemNameBest) {
		rows.push({
			label: 'Item',
			value: slot.itemNameBest,
			score: slot.itemNameBestScore ?? null,
			passed: false,
		});
	}

	if (slot.quantity != null) {
		rows.push({
			label: 'Qty',
			value: `x${slot.quantity}`,
			score: slot.quantityScore ?? null,
			passed: true,
		});
	} else if (slot.quantityBest) {
		rows.push({
			label: 'Qty',
			value: slot.quantityBest,
			score: slot.quantityBestScore ?? null,
			passed: false,
		});
	}

	return rows;
}

export default function RegionGrid({ index, images }: RegionGridProps) {
	const {
		regions,
		SLOT_W,
		SLOT_H,
		GAP_X,
		GAP_Y,
		ICON_ROI_OFFSET_X,
		ICON_ROI_OFFSET_Y_FROM_BOTTOM,
		ICON_ROI_W,
		ICON_ROI_H,
	} = activeConfig;

	// Overlay rectangle position is the same for every slot — derived
	// once from activeConfig so each tile reuses the same style object.
	const iconRoiOverlayStyle: React.CSSProperties = {
		position: 'absolute',
		left: ICON_ROI_OFFSET_X,
		bottom: ICON_ROI_OFFSET_Y_FROM_BOTTOM,
		width: ICON_ROI_W,
		height: ICON_ROI_H,
		boxSizing: 'border-box',
		pointerEvents: 'none',
	};

	return (
		<div
			style={{
				border: '1px solid #ccc',
				borderRadius: 6,
				padding: 12,
				background: '#fafafa',
			}}
		>
			<div style={{ marginBottom: 8, fontWeight: 600 }}>
				{REGION_NAMES[index]}
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: `repeat(${regions[index].cols}, ${SLOT_W}px)`,
					gap: `${GAP_X}px ${GAP_Y}px`,
				}}
			>
				{images.map((slot, j) => {
						const rows = buildDebugRows(slot);
						const overlayColor = slot.iconPresent
							? PRESENT_COLOR
							: ABSENT_COLOR;
						return (
							<div
								key={j}
								style={{
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'stretch',
									gap: 4,
									width: SLOT_W,
								}}
							>
								{slot.src && (
									<div
										style={{
											position: 'relative',
											width: SLOT_W,
											height: SLOT_H,
										}}
									>
										<img
											src={slot.src}
											width={SLOT_W}
											height={SLOT_H}
											style={{
												borderRadius: 9,
												border: `2px dashed ${slot.color ?? '#444'}`,
												display: 'block',
											}}
										/>
										<div
											style={{
												...iconRoiOverlayStyle,
												border: `1px solid ${overlayColor}`,
											}}
										/>
									</div>
								)}

								{rows.length > 0 && (
									<div
										style={{
											display: 'grid',
											gridTemplateColumns: 'auto 1fr',
											columnGap: 6,
											rowGap: 1,
											fontSize: 10,
											lineHeight: 1.25,
											fontFamily:
												'ui-monospace, SFMono-Regular, Menlo, monospace',
										}}
									>
										{rows.map((row, i) => (
											<DebugRowCells key={i} row={row} />
										))}
									</div>
								)}
							</div>
						);
					})}
			</div>
		</div>
	);
}

function DebugRowCells({ row }: { row: DebugRow }) {
	// Icon row uses presence-aware coloring; other rows use the existing
	// passed/failed convention. Score cell is rendered as percent for the
	// Icon row (count/total ratio) and as a 0..1 score for the rest.
	const isIcon = row.label === 'Icon';
	const color = row.passed
		? isIcon
			? PRESENT_COLOR
			: '#226'
		: isIcon
			? ABSENT_COLOR
			: '#b00';
	const scoreText =
		row.score == null
			? '—'
			: isIcon
				? `${(row.score * 100).toFixed(1)}%`
				: row.score.toFixed(2);
	const scoreColor =
		row.score == null
			? '#888'
			: isIcon
				? row.score < ICON_PRESENCE_VERY_LOW_THRESHOLD
					? VERY_LOW_CONFIDENCE_COLOR
					: row.score < ICON_PRESENCE_LOW_THRESHOLD
						? LOW_CONFIDENCE_COLOR
						: '#888'
				: row.score < 0.85
					? VERY_LOW_CONFIDENCE_COLOR
					: row.score < 0.9
						? LOW_CONFIDENCE_COLOR
						: '#888';
	return (
		<>
			<span style={{ color: '#666' }}>{row.label}</span>
			<span
				style={{
					color,
					display: 'flex',
					justifyContent: 'space-between',
					gap: 4,
					minWidth: 0,
				}}
			>
				<span
					style={{
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
					}}
					title={row.value}
				>
					{row.value}
				</span>
				<span style={{ color: scoreColor, flexShrink: 0 }}>{scoreText}</span>
			</span>
		</>
	);
}
