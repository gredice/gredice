const mouseMoveCancelDistance = 6;
const touchMoveCancelDistance = 12;

export type InstancedInteractionFirstTap = {
    targetKey: string;
    timeStamp: number;
};

export type InstancedInteractionTargetReconciliation<TTarget> =
    | {
          type: 'none';
      }
    | {
          type: 'cancel';
      }
    | {
          target: TTarget;
          type: 'refresh';
      };

export function resolveInstancedInteractionTargetReconciliation<
    TTarget extends { key: string },
>(
    currentTarget: TTarget | null,
    targetsByKey: ReadonlyMap<string, TTarget>,
): InstancedInteractionTargetReconciliation<TTarget> {
    if (!currentTarget) {
        return { type: 'none' };
    }

    const nextTarget = targetsByKey.get(currentTarget.key);
    return nextTarget
        ? {
              target: nextTarget,
              type: 'refresh',
          }
        : { type: 'cancel' };
}

export function resolveInstancedDeferredSelectionClick({
    clickCount,
    pendingTargetKeys,
    suppressed,
    targetKey,
}: {
    clickCount: number;
    pendingTargetKeys: ReadonlySet<string>;
    suppressed: boolean;
    targetKey: string;
}) {
    return {
        cancelPendingTarget: pendingTargetKeys.has(targetKey),
        shouldSchedule: clickCount <= 1 && !suppressed,
    };
}

export function getPickupPointerMoveCancelDistance(pointerType: string) {
    return pointerType === 'touch'
        ? touchMoveCancelDistance
        : mouseMoveCancelDistance;
}

export function resolveInstancedRotationTap({
    distance,
    doubleTapThresholdMs,
    now,
    previousTap,
    targetKey,
    dragThreshold,
}: {
    distance: number;
    doubleTapThresholdMs: number;
    now: number;
    previousTap: InstancedInteractionFirstTap | null;
    targetKey: string;
    dragThreshold: number;
}) {
    if (distance > dragThreshold) {
        return {
            nextTap: null,
            shouldRotate: false,
        };
    }

    if (
        !previousTap ||
        previousTap.targetKey !== targetKey ||
        now - previousTap.timeStamp >= doubleTapThresholdMs
    ) {
        return {
            nextTap: {
                targetKey,
                timeStamp: now,
            },
            shouldRotate: false,
        };
    }

    return {
        nextTap: null,
        shouldRotate: true,
    };
}

export function getInstancedInteractionMountProfileMetadata({
    mounted,
    targetCount,
}: {
    mounted: boolean;
    targetCount: number;
}) {
    return {
        instancedInteractionControllerCount: mounted ? 1 : 0,
        instancedInteractionTargetCount: mounted ? targetCount : 0,
    };
}
