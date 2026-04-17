import type { Rarity } from './Rarity';

export type ItemOptions = {
	name?: string | null;
	rarity?: Rarity | null;
	qty?: number | null;
	itemType?: string | null;
	recyclesTo?: string | null;
	value?: number | null;
	maxStack?: number | null;
	uses?: string | null;
};

export class Item {
	name: string | null;
	rarity: Rarity | null;
	quantity: number | null;
	itemType: string | null;
	recyclesTo: string | null;
	value: number | null;
	maxStack: number | null;
	uses: string | null;

	constructor({
		name = null,
		rarity = null,
		qty = null,
		itemType = null,
		recyclesTo = null,
		value = null,
		maxStack = null,
		uses = null,
	}: ItemOptions = {}) {
		this.name = name;
		this.rarity = rarity;
		this.quantity = qty;
		this.itemType = itemType;
		this.recyclesTo = recyclesTo;
		this.value = value;
		this.maxStack = maxStack;
		this.uses = uses;
	}
}
