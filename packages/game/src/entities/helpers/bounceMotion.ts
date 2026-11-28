import type { BlockPlacementAnimationKind } from '../../useGameState';

/**
 * Timing for the toy bounce of GAME_ART.md, "Motion": squash and stretch that
 * preserves volume, pops that overshoot a little and settle within 450 ms.
 * The springs are react-spring configs; their maths is checked by
 * `bounceMotion.unit.ts` with the analytic response below.
 */

/**
 * Squash and stretch for each kind of bounce. `squash` is how far the block
 * flattens on impact and `stretch` how far it elongates in the air, both as a
 * fraction of its height. Width and depth move the opposite way by half as
 * much, which keeps the volume roughly constant.
 */
export const bounceMotions = {
    // A new block falls in from a small height, stretched, then lands.
    drop: { hop: 0, lift: 0.16, particles: true, squash: 0.16, stretch: 0.07 },
    // A moved block is already at rest and only absorbs the landing.
    land: { hop: 0, lift: 0, particles: false, squash: 0.14, stretch: 0 },
    // A grabbed block gives a little under the hand.
    pickup: { hop: 0, lift: 0, particles: false, squash: 0.09, stretch: 0 },
    // A clicked block hops.
    tap: { hop: 0.14, lift: 0, particles: false, squash: 0.12, stretch: 0.07 },
    // Fresh harvest drops in like a placed block, without placement dust.
    harvest: {
        hop: 0,
        lift: 0.16,
        particles: false,
        squash: 0.16,
        stretch: 0.07,
    },
} as const satisfies Record<
    BlockPlacementAnimationKind | 'harvest',
    {
        hop: number;
        lift: number;
        particles: boolean;
        squash: number;
        stretch: number;
    }
>;

export type BounceMotionKind = keyof typeof bounceMotions;

/**
 * react-spring merges each new config into the one a spring last ran with, so
 * every config states `clamp`: a clamped fall must not cut the landing
 * wobble that follows it short.
 */
export type SpringConfig = {
    clamp: boolean;
    friction: number;
    mass: number;
    tension: number;
};

/**
 * Rise and fall are underdamped and clamped: they stop the moment they reach
 * the apex or the ground, instead of creeping toward it, so the impact lands
 * on the frame the block touches down.
 */
export const riseConfig = {
    mass: 0.1,
    tension: 420,
    friction: 10,
    clamp: true,
} satisfies SpringConfig;
export const fallConfig = {
    mass: 0.1,
    tension: 260,
    friction: 8,
    clamp: true,
} satisfies SpringConfig;
/**
 * Loose enough to overshoot once or twice before settling. The squash takes
 * about 75 ms to spring back, so it reads for a few frames at 60 fps.
 */
export const settleConfig = {
    mass: 0.12,
    tension: 120,
    friction: 3.6,
    clamp: false,
} satisfies SpringConfig;

/** Hovered toys grow a little, inside GAME_ART's 1.06 to 1.09. */
export const hoverPopScale = 1.07;
/**
 * Overshoots the hover scale once, to about 1.083, and settles within the
 * 450 ms of a pop.
 */
export const hoverPopConfig = {
    mass: 1,
    tension: 520,
    friction: 22,
    clamp: false,
} satisfies SpringConfig;

/** Volume-preserving scale for a squash (negative) or stretch (positive). */
export function squashScale(squash: number) {
    const value = Number.isFinite(squash) ? squash : 0;
    return { side: 1 - value / 2, up: 1 + value };
}

/** A bounce at one moment: height offset and squash (negative) or stretch. */
export type BouncePose = readonly [offsetY: number, squash: number];

export type BouncePivot = readonly [number, number, number];

/**
 * Group transform for a bounce pose. Scaling about the pivot is a scale plus a
 * shift of (1 - scale) * pivot, so the block squashes toward the point it
 * stands on: height scales by `1 + squash`, width and depth by
 * `1 - squash / 2`.
 *
 * Each value is linear in the pose, so springs that animate all of them with
 * one config stay a valid bounce at every frame. Scene springs are animated
 * values on their own; derived `.to()` interpolations would wait for
 * react-spring's global frame loop, which scene frames do not drive.
 */
export function bouncePoseTransform(
    [offsetY, squash]: BouncePose,
    [pivotX, pivotY, pivotZ]: BouncePivot,
) {
    const { side, up } = squashScale(squash);
    return {
        positionX: (1 - side) * pivotX,
        positionY: offsetY + (1 - up) * pivotY,
        positionZ: (1 - side) * pivotZ,
        scaleSide: side,
        scaleUp: up,
    };
}

/** Group transform for a uniform pop of `scale` about the pivot. */
export function popTransform(scale: number, [x, y, z]: BouncePivot) {
    const value = Number.isFinite(scale) ? scale : 1;
    return {
        positionX: (1 - value) * x,
        positionY: (1 - value) * y,
        positionZ: (1 - value) * z,
        scale: value,
    };
}

function springTerms(config: SpringConfig) {
    const omega = Math.sqrt(config.tension / config.mass);
    const zeta =
        config.friction / (2 * Math.sqrt(config.tension * config.mass));
    return { omega, zeta };
}

/**
 * Analytic position of a spring released at rest from 0 toward 1, `t` seconds
 * later. react-spring integrates the same equation, with tension and
 * friction in per-second units.
 */
export function springStepResponse(config: SpringConfig, t: number) {
    if (!(t > 0)) return 0;
    const { omega, zeta } = springTerms(config);
    if (zeta >= 1) {
        // Critically damped or slower: no overshoot. Approximate with the
        // critical response, which bounds an overdamped spring from above.
        return 1 - Math.exp(-omega * t) * (1 + omega * t);
    }
    const damped = omega * Math.sqrt(1 - zeta * zeta);
    const value =
        1 -
        Math.exp(-zeta * omega * t) *
            (Math.cos(damped * t) +
                (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(damped * t));
    return config.clamp ? Math.min(1, value) : value;
}

/** Largest overshoot past the target, as a fraction of the step. */
export function springOvershoot(config: SpringConfig) {
    const { zeta } = springTerms(config);
    if (config.clamp || zeta >= 1) return 0;
    return Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));
}

/**
 * Seconds until the spring stays within `tolerance` of its target, as a
 * fraction of the step, measured on the analytic response.
 */
export function springSettleSeconds(config: SpringConfig, tolerance = 0.02) {
    const step = 0.001;
    let settled = 0;
    for (let t = step; t < 5; t += step) {
        if (Math.abs(springStepResponse(config, t) - 1) > tolerance)
            settled = t;
    }
    return settled;
}
