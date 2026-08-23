import type { Color, Matrix4 } from 'three';
import type { VegetableType } from './plant-definitions';

export interface VegetableData {
    color: Color;
    growth: number;
    matrix: Matrix4;
    type: VegetableType;
}

interface VegetableMaterialProps {
    color: string;
    ripeningStart?: number;
    roughness: number;
    unripeColor?: string;
}

/**
 * Clone-safe produce rendering metadata shared by plant generation and the
 * React renderer. Keep this module free of React and geometry construction so
 * worker-side plant generation can import it safely.
 */
export const vegetableMaterialProps: Record<
    VegetableType,
    VegetableMaterialProps
> = {
    strawberry: {
        color: '#cf3f4c',
        ripeningStart: 0.5,
        roughness: 0.52,
        unripeColor: '#a2b85b',
    },
    blueberry: {
        color: '#5366bd',
        ripeningStart: 0.55,
        roughness: 0.58,
        unripeColor: '#8fad62',
    },
    raspberry: {
        color: '#c33b62',
        ripeningStart: 0.5,
        roughness: 0.5,
        unripeColor: '#9aad55',
    },
    tomato: {
        color: '#d62828',
        ripeningStart: 0.55,
        roughness: 0.5,
        unripeColor: '#6f8135',
    },
    cucumber: { color: '#2e591a', roughness: 0.6 },
    bellpepper: {
        color: '#c72f1e',
        ripeningStart: 0.55,
        roughness: 0.4,
        unripeColor: '#4f7d32',
    },
    carrot: { color: '#e56a1f', roughness: 0.7 },
    onion: { color: '#d1b28a', roughness: 0.8 },
    eggplant: {
        color: '#5f3478',
        ripeningStart: 0.5,
        roughness: 0.45,
        unripeColor: '#87a45e',
    },
    zucchini: { color: '#3f6a2a', roughness: 0.6 },
    pumpkin: {
        color: '#d8771e',
        ripeningStart: 0.45,
        roughness: 0.72,
        unripeColor: '#5d7931',
    },
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

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function mixHexColors(from: string, to: string, amount: number) {
    const fromValue = Number.parseInt(from.slice(1), 16);
    const toValue = Number.parseInt(to.slice(1), 16);
    const progress = clamp01(amount);
    const mixChannel = (shift: number) => {
        const fromChannel = (fromValue >> shift) & 0xff;
        const toChannel = (toValue >> shift) & 0xff;
        return Math.round(fromChannel + (toChannel - fromChannel) * progress);
    };
    const mixed = (mixChannel(16) << 16) | (mixChannel(8) << 8) | mixChannel(0);

    return `#${mixed.toString(16).padStart(6, '0')}`;
}

export function resolveVegetableColor(type: VegetableType, maturity: number) {
    const material = vegetableMaterialProps[type];
    if (!material.unripeColor) {
        return material.color;
    }

    const ripeningStart = material.ripeningStart ?? 0;
    const linearProgress = clamp01(
        (clamp01(maturity) - ripeningStart) / (1 - ripeningStart),
    );
    const easedProgress =
        linearProgress * linearProgress * (3 - 2 * linearProgress);

    return mixHexColors(material.unripeColor, material.color, easedProgress);
}
