import type { Frustum, Sphere, Vector3 } from 'three';
import type { GameQualityProfileTier } from './gameQuality';

export type ProjectedGardenLight = {
    influenceIntersectsFrustum: boolean;
    key: string;
    x: number;
    y: number;
    z: number;
};

export function resolveGardenLightBudget(tier: GameQualityProfileTier) {
    switch (tier) {
        case 'high':
            return 20;
        case 'medium':
        case 'custom':
            return 8;
        case 'low':
        case 'auto-constrained':
            return 4;
    }
}

export function doesGardenLightInfluenceIntersectFrustum({
    distance,
    frustum,
    influenceSphere,
    position,
}: {
    distance: number;
    frustum: Frustum;
    influenceSphere: Sphere;
    position: Vector3;
}) {
    if (distance <= 0) {
        return true;
    }

    influenceSphere.center.copy(position);
    influenceSphere.radius = distance;
    return frustum.intersectsSphere(influenceSphere);
}

function projectedCenterDistance(light: ProjectedGardenLight) {
    return light.x * light.x + light.y * light.y;
}

export function selectActiveGardenLightKeys(
    lights: readonly ProjectedGardenLight[],
    budget: number,
    previouslyActiveKeys: ReadonlySet<string> = new Set(),
) {
    if (budget <= 0) {
        return new Set<string>();
    }

    return new Set(
        lights
            .filter((light) => light.influenceIntersectsFrustum)
            .toSorted((left, right) => {
                const leftWasActive = previouslyActiveKeys.has(left.key);
                const rightWasActive = previouslyActiveKeys.has(right.key);
                if (leftWasActive !== rightWasActive) {
                    return leftWasActive ? -1 : 1;
                }

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
