import { REGION_NAMES } from '../config';
import type { ResolutionConfig } from '../config/ResolutionConfig';
import { Slot } from './Slot';

export type RegionOptions = {
	index: number;
	name: string;
	x: number;
	y: number;
	cols: number;
	rows: number;
};

export class Region {
	index: number;
	name: string;
	x: number;
	y: number;
	cols: number;
	rows: number;
	slots: Slot[];

	constructor({ index, name, x, y, cols, rows }: RegionOptions) {
		this.index = index;
		this.name = name;
		this.x = x;
		this.y = y;
		this.cols = cols;
		this.rows = rows;
		this.slots = [];
	}

	// Default: unrestricted. Subclasses override to constrain what detection accepts.
	allowedItemTypes(): string[] | null {
		return null;
	}

	static fromConfig(index: number, cfg: ResolutionConfig): Region {
		const r = cfg.regions[index];
		const Cls = REGION_CLASSES[index] || Region;
		return new Cls({
			index,
			name: REGION_NAMES[index],
			x: r.x,
			y: r.y,
			cols: r.cols,
			rows: r.rows,
		});
	}
}

export class ContainerRegion extends Region {}

export class BackpackRegion extends Region {}

export class QuickUseRegion extends Region {}

export class AugmentedRegion extends Region {}

export class SafePocketRegion extends Region {}

const REGION_CLASSES: Array<new (opts: RegionOptions) => Region> = [
	ContainerRegion,
	BackpackRegion,
	QuickUseRegion,
	AugmentedRegion,
	SafePocketRegion,
];
