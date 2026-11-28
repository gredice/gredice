/**
 * When the toy bolt strikes and how one strike moves (GAME_ART.md "Weather >
 * Storm and lightning"). Pure functions of scene seconds, so a frozen
 * `fixedTimeSeconds` frame always shows the same strike and the renderer
 * holds a render lease only while a strike is on screen.
 *
 * Safety: one strike every 7 to 11 s, never closer than 6.5 s, one flash per
 * strike and never a double flicker. A strike changes no light, fog, sky or
 * exposure: only the bolt and a warm glow on its own cloud.
 */

/** Strike timing in seconds, from the target page's `STRIKE` table. */
export const lightningTiming = {
    /** The first strike lands this long after a storm starts (plus jitter). */
    firstDelay: 2,
    firstDelayJitter: 1.5,
    /** Gap between strikes: 7 to 11 s. */
    gapMin: 7,
    gapJitter: 4,
    /** No two strikes closer than this, whatever the source. */
    minGap: 6.5,
    /** The bolt grows down out of its cloud over 90 ms. */
    reveal: 0.09,
    /** It holds, then pulls back up into the cloud between these times. */
    hold: 0.42,
    gone: 0.62,
    /** The cloud's glow has faded by this time. */
    glowEnd: 1.1,
    /** The glow starts fading out smoothly from here, so it never pops. */
    glowFadeFrom: 0.9,
    /** Glow decay rate after the reveal (per second). */
    glowDecay: 4.2,
    /** Reduced motion: fade in, hold and fade out, never a flash. */
    reducedIn: 1,
    reducedHold: 0.6,
    reducedOut: 1,
} as const;

/** The bolt's shape over a strike. */
export const lightningMotion = {
    /** One damped width bounce of 22% right after the reveal. */
    widthBounce: 0.22,
    bounceDamping: 9,
    bounceFrequency: 26,
    /** The bolt leans outward, away from the view centre, about 10°. */
    leanOutward: 0.18,
    /** Per-strike lean jitter, ±0.075 rad (the target's ±0.15 × 0.5). */
    leanJitter: 0.075,
    /**
     * Most of the glow role the cloud takes: 40% (GAME_ART). The cloud
     * shader clamps the glow there.
     */
    glowMax: 0.4,
    /**
     * Glow amount at the reveal, before the clamp (the target's 0.9). The
     * storm layer writes at most `glowMax` (`resolveBoltGlowAmount`), so the
     * root holds the full 40% for the first 0.2 s of the strike and the glow
     * falls off softly from the root, with no flat disc in the middle.
     */
    glowAmount: 0.9,
} as const;

export type LightningSide = 0 | 1;

export type LightningStrike = {
    /** Strike number since the storm started (the debug strike is 0). */
    index: number;
    /** Scene seconds when the bolt starts to grow. */
    time: number;
    /** 0 strikes on the left, 1 on the right; strikes alternate. */
    side: LightningSide;
    /** Extra lean in radians, added to the outward lean. */
    lean: number;
};

export type LightningHit = {
    strike: LightningStrike;
    /** Seconds since the strike started. */
    age: number;
};

export type LightningScheduleOptions = {
    /** Scene seconds when the storm started (0 under a frozen clock). */
    startSeconds: number;
    /** Varies the gaps and leans; the same seed gives the same storm. */
    seed?: number;
};

/** A deterministic 0..1 value for a seed and an index (integer hash). */
export function lightningHash(seed: number, index: number) {
    let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (index + 0x632be5ab), 0xc2b2ae35);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    h = Math.imul(h, 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
}

/** Seconds a strike stays on screen, glow included. */
export function resolveLightningWindow(reducedMotion: boolean) {
    return reducedMotion
        ? lightningTiming.reducedIn +
              lightningTiming.reducedHold +
              lightningTiming.reducedOut
        : lightningTiming.glowEnd;
}

export type LightningSchedule = {
    /** The strike on screen at scene time `t`, or null between strikes. */
    strikeAt: (t: number, reducedMotion: boolean) => LightningHit | null;
    /** The first strike that starts after scene time `t`, or null. */
    nextStrikeAfter: (t: number) => LightningStrike | null;
};

/**
 * Strikes of a storm that started at `startSeconds`: the first 2 to 3.5 s
 * later, then one every 7 to 11 s, alternating sides. Strikes are built on
 * demand and cached, so an hour-long storm costs a few hundred numbers.
 */
