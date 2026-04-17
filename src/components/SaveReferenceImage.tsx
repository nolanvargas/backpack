import { useState, useEffect } from 'react';
import { Combobox, TextInput, useCombobox, Button, Group, Text } from '@mantine/core';
import { activeConfig } from '../config';
import type { SlotResult } from '../utils/slots';

import rawCsv from '../../data.csv?raw';
const ITEM_NAMES: string[] = rawCsv
	.split('\n')
	.slice(1)
	.map((l) => l.split(',')[0].trim())
	.filter(Boolean);

type SaveReferenceImageProps = {
	regionsOut: SlotResult[][];
};

export default function SaveReferenceImage({ regionsOut }: SaveReferenceImageProps) {
	const { SLOT_W, SLOT_H, EFFECTIVE_H, itemsDir } = activeConfig;

	const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
	const [itemName, setItemName] = useState('');
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState('');
	const [existingItems, setExistingItems] = useState<Set<string>>(new Set());

	useEffect(() => {
		fetch(`/api/list-items?dir=${encodeURIComponent(itemsDir)}`)
			.then((r) => r.json())
			.then((files: string[]) => setExistingItems(new Set(files)))
			.catch(() => {});
	}, [itemsDir]);

	const combobox = useCombobox({
		onDropdownClose: () => combobox.resetSelectedOption(),
	});

	const filtered = ITEM_NAMES
		.filter((n) => !existingItems.has(n))
		.filter((n) => n.toLowerCase().includes(search.toLowerCase()));

	// Only non-empty slots (those with a cropped src) can be saved as
	// reference images — empty slots carry no pixel data to save.
	const slots = regionsOut.flat().filter((s): s is SlotResult & { src: string } => Boolean(s.src));

	async function handleSave() {
		if (selectedIdx === null) {
			console.log('[SaveReferenceImage] handleSave: no slot selected, bailing before save');
			return setStatus('Select a slot first.');
		}
		if (!itemName) {
			console.log('[SaveReferenceImage] handleSave: no itemName chosen, bailing before save');
			return setStatus('Choose an item name first.');
		}

		const slot = slots[selectedIdx];

		const img = new Image();
		img.src = slot.src;
		await new Promise<void>((r) => {
			img.onload = () => r();
		});

		const offscreen = document.createElement('canvas');
		offscreen.width = SLOT_W;
		offscreen.height = EFFECTIVE_H;
		const octx = offscreen.getContext('2d');
		if (!octx) {
			setStatus('Save failed: 2D context unavailable');
			return;
		}
		octx.drawImage(img, 0, 0, SLOT_W, EFFECTIVE_H, 0, 0, SLOT_W, EFFECTIVE_H);

		const dataUrl = offscreen.toDataURL('image/png');
		const filePath = itemsDir.replace(/^\//, '') + `/${itemName}.png`;

		try {
			const res = await fetch('/api/save-image', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filePath, dataUrl }),
			});
			if (!res.ok) throw new Error(`Server error ${res.status}`);
			setStatus(`Saved: public/${filePath}`);
			setExistingItems((prev) => new Set([...prev, itemName]));
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setStatus(`Save failed: ${message}`);
		}
	}

	return (
		<div
			style={{
				marginTop: 24,
				padding: 16,
				border: '1px solid #ccc',
				borderRadius: 6,
				background: '#f5f5f5',
			}}
		>
			<div style={{ fontWeight: 600, marginBottom: 12 }}>Save Reference Image</div>

			{/* Slot selector */}
			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					gap: 6,
					marginBottom: 14,
				}}
			>
				{slots.map((slot, i) => (
					<div
						key={i}
						onClick={() => setSelectedIdx(i)}
						style={{
							cursor: 'pointer',
							outline: selectedIdx === i ? '3px solid #228be6' : '3px solid transparent',
							borderRadius: 6,
							lineHeight: 0,
						}}
					>
						<img
							src={slot.src}
							width={SLOT_W}
							height={SLOT_H}
							style={{ display: 'block', borderRadius: 4 }}
						/>
					</div>
				))}
			</div>

			{/* Controls row */}
			<Group align="flex-end" gap="sm">
				<Combobox
					store={combobox}
					onOptionSubmit={(val) => {
						setItemName(val);
						setSearch(val);
						combobox.closeDropdown();
					}}
					withinPortal={false}
				>
					<Combobox.Target>
						<TextInput
							label="Item name"
							placeholder="Search item…"
							value={search}
							style={{ width: 280 }}
							onChange={(e) => {
								setSearch(e.currentTarget.value);
								setItemName('');
								combobox.openDropdown();
								combobox.updateSelectedOptionIndex();
							}}
							onClick={() => combobox.openDropdown()}
							onFocus={() => combobox.openDropdown()}
							onBlur={() => combobox.closeDropdown()}
						/>
					</Combobox.Target>

					<Combobox.Dropdown>
						<Combobox.Options style={{ maxHeight: 220, overflowY: 'auto' }}>
							{filtered.length === 0 ? (
								<Combobox.Empty>No results</Combobox.Empty>
							) : (
								filtered.map((name) => (
									<Combobox.Option key={name} value={name}>
										{name}
									</Combobox.Option>
								))
							)}
						</Combobox.Options>
					</Combobox.Dropdown>
				</Combobox>

				<Button
					onClick={handleSave}
					disabled={!itemName || selectedIdx === null}
				>
					Save
				</Button>
			</Group>

			{status && (
				<Text size="sm" mt="xs" c={status.startsWith('Saved') ? 'green' : 'red'}>
					{status}
				</Text>
			)}
		</div>
	);
}
