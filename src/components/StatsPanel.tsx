import { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import type { Item, ActivityPoint } from '../types';

ChartJS.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Filler,
);

const FONT  = { family: 'Courier New', size: 11 };
const GRID  = { color: '#1e2a3a' };
const TICK  = { color: '#556070', font: FONT };
const LEGEND_LABELS = { color: '#556070', font: FONT };

interface Props {
  items:           Map<string, Item>;
  scanCount:       number;
  detectionCount:  number;
  activityHistory: ActivityPoint[];
}

export default function StatsPanel({ items, scanCount, detectionCount, activityHistory }: Props) {
  const allItems     = useMemo(() => [...items.values()], [items]);
  const uniqueCount  = allItems.length;
  const totalQty     = useMemo(() => allItems.reduce((s, it) => s + it.qty, 0), [allItems]);

  const rarityData = useMemo(() => {
    const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    for (const it of allItems) counts[it.rarity] = (counts[it.rarity] ?? 0) + 1;
    return [counts.common, counts.uncommon, counts.rare, counts.epic, counts.legendary];
  }, [allItems]);

  const top = useMemo(
    () => [...allItems].sort((a, b) => b.qty - a.qty).slice(0, 8),
    [allItems],
  );

  return (
    <section className="panel panel--stats">
      <div className="panel-title">STATISTICS</div>

      <div className="stat-grid">
        {[
          ['Unique Items',  uniqueCount],
          ['Total Qty',     totalQty],
          ['Total Scans',   scanCount],
          ['Detections',    detectionCount],
        ].map(([label, val]) => (
          <div className="stat-card" key={label}>
            <div className="stat-value">{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="chart-block">
        <div className="chart-title">RARITY BREAKDOWN</div>
        <Doughnut
          height={180}
          data={{
            labels: ['Common','Uncommon','Rare','Epic','Legendary'],
            datasets: [{
              data: rarityData,
              backgroundColor: ['#9ca3af','#4ade80','#60a5fa','#c084fc','#fbbf24'],
              borderColor: '#161b26',
              borderWidth: 2,
            }],
          }}
          options={{
            animation: { duration: 300 },
            cutout: '65%',
            plugins: {
              legend: { position: 'right', labels: LEGEND_LABELS },
            },
          }}
        />
      </div>

      <div className="chart-block">
        <div className="chart-title">TOP ITEMS BY QTY</div>
        <Bar
          height={200}
          data={{
            labels: top.map(it => it.name.length > 18 ? it.name.slice(0, 16) + '…' : it.name),
            datasets: [{
              label: 'Qty',
              data: top.map(it => it.qty),
              backgroundColor: 'rgba(0,212,255,0.3)',
              borderColor: '#00d4ff',
              borderWidth: 1,
            }],
          }}
          options={{
            animation: { duration: 300 },
            indexAxis: 'y',
            scales: {
              x: { ticks: TICK, grid: GRID },
              y: { ticks: { ...TICK, color: '#c8d8e8' }, grid: GRID },
            },
            plugins: { legend: { display: false } },
          }}
        />
      </div>

      <div className="chart-block">
        <div className="chart-title">SCAN ACTIVITY (last 20)</div>
        <Line
          height={120}
          data={{
            labels: activityHistory.map(h => h.time),
            datasets: [{
              label: 'Items',
              data: activityHistory.map(h => h.count),
              borderColor: '#ff6b35',
              backgroundColor: 'rgba(255,107,53,0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
            }],
          }}
          options={{
            animation: { duration: 300 },
            scales: {
              x: { ticks: { ...TICK, maxRotation: 0, font: { ...FONT, size: 9 } }, grid: GRID },
              y: { ticks: TICK, grid: GRID, min: 0 },
            },
            plugins: { legend: { display: false } },
          }}
        />
      </div>
    </section>
  );
}
