import type { Item } from './Item';
import type { Region } from './Region';

export type SlotOptions = {
	x: number;
	y: number;
	w: number;
	h: number;
	imageSrc?: string | null;
	region?: Region | null;
};

export abstract class Slot {
	x: number;
	y: number;
	w: number;
	h: number;
	imageSrc: string | null;
	region: Region | null;

	constructor({ x, y, w, h, imageSrc = null, region = null }: SlotOptions) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.imageSrc = imageSrc;
		this.region = region;
	}

	abstract isEmpty(): boolean;
}

export type EmptySlotOptions = SlotOptions;

export class EmptySlot extends Slot {
	constructor(props: EmptySlotOptions) {
		super(props);
	}

	isEmpty(): boolean {
		return true;
	}
}

export type FilledSlotOptions = SlotOptions & { item?: Item | null };

export class FilledSlot extends Slot {
	item: Item | null;

	constructor(props: FilledSlotOptions) {
		super(props);
		this.item = props.item ?? null;
	}

	isEmpty(): boolean {
		return false;
	}
}
