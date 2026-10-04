export const leafRakingDurationMs = 900;
export const leafRakingCooldownMs = 2200;
export const leafRakingParticleCount = 8;

export function isLeafRakingDecoration(name: string) {
    return (
        name === 'LeafRake' ||
        name === 'AutumnLeafPileMound' ||
        name === 'AutumnLeafPileCrescent'
    );
}

export function leafRakingAnchorName(name: string, id: string) {
    return `${name === 'LeafRake' ? 'LeafRake' : 'AutumnLeafPile'}:rake-anchor:${id}`;
}

export function getLeafRakingTargets(
    stacks: readonly { blocks: readonly { id: string; name: string }[] }[],
) {
    return stacks.flatMap((stack) => {
        const block = stack.blocks.at(-1);
        return block && isLeafRakingDecoration(block.name) ? [block] : [];
    });
}

export function sampleLeafRaking(progress: number, index: number) {
    const p = Math.min(1, Math.max(0, progress));
    const angle = index * 2.39996;
    const distance = (0.16 + (index % 3) * 0.06) * p;
    return {
        x: Math.cos(angle) * distance,
        y: Math.sin(Math.PI * p) * (0.12 + (index % 4) * 0.025),
        z: Math.sin(angle) * distance,
        rotation: angle + p * 2,
        scale: Math.max(0, 1 - p),
        sweepAngle: -0.9 + p * 1.8,
    };
}

type LeafRakingAction = {
    targetId: string;
    origin: [number, number, number];
    startedAtMs: number;
    sceneTime: number;
    reducedMotion: boolean;
    phase: 'sweeping' | 'cooldown';
};
type Snapshot = {
    available: boolean;
    action: LeafRakingAction | null;
    lastTargetId: string | null;
};

/** One local cosmetic action per scene; no timers, persistence, rewards or domain commands. */
export function createLeafRakingController() {
    let snapshot: Snapshot = {
        available: false,
        action: null,
        lastTargetId: null,
    };
    let handler: ((targetId: string, sound: boolean) => boolean) | null = null;
    const listeners = new Set<() => void>();
    const publish = (next: Snapshot) => {
        snapshot = next;
        for (const listener of listeners) listener();
    };
    const reset = () =>
        publish({ ...snapshot, action: null, lastTargetId: null });
    return {
        getSnapshot: () => snapshot,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        connect(nextHandler: NonNullable<typeof handler>) {
            handler = nextHandler;
            publish({ available: true, action: null, lastTargetId: null });
            return () => {
                if (handler !== nextHandler) return;
                handler = null;
                publish({ available: false, action: null, lastTargetId: null });
            };
        },
        request(targetId: string, sound: boolean) {
            return handler?.(targetId, sound) ?? false;
        },
        start(input: Omit<LeafRakingAction, 'phase'>) {
            if (
                !snapshot.available ||
                snapshot.action ||
                !input.origin.every(Number.isFinite) ||
                !Number.isFinite(input.startedAtMs) ||
                !Number.isFinite(input.sceneTime)
            )
                return false;
            publish({
                available: true,
                action: { ...input, phase: 'sweeping' },
                lastTargetId: input.targetId,
            });
            return true;
        },
        advance(nowMs: number) {
            const action = snapshot.action;
            if (!action || !Number.isFinite(nowMs)) return;
            const elapsed = nowMs - action.startedAtMs;
            if (elapsed >= leafRakingCooldownMs)
                publish({ ...snapshot, action: null });
            else if (
                action.phase === 'sweeping' &&
                elapsed >= (action.reducedMotion ? 180 : leafRakingDurationMs)
            )
                publish({
                    ...snapshot,
                    action: { ...action, phase: 'cooldown' },
                });
        },
        reset,
    };
}
