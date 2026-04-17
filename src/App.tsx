import { useState, useEffect, useRef } from 'react';
import {
	startStream,
	grabFrame,
	stopStream,
	isStreaming,
} from './utils/capture';
import { isInventoryView, loadInventoryTemplate } from './utils/inventory';
import { getGroupedSlots, extractSlotImages } from './utils/slots';
import type { SlotResult } from './utils/slots';
import { loadQuantityTemplates, applyQuantities } from './utils/quantity';
import { loadItemTemplates, matchItems } from './utils/items';
import { loadItemTypeTemplates, matchItemTypes } from './utils/itemTypes';
import RegionGrid from './components/RegionGrid';
import SaveReferenceImage from './components/SaveReferenceImage';
import MissingItems from './components/MissingItems';
import { AUTO_CAPTURE_INTERVAL_MS } from './config';

type DebugRegion = {
	regionCanvas: HTMLCanvasElement | null;
	score: number;
	match: boolean;
};

export default function App() {
	const [regionsOut, setRegionsOut] = useState<SlotResult[][]>([]);
	const [templateReady, setTemplateReady] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	const [debugRegion, setDebugRegion] = useState<DebugRegion | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const processingRef = useRef(false);
	const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		Promise.all([
			loadQuantityTemplates(),
			loadItemTemplates(),
			loadItemTypeTemplates(),
		])
			.then(() => setTemplateReady(true))
			.catch(console.error);
	}, []);

	// Pipeline order matters:
	//   1. matchItemTypes        — primary empty-vs-filled gate. Every
	//                              real item (including Blueprints) has a
	//                              category icon in its bottom-left; a
	//                              slot with no icon match is empty and
	//                              short-circuits the remaining stages.
	//                              Also narrows the item-template search
	//                              in step 4.
	//   2. extractSlotImages     — for non-empty slots only: crops the
	//                              thumbnail used by the UI and samples
	//                              the rarity border color.
	//   3. applyQuantities       — reads the "xN" HUD label. Independent
	//                              of item identity, so order vs items is
	//                              free; kept before items for log clarity.
	//   4. matchItems            — expensive template-match pass, made
	//                              cheaper by restricting to the category
	//                              detected in step 1.
	const processCanvas = async (
		canvas: HTMLCanvasElement,
	): Promise<SlotResult[][]> => {
		const grouped = getGroupedSlots();
		const withTypes = await matchItemTypes(grouped, canvas);
		const withImages = extractSlotImages(canvas, withTypes);
		const withQuantities = await applyQuantities(withImages, canvas);
		return matchItems(withQuantities, canvas);
	};

	const handleCapture = async () => {
		setError(null);
		let canvas: HTMLCanvasElement;
		try {
			const { captureFrame } = await import('./utils/capture');
			canvas = await captureFrame();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.log(`[app] handleCapture: captureFrame threw "${message}", bailing before processCanvas`);
			setError(message);
			return;
		}
		try {
			const final = await processCanvas(canvas);
			setRegionsOut(final);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		}
	};

	// Auto-capture loop body. `processingRef` is a reentrancy guard: a
	// single processCanvas pass can easily outlast AUTO_CAPTURE_INTERVAL_MS
	// on slower machines (or on 4K frames), and we'd rather drop ticks
	// than pile up overlapping OpenCV work and burn CPU on stale frames.
	const tick = async () => {
		if (processingRef.current) {
			console.log('[app] tick: previous tick still processing, skipping this interval');
			return;
		}
		processingRef.current = true;
		const t0 = performance.now();
		try {
			if (!isStreaming()) {
				console.log('[app] tick: stream no longer active, stopping auto-capture');
				stopAuto();
				return;
			}
			const canvas = grabFrame();
			const t1 = performance.now();
			const { match, score, regionCanvas } = await isInventoryView(canvas);
			const t2 = performance.now();
			setDebugRegion({ regionCanvas, score, match });
			if (!match) {
				console.log(
					`[auto] no match (${score}) | grab ${(t1 - t0).toFixed(1)}ms | detect ${(t2 - t1).toFixed(1)}ms | total ${(t2 - t0).toFixed(1)}ms — inventory view not detected, skipping processing`,
				);
				return;
			}
			const final = await processCanvas(canvas);
			const t3 = performance.now();
			setRegionsOut(final);
			console.log(
				`[auto] processed (${score}) | grab ${(t1 - t0).toFixed(1)}ms | detect ${(t2 - t1).toFixed(1)}ms | process ${(t3 - t2).toFixed(1)}ms | total ${(t3 - t0).toFixed(1)}ms`,
			);
		} catch (err) {
			const t = performance.now();
			const message = err instanceof Error ? err.message : String(err);
			console.error(
				`[auto] error after ${(t - t0).toFixed(1)}ms:`,
				message,
			);
		} finally {
			processingRef.current = false;
		}
	};

	const startAuto = async () => {
		setError(null);
		try {
			await startStream();
			await loadInventoryTemplate();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.log(`[app] startAuto: startStream/loadInventoryTemplate failed with "${message}", not starting interval`);
			setError(message);
			return;
		}
		setRunning(true);
		intervalRef.current = setInterval(tick, AUTO_CAPTURE_INTERVAL_MS);
	};

	const stopAuto = () => {
		if (intervalRef.current !== null) clearInterval(intervalRef.current);
		intervalRef.current = null;
		stopStream();
		setRunning(false);
	};

	useEffect(() => () => {
		if (intervalRef.current !== null) clearInterval(intervalRef.current);
	}, []);

	return (
		<div style={{ padding: 16 }}>
			<div style={{ display: 'flex', gap: 8 }}>
				<button onClick={handleCapture} disabled={!templateReady || running}>
					{templateReady ? 'Capture' : 'Loading…'}
				</button>
				<button
					onClick={running ? stopAuto : startAuto}
					disabled={!templateReady}
				>
					{running ? 'Stop Auto' : 'Start Auto'}
				</button>
			</div>
			{running && (
				<div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
					Auto-capturing every {AUTO_CAPTURE_INTERVAL_MS / 1000}s — waiting for inventory
					view…
				</div>
			)}
			{error && (
				<div style={{ marginTop: 12, color: '#c00', fontSize: 13 }}>
					{error}
				</div>
			)}

			<div
				style={{
					marginTop: 20,
					display: 'grid',
					gridTemplateColumns: 'auto auto auto',
					gap: 20,
					alignItems: 'start',
				}}
			>
				{/* Left: Container */}
				{regionsOut[0] && (
					<RegionGrid key={0} index={0} images={regionsOut[0]} />
				)}

				{/* Middle: Backpack */}
				{regionsOut[1] && (
					<RegionGrid key={1} index={1} images={regionsOut[1]} />
				)}

				{/* Right: Quick Use, Augments, Safe Pocket */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
					{regionsOut[2] && (
						<RegionGrid key={2} index={2} images={regionsOut[2]} />
					)}
					{regionsOut[3] && (
						<RegionGrid key={3} index={3} images={regionsOut[3]} />
					)}
					{regionsOut[4] && (
						<RegionGrid key={4} index={4} images={regionsOut[4]} />
					)}
				</div>
			</div>

			{regionsOut.length > 0 && <SaveReferenceImage regionsOut={regionsOut} />}
			<MissingItems />
		</div>
	);
}
