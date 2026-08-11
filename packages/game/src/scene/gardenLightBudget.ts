import type { GameQualityProfileTier } from './gameQuality';

export type ProjectedGardenLight = {
    key: string;
    x: number;
    y: number;
    z: number;
};

const projectedViewportMargin = 1.2;

export function resolveGardenLightBudget(tier: GameQualityProfileTier) {
    switch (tier) {
        case 'high':
            return 6;
        case 'medium':
        case 'custom':
            return 4;
        case 'low':
        case 'auto-constrained':
            return 2;
    }
}

function isProjectedGardenLightVisible(light: ProjectedGardenLight) {
    return (
        Math.abs(light.x) <= projectedViewportMargin &&
        Math.abs(light.y) <= projectedViewportMargin &&
        light.z >= -1 &&
        light.z <= 1
    );
}

function projectedCenterDistance(light: ProjectedGardenLight) {
    return light.x * light.x + light.y * light.y;
}

export function selectActiveGardenLightKeys(
    lights: readonly ProjectedGardenLight[],
    budget: number,
) {
    if (budget <= 0) {
        return new Set<string>();
    }

    return new Set(
        lights
            .filter(isProjectedGardenLightVisible)
            .toSorted((left, right) => {
                const distanceDifference =
                    projectedCenterDistance(left) -
                    projectedCenterDistance(right);
                if (distanceDifference !== 0) {
                    return distanceDifference;
                }

                return left.key.localeCompare(right.key);
            })
            .slice(0, budget)
            .map((light) => light.key),
    );
}
