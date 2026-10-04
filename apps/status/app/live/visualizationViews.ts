export const visualizationViews = ['orbit', 'rain', 'soil', 'network'] as const;

export type VisualizationView = (typeof visualizationViews)[number];
export type VisualizationMode = 'auto' | VisualizationView;
