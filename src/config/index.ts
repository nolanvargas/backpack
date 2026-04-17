import { Config1080p, ResolutionConfig } from './ResolutionConfig';

export { ResolutionConfig, Config1080p, Config1440p, Config4K } from './ResolutionConfig';
export type { RegionDef, ResolutionConfigOptions } from './ResolutionConfig';

export * from './constants';

export let activeConfig: ResolutionConfig = new Config1080p();

export function setActiveConfig(config: ResolutionConfig): void {
	activeConfig = config;
}
