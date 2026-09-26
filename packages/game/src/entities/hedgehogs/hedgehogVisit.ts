import { Vector3 } from 'three';
import type { HedgehogHabitat } from './hedgehogHabitat';
export const hedgehogVisitLimits = {
    perScene: 1,
    cooldownMs: 240000,
    maxVisitSeconds: 40,
    speed: 0.38,
};
export type HedgehogClip = 'HedgehogIdle' | 'HedgehogWalk' | 'HedgehogSniff';
export type HedgehogSegment = {
    from: Vector3;
    to: Vector3;
    duration: number;
    clip: HedgehogClip;
};
export function planHedgehogVisit(habitat: HedgehogHabitat, sequence: number) {
    const route = habitat.routes[sequence % habitat.routes.length];
    if (!route) return [];
    const points = [habitat.portal, ...route];
    const segments: HedgehogSegment[] = [];
    const pause = (at: Vector3, duration: number, clip: HedgehogClip) =>
        segments.push({ from: at, to: at, duration, clip });
    const walk = (a: Vector3, b: Vector3) =>
        segments.push({
            from: a,
            to: b,
            duration: a.distanceTo(b) / hedgehogVisitLimits.speed,
            clip: 'HedgehogWalk',
        });
    pause(habitat.portal, 2, 'HedgehogIdle');
    for (let i = 1; i < points.length; i++) walk(points[i - 1], points[i]);
    pause(points[points.length - 1], 3, 'HedgehogSniff');
    pause(points[points.length - 1], 2, 'HedgehogIdle');
    for (let i = points.length - 1; i > 0; i--) walk(points[i], points[i - 1]);
    pause(habitat.portal, 2, 'HedgehogSniff');
    return segments;
}
export function sampleHedgehogVisit(
    segments: HedgehogSegment[],
    seconds: number,
) {
    let offset = 0;
    const firstWalk = segments.find(
        (segment) => segment.clip === 'HedgehogWalk',
    );
    let yaw = firstWalk
        ? Math.atan2(
              -(firstWalk.to.x - firstWalk.from.x),
              -(firstWalk.to.z - firstWalk.from.z),
          )
        : 0;
    for (const segment of segments) {
        if (segment.clip === 'HedgehogWalk')
            yaw = Math.atan2(
                -(segment.to.x - segment.from.x),
                -(segment.to.z - segment.from.z),
            );
        if (seconds < offset + segment.duration)
            return {
                position: segment.from
                    .clone()
                    .lerp(
                        segment.to,
                        Math.max(
                            0,
                            (seconds - offset) /
                                Math.max(0.001, segment.duration),
                        ),
                    ),
                yaw,
                clip: segment.clip,
                clipTime: Math.max(0, seconds - offset),
                complete: false,
            };
        offset += segment.duration;
    }
    return {
        position: segments.at(-1)?.to.clone() ?? new Vector3(),
        yaw,
        clip: 'HedgehogIdle' satisfies HedgehogClip,
        clipTime: 0,
        complete: true,
    };
}
