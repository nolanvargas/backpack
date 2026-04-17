import { useState, useEffect, useRef } from 'react';
import { startStream, grabFrame, stopStream, isStreaming } from './utils/capture';
import { isInventoryView, loadInventoryTemplate } from './utils/inventory';
import { getGroupedSlots, extractSlotImages } from './utils/slots';
import { loadAmmoTemplate, matchLightAmmo } from './utils/ammo';
import { loadQuantityTemplates, applyQuantities } from './utils/quantity';
import { loadItemTemplates, matchItems } from './utils/items';
import { loadItemTypeTemplates, matchItemTypes } from './utils/itemTypes';
import RegionGrid from './components/RegionGrid';
import SaveReferenceImage from './components/SaveReferenceImage';
import MissingItems from './components/MissingItems';

const INTERVAL_MS = 2000;

export default function App() {
	const [regionsOut, setRegionsOut] = useState([]);
	const [templateReady, setTemplateReady] = useState(false);
	const [error, setError] = useState(null);
	const [running, setRunning] = useState(false);
	const [debugRegion, setDebugRegion] = useState(null); // { regionCanvas, score, match }
	const intervalRef = useRef(null);
	const processingRef = useRef(false);
	const debugCanvasRef = useRef(null);

	useEffect(() => {
		Promise.all([loadAmmoTemplate(), loadQuantityTemplates(), loadItemTemplates(), loadItemTypeTemplates()])
			.then(() => setTemplateReady(true))
			.catch(console.error);
	}, []);

	const processCanvas = async (canvas) => {
		const grouped = getGroupedSlots();
		const initial = extractSlotImages(canvas, grouped);
		const withAmmo = await matchLightAmmo(initial, canvas);
		const withTypes = await matchItemTypes(withAmmo, canvas);
		const withQuantities = await applyQuantities(withTypes, canvas);
		return matchItems(withQuantities, canvas);
	};

	const handleCapture = async () => {
		setError(null);
		let canvas;
		try {
			const { captureFrame } = await import('./utils/capture');
			canvas = await captureFrame();
		} catch (err) {
			setError(err.message);
			return;
		}
		try {
			const final = await processCanvas(canvas);
			setRegionsOut(final);
		} catch (err) {
			setError(err.message);
		}
	};

	const tick = async () => {
		if (processingRef.current) return;
		processingRef.current = true;
		const t0 = performance.now();
		try {
			if (!isStreaming()) {
				stopAuto();
				return;
			}
			const canvas = grabFrame();
			const t1 = performance.now();
			const { match, score, regionCanvas } = await isInventoryView(canvas);
			const t2 = performance.now();
			setDebugRegion({ regionCanvas, score, match });
			if (!match) {
				console.log(`[auto] no match (${score}) | grab ${(t1-t0).toFixed(1)}ms | detect ${(t2-t1).toFixed(1)}ms | total ${(t2-t0).toFixed(1)}ms`);
				return;
			}
			const final = await processCanvas(canvas);
			const t3 = performance.now();
			setRegionsOut(final);
			console.log(`[auto] processed (${score}) | grab ${(t1-t0).toFixed(1)}ms | detect ${(t2-t1).toFixed(1)}ms | process ${(t3-t2).toFixed(1)}ms | total ${(t3-t0).toFixed(1)}ms`);
		} catch (err) {
			const t = performance.now();
			console.error(`[auto] error after ${(t-t0).toFixed(1)}ms:`, err.message);
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
			setError(err.message);
			return;
		}
		setRunning(true);
		intervalRef.current = setInterval(tick, INTERVAL_MS);
	};

	const stopAuto = () => {
		clearInterval(intervalRef.current);
		intervalRef.current = null;
		stopStream();
		setRunning(false);
	};

	useEffect(() => () => clearInterval(intervalRef.current), []);

	// useEffect(() => {
	// 	if (!debugRegion?.regionCanvas || !debugCanvasRef.current) return;
	// 	const { regionCanvas, score, match } = debugRegion;
	// 	const out = debugCanvasRef.current;
	// 	const scale = 6;
	// 	out.width = regionCanvas.width * scale;
	// 	out.height = regionCanvas.height * scale;
	// 	const ctx = out.getContext('2d');
	// 	ctx.imageSmoothingEnabled = false;
	// 	ctx.drawImage(regionCanvas, 0, 0, out.width, out.height);
	// 	ctx.strokeStyle = match ? '#00ff00' : '#ff3333';
	// 	ctx.lineWidth = 2;
	// 	ctx.strokeRect(1, 1, out.width - 2, out.height - 2);
	// 	ctx.fillStyle = match ? '#00ff00' : '#ff3333';
	// 	ctx.font = `bold ${scale * 3}px monospace`;
	// 	ctx.fillText(score.toFixed(2), 4, out.height - 4);
	// }, [debugRegion]);

	return (
		<div style={{ padding: 16 }}>
			<div style={{ display: 'flex', gap: 8 }}>
				<button onClick={handleCapture} disabled={!templateReady || running}>
					{templateReady ? 'Capture' : 'Loading…'}
				</button>
				<button onClick={running ? stopAuto : startAuto} disabled={!templateReady}>
					{running ? 'Stop Auto' : 'Start Auto'}
				</button>
			</div>
			{running && (
				<div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
					Auto-capturing every {INTERVAL_MS / 1000}s — waiting for inventory view…
				</div>
			)}
			{/* {running && (
				<div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
					<canvas ref={debugCanvasRef} style={{ imageRendering: 'pixelated' }} />
					{debugRegion && (
						<span style={{ fontSize: 11, color: debugRegion.match ? '#0c0' : '#c33' }}>
							{debugRegion.match ? 'match' : 'no match'} {debugRegion.score.toFixed(2)}
						</span>
					)}
				</div>
			)} */}
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
				{regionsOut[0] && <RegionGrid key={0} index={0} images={regionsOut[0]} />}

				{/* Middle: Backpack */}
				{regionsOut[1] && <RegionGrid key={1} index={1} images={regionsOut[1]} />}

				{/* Right: Quick Use, Augments, Safe Pocket */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
					{regionsOut[2] && <RegionGrid key={2} index={2} images={regionsOut[2]} />}
					{regionsOut[3] && <RegionGrid key={3} index={3} images={regionsOut[3]} />}
					{regionsOut[4] && <RegionGrid key={4} index={4} images={regionsOut[4]} />}
				</div>
			</div>

			{regionsOut.length > 0 && <SaveReferenceImage regionsOut={regionsOut} />}
			<MissingItems />
		</div>
	);
}
