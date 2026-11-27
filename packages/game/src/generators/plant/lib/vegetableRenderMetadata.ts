import type { Color, Matrix4 } from 'three';
import { cropProducePalette } from './cropPalette';
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
 * React renderer. Colours and roughness come from the generated crop palette
 * (`assets/scripts/party-pass-crops.py`): fruit is glossy, roots are satin.
 * Keep this module free of React and geometry construction so worker-side
 * plant generation can import it safely.
 */
export const vegetableMaterialProps: Record<
    VegetableType,
    VegetableMaterialProps
> = {
    strawberry: { ...cropProducePalette.strawberry, ripeningStart: 0.5 },
    blueberry: { ...cropProducePalette.blueberry, ripeningStart: 0.55 },
    raspberry: { ...cropProducePalette.raspberry, ripeningStart: 0.5 },
    tomato: { ...cropProducePalette.tomato, ripeningStart: 0.55 },
    cucumber: cropProducePalette.cucumber,
    bellpepper: { ...cropProducePalette.bellpepper, ripeningStart: 0.55 },
    carrot: cropProducePalette.carrot,
    onion: cropProducePalette.onion,
    eggplant: { ...cropProducePalette.eggplant, ripeningStart: 0.5 },
    zucchini: cropProducePalette.zucchini,
    pumpkin: { ...cropProducePalette.pumpkin, ripeningStart: 0.45 },
    melon: cropProducePalette.melon,
    beet: cropProducePalette.beet,
    radish: cropProducePalette.radish,
    turnip: cropProducePalette.turnip,
    garlic: cropProducePalette.garlic,
    leek: cropProducePalette.leek,
    broccoli: cropProducePalette.broccoli,
    cauliflower: cropProducePalette.cauliflower,
    cabbage: cropProducePalette.cabbage,
    beanpod: cropProducePalette.beanpod,
    peapod: cropProducePalette.peapod,
    artichoke: cropProducePalette.artichoke,
    okra: cropProducePalette.okra,
    fennel: cropProducePalette.fennel,
    kohlrabi: cropProducePalette.kohlrabi,
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
