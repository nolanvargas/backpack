import { useState, useEffect, useCallback } from 'react';
import { activeConfig, RARITY_ORDER, RARITY_COLORS } from '../config';

import rawCsv from '../../data.csv?raw';

type CsvItem = { name: string; rarity: string | undefined };

const ALL_ITEMS: CsvItem[] = rawCsv
	.split('\n')
	.slice(1)
	.map((l) => {
		const parts = l.split(',');
		return { name: parts[0].trim(), rarity: parts[1]?.trim() };
	})
	.filter((r) => r.name);

export default function MissingItems() {
	const [missing, setMissing] = useState<CsvItem[] | null>(null);
	const [open, setOpen] = useState(true);

	const refresh = useCallback(() => {
		const dir = activeConfig.itemsDir.replace(/^\//, '');
		fetch(`/api/list-items?dir=${encodeURIComponent(dir)}`)
			.then((r) => r.json())
			.then((existing: string[]) => {
				const existingSet = new Set(existing);
				setMissing(ALL_ITEMS.filter((item) => !existingSet.has(item.name)));
			})
			.catch(console.error);
	}, []);

	useEffect(() => { refresh(); }, [refresh]);

	if (missing === null) {
		console.log('[MissingItems] render: missing=null (fetch not completed yet), rendering null');
		return null;
	}

	const byRarity: Record<string, string[]> = {};
	for (const item of missing) {
		const key = item.rarity ?? 'Unknown';
		(byRarity[key] ??= []).push(item.name);
	}

	return (
		<div style={{ marginTop: 20, border: '1px solid #ccc', borderRadius: 6, overflow: 'hidden' }}>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '10px 14px',
					background: '#f0f0f0',
					cursor: 'pointer',
					userSelect: 'none',
				}}
				onClick={() => setOpen((o) => !o)}
			>
				<span style={{ fontWeight: 600 }}>
					Missing Reference Images
					{missing.length > 0 && (
						<span style={{ marginLeft: 8, fontWeight: 400, color: '#666' }}>
							({missing.length} remaining)
						</span>
					)}
				</span>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					{missing.length === 0 && (
						<span style={{ color: '#3a3', fontSize: 13 }}>All present</span>
					)}
					<button
						onClick={(e) => { e.stopPropagation(); refresh(); }}
						style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer' }}
					>
						Refresh
					</button>
					<span style={{ fontSize: 12, color: '#888' }}>{open ? '▲' : '▼'}</span>
				</div>
			</div>

			{open && missing.length > 0 && (
				<div style={{ padding: '12px 14px' }}>
					{RARITY_ORDER.map((rarity) => {
						const items = byRarity[rarity];
						if (!items?.length) {
							console.log(`[MissingItems] render: no items in rarity "${rarity}", skipping section`);
							return null;
						}
						return (
							<div key={rarity} style={{ marginBottom: 12 }}>
								<div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: RARITY_COLORS[rarity] }}>
									{rarity} ({items.length})
								</div>
								<ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, columns: 3, columnGap: 24 }}>
									{items.map((name) => <li key={name}>{name}</li>)}
								</ul>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
