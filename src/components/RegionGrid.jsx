import { regionNames } from '../constants/regions';
import { activeConfig } from '../config';

export default function RegionGrid({ index, images }) {
	const { regions, SLOT_W, SLOT_H, GAP_X, GAP_Y } = activeConfig;

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
				{regionNames[index]}
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: `repeat(${regions[index].cols}, ${SLOT_W}px)`,
					gap: `${GAP_X}px ${GAP_Y}px`,
				}}
			>
				{images.map(({ src, color, rarity, matchScore, quantity, quantityScore, itemName, itemScore, itemType }, j) => (
					<div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
						<img
							src={src}
							width={SLOT_W}
							height={SLOT_H}
							style={{ borderRadius: 9, border: `2px dashed ${color}` }}
						/>
						{/* <span style={{ fontSize: 12, color: '#555' }}>{rarity}</span> */}
						{itemName && (
							<span style={{ fontSize: 12, color: '#226', textAlign: 'center' }}>
								{itemName} ({itemScore.toFixed(2)})
							</span>
						)}
						{matchScore !== undefined && (
							<span style={{ fontSize: 9, color: '#999' }}>{matchScore.toFixed(2)}</span>
						)}
						{quantity != null && (
							<span style={{ fontSize: 12, color: '#333' }}>
								x{quantity}
								{/* x{quantity} ({quantityScore.toFixed(2)}) */}
							</span>
						)}
						{itemType && (
							<span style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>
								{itemType}
							</span>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
