import { useState } from 'react';
import type { Item, Rarity } from '../types';

interface Props {
  items:           Map<string, Item>;
  addOrUpdateItem: (name: string, qty: number, rarity: Rarity) => void;
  removeItem:      (key: string) => void;
}

export default function ItemsPanel({ items, addOrUpdateItem, removeItem }: Props) {
  const [filter,       setFilter]       = useState('');
  const [manualName,   setManualName]   = useState('');
  const [manualQty,    setManualQty]    = useState(1);
  const [manualRarity, setManualRarity] = useState<Rarity>('common');

  const handleAdd = () => {
    const name = manualName.trim();
    if (!name) return;
    addOrUpdateItem(name, manualQty, manualRarity);
    setManualName('');
    setManualQty(1);
  };

  const sorted = [...items.values()]
    .filter(it => !filter || it.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => b.qty - a.qty);

  return (
    <section className="panel panel--items">
      <div className="panel-title">
        DETECTED ITEMS
        <span className="count-badge">{items.size}</span>
      </div>

      <div className="search-wrap">
        <input
          type="text"
          placeholder="Filter items…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      <div className="item-list">
        {sorted.length === 0 ? (
          <div className="empty-state">
            {filter ? 'No matches' : 'Waiting for inventory scan…'}
          </div>
        ) : (
          sorted.map(it => (
            <div key={it.name.toLowerCase()} className={`item-row rarity-${it.rarity}`}>
              <span className="item-name">{it.name}</span>
              <span className="item-qty">{it.qty}</span>
              <span className="item-rarity-dot" />
              <button
                className="item-del"
                onClick={() => removeItem(it.name.toLowerCase())}
                title="Remove"
              >×</button>
            </div>
          ))
        )}
      </div>

      {/* Manual entry */}
      <div className="manual-entry">
        <div className="panel-title">MANUAL ADD</div>
        <div className="manual-row">
          <input
            className="manual-name"
            type="text"
            placeholder="Item name"
            value={manualName}
            onChange={e => setManualName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <input
            className="manual-qty"
            type="number"
            placeholder="Qty"
            min={1}
            value={manualQty}
            onChange={e => setManualQty(Math.max(1, Number(e.target.value)))}
          />
          <select
            className="manual-rarity"
            value={manualRarity}
            onChange={e => setManualRarity(e.target.value as Rarity)}
          >
            {(['common','uncommon','rare','epic','legendary'] as Rarity[]).map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <button className="btn btn--primary btn--sm" onClick={handleAdd}>ADD</button>
        </div>
      </div>
    </section>
  );
}
