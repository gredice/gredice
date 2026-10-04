import type { components, paths } from './v1';

export * from './cms';
export * from './publicUrls';
// Re-export OpenAPI types for advanced usage
export type { components, paths };

// Component schema types for direct access
export type ImageData = components['schemas']['image'];
