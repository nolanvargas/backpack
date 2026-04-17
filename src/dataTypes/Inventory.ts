import { Region } from './Region';
import type { ResolutionConfig } from '../config/ResolutionConfig';

export type InventoryOptions = {
	regions?: Region[];
};

export class Inventory {
	regions: Region[];
	augment: string;

	constructor({ regions = [] }: InventoryOptions = {}) {
		this.regions = regions;
		this.augment = '';
	}

	static fromConfig(cfg: ResolutionConfig): Inventory {
		const regions = cfg.regions.map((_, i) => Region.fromConfig(i, cfg));
		return new Inventory({ regions });
	}
}
