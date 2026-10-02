import { Vector3 } from 'three';

function horizontalDistance(left: Vector3, right: Vector3) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

export function pathHorizontalDistance(path: Vector3[]) {
    let distance = 0;
    for (let index = 1; index < path.length; index += 1) {
        const previous = path[index - 1];
        const current = path[index];
        if (previous && current) {
            distance += horizontalDistance(previous, current);
        }
    }
    return distance;
}

export function pathPositionAtDistance(path: Vector3[], distance: number) {
    const first = path[0];
    if (!first || distance <= 0) {
        return first?.clone() ?? new Vector3();
    }

    let remainingDistance = distance;
    for (let index = 1; index < path.length; index += 1) {
        const from = path[index - 1];
        const to = path[index];
        if (!from || !to) {
            continue;
        }
        const segmentDistance = horizontalDistance(from, to);
        if (segmentDistance <= 0.0001) {
            continue;
        }
        if (remainingDistance <= segmentDistance) {
            return from.clone().lerp(to, remainingDistance / segmentDistance);
        }
        remainingDistance -= segmentDistance;
    }

    return path.at(-1)?.clone() ?? first.clone();
}
