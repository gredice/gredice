import type { Matrix4 } from 'three';
import type { VegetableType } from './plant-definitions';

export interface VegetableData {
    growth: number;
    matrix: Matrix4;
    type: VegetableType;
}

/**
 * Clone-safe produce rendering metadata shared by plant generation and the
 * React renderer. Keep this module free of React and geometry construction so
 * worker-side plant generation can import it safely.
 */
export const vegetableMaterialProps: Record<
    VegetableType,
    { color: string; roughness: number }
> = {
    strawberry: { color: '#cf3f4c', roughness: 0.52 },
    blueberry: { color: '#5366bd', roughness: 0.58 },
    raspberry: { color: '#c33b62', roughness: 0.5 },
    tomato: { color: '#ff4500', roughness: 0.5 },
    cucumber: { color: '#2e591a', roughness: 0.6 },
    bellpepper: { color: '#d42a00', roughness: 0.4 },
    carrot: { color: '#e56a1f', roughness: 0.7 },
    onion: { color: '#d1b28a', roughness: 0.8 },
    eggplant: { color: '#5f3478', roughness: 0.45 },
    zucchini: { color: '#3f6a2a', roughness: 0.6 },
    pumpkin: { color: '#d8771e', roughness: 0.72 },
    melon: { color: '#a7bf69', roughness: 0.7 },
    beet: { color: '#8c2444', roughness: 0.6 },
    radish: { color: '#d04258', roughness: 0.6 },
    turnip: { color: '#d7d0b0', roughness: 0.7 },
    garlic: { color: '#efe7d1', roughness: 0.8 },
    leek: { color: '#d9e1b7', roughness: 0.75 },
    broccoli: { color: '#3f7c2c', roughness: 0.85 },
    cauliflower: { color: '#e7e2c8', roughness: 0.86 },
    cabbage: { color: '#7faa55', roughness: 0.8 },
    beanpod: { color: '#4e8a34', roughness: 0.65 },
    peapod: { color: '#6aa848', roughness: 0.62 },
    artichoke: { color: '#6f8c4d', roughness: 0.78 },
    okra: { color: '#73984e', roughness: 0.68 },
    fennel: { color: '#d6e5a3', roughness: 0.75 },
    kohlrabi: { color: '#9fc46f', roughness: 0.74 },
};
