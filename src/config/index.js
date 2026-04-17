import { Config1080p } from './ResolutionConfig';

export { ResolutionConfig, Config1080p, Config1440p, Config4K } from './ResolutionConfig';

export let activeConfig = new Config1080p();

export function setActiveConfig(config) {
	activeConfig = config;
}
