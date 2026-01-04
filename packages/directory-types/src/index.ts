import type { components, paths } from './v1';

// Re-export OpenAPI types for advanced usage
export type { components, paths };

// Convenience type exports for directory entity data
export type PlantData =
    paths['/entities/plant']['get']['responses']['200']['content']['application/json'][0];
export type PlantSortData =
    paths['/entities/plantSort']['get']['responses']['200']['content']['application/json'][0];
export type PlantStageData =
    paths['/entities/plantStage']['get']['responses']['200']['content']['application/json'][0];
export type SeedData =
    paths['/entities/seed']['get']['responses']['200']['content']['application/json'][0];
export type BrandData =
    paths['/entities/brand']['get']['responses']['200']['content']['application/json'][0];
export type BlockData =
    paths['/entities/block']['get']['responses']['200']['content']['application/json'][0];
export type OperationData =
    paths['/entities/operation']['get']['responses']['200']['content']['application/json'][0];
export type OperationFrequencyData =
    paths['/entities/operationFrequency']['get']['responses']['200']['content']['application/json'][0];
export type FaqData =
    paths['/entities/faq']['get']['responses']['200']['content']['application/json'][0];
export type FaqCategoryData =
    paths['/entities/faq-category']['get']['responses']['200']['content']['application/json'][0];
export type OccasionData =
    paths['/entities/occasions']['get']['responses']['200']['content']['application/json'][0];

// Component schema types for direct access
export type ImageData = components['schemas']['image'];