export function createLightningSchedule({
    seed = 1,
    startSeconds,
}: LightningScheduleOptions): LightningSchedule {
    const start = Number.isFinite(startSeconds) ? startSeconds : 0;
    const strikes: LightningStrike[] = [];

    const strike = (index: number): LightningStrike => {
        while (strikes.length <= index) {
            const i = strikes.length;
            const previous = strikes[i - 1];
            const time = previous
                ? previous.time +
                  lightningTiming.gapMin +
                  lightningTiming.gapJitter * lightningHash(seed, i * 2)
                : start +
                  lightningTiming.firstDelay +
                  lightningTiming.firstDelayJitter * lightningHash(seed, 0);
            strikes.push({
                index: i,
                time,
                side: i % 2 === 0 ? 0 : 1,
                lean:
                    (lightningHash(seed, i * 2 + 1) * 2 - 1) *
                    lightningMotion.leanJitter,
            });
        }
        const value = strikes[index];
        if (!value) {
            throw new Error(`Missing lightning strike ${index}`);
        }
        return value;
    };

    // Scene time only moves forward, so the last answer is a close start.
    let cursor = 0;

    /** Index of the last strike that started at or before `t`, or −1. */
    const lastIndexAt = (t: number) => {
        if (!(t >= strike(0).time)) return -1;
        let index = cursor;
        if (strike(index).time > t) {
            // Gaps are at most 11 s, so this index started at or before t.
            index = Math.max(
                0,
                Math.floor(
                    (t - strike(0).time) /
                        (lightningTiming.gapMin + lightningTiming.gapJitter),
                ),
            );
        }
        while (strike(index + 1).time <= t) index += 1;
        cursor = index;
        return index;
    };

    return {
        strikeAt(t, reducedMotion) {
            if (!Number.isFinite(t)) return null;
            const index = lastIndexAt(t);
            if (index < 0) return null;
            const value = strike(index);
            const age = t - value.time;
            return age <= resolveLightningWindow(reducedMotion)
                ? { strike: value, age }
                : null;
        },
        nextStrikeAfter(t) {
            if (!Number.isFinite(t)) return null;
            return strike(lastIndexAt(t) + 1);
        },
    };
}

/**
 * One strike at a fixed scene time (debug `&lightning=at:<seconds>`), on the
 * right like the target's "Strike now".
 */
export function createSingleLightningSchedule(
    seconds: number,
): LightningSchedule {
    const only: LightningStrike = {
        index: 0,
        time: seconds,
        side: 1,
        lean: 0.025,
    };
    return {
        strikeAt(t, reducedMotion) {
            if (!Number.isFinite(t) || !Number.isFinite(seconds)) return null;
            const age = t - seconds;
            return age >= 0 && age <= resolveLightningWindow(reducedMotion)
                ? { strike: only, age }
                : null;
        },
        nextStrikeAfter(t) {
            return Number.isFinite(seconds) && seconds > t ? only : null;
        },
    };
}

/** No strikes (debug `&lightning=off`). */
export const silentLightningSchedule: LightningSchedule = {
    strikeAt: () => null,
    nextStrikeAfter: () => null,
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

export type LightningEnvelope = {
    /** Share of the bolt grown down from its root, 0 to 1. */
    reveal: number;
    /** Share pulled back up from the tip, 0 to 1. */
    retract: number;
    /** Bolt opacity (only below 1 under reduced motion). */
    opacity: number;
    /** Width scale: one damped bounce of 22%. */
    width: number;
    /** Glow amount on the anchor cloud, 0 to `lightningMotion.glowAmount`. */
    glow: number;
    /** Whether any of the bolt shows. */
    visible: boolean;
};

const hiddenEnvelope: LightningEnvelope = {
    reveal: 0,
    retract: 1,
    opacity: 0,
    width: 1,
    glow: 0,
    visible: false,
};

/**
 * The bolt at `age` seconds into a strike. It grows down in 90 ms, holds
 * with one damped width bounce, pulls back up between 0.42 and 0.62 s, and
 * its cloud's glow peaks at the reveal and fades by 1.1 s. Under reduced
 * motion it only fades: in over 1 s, holds 0.6 s, out over 1 s; no growth,
 * bounce or glow.
 */
export function resolveLightningEnvelope(
    age: number,
    reducedMotion: boolean,
): LightningEnvelope {
    if (!(age >= 0) || age > resolveLightningWindow(reducedMotion)) {
        return hiddenEnvelope;
    }
    const timing = lightningTiming;
    if (reducedMotion) {
        const holdEnd = timing.reducedIn + timing.reducedHold;
        const opacity =
            smoothstep(0, timing.reducedIn, age) *
            (1 - smoothstep(holdEnd, holdEnd + timing.reducedOut, age));
        return {
            reveal: 1,
            retract: 0,
            opacity,
            width: 1,
            glow: 0,
            visible: opacity > 0.001,
        };
    }
    const reveal = smoothstep(0, timing.reveal, age);
    const retract = smoothstep(timing.hold, timing.gone, age);
    const after = Math.max(0, age - timing.reveal);
    const width =
        age < timing.reveal
            ? 1 + lightningMotion.widthBounce * reveal
            : 1 +
              lightningMotion.widthBounce *
                  Math.exp(-after * lightningMotion.bounceDamping) *
                  Math.cos(after * lightningMotion.bounceFrequency);
    const glowShape =
        age < timing.reveal ? reveal : Math.exp(-after * timing.glowDecay);
    const glow =
        lightningMotion.glowAmount *
        glowShape *
        (1 - smoothstep(timing.glowFadeFrom, timing.glowEnd, age));
    return {
        reveal,
        retract,
        opacity: 1,
        width,
        glow,
        visible: reveal > 0.001 && retract < 0.999,
    };
}
