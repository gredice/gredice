/**
 * Type definitions for the plant generator system
 */

import type { PlantDefinition } from '../../lib/plant-definitions';

/**
 * Main application state interface
 */
export interface PlantGeneratorState {
    /** Current L-system generation/iteration */
    generation: number;
    /** Seed string for deterministic randomization */
    seed: string;
    /** Selected plant type key */
    plantType: string;
    /** Current plant definition (may be modified from base) */
    definition: PlantDefinition;
    /** Flower growth factor (0-1) */
    flowerGrowth: number;
    /** Fruit/vegetable growth factor (0-1) */
    fruitGrowth: number;
    /** Currently active UI tab */
    activeTab: string;
    /** Mobile sheet open state */
    isSheetOpen: boolean;
    /** Custom plant definitions created by user */
    customPlants: Record<string, PlantDefinition>;
}

/**
 * Visibility toggles for plant components
 */
export interface VisibilityState {
    /** Show/hide leaf geometry */
    showLeaves: boolean;
    /** Show/hide flower geometry */
    showFlowers: boolean;
    /** Show/hide fruit/vegetable geometry */
    showProduce: boolean;
}

/**
 * Props for plant parameter controls
 */
export interface PlantControlsProps {
    state: PlantGeneratorState;
    visibility: VisibilityState;
    onStateChange: (updates: Partial<PlantGeneratorState>) => void;
    onVisibilityChange: (updates: Partial<VisibilityState>) => void;
    onDefinitionChange: (path: string, value: unknown) => void;
    onRulesChange: (newRules: Record<string, unknown>) => void;
    onRandomizeSeed: () => void;
    onCreateCustomPlant: (name: string) => void;
    onDeleteCustomPlant: (name: string) => void;
    lSystemChain: string;
}

/**
 * Custom plant creation dialog props
 */
export interface CreatePlantDialogProps {
    currentDefinition: PlantDefinition;
    existingNames: string[];
    onCreatePlant: (name: string) => void;
}
