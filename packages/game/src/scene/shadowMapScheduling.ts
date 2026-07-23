type ShadowLightPosition = {
    x: number;
    y: number;
    z: number;
};

export const cloudShadowRefreshMsByMode = {
    hard: 160,
    soft: 96,
} as const;

function formatShadowSignatureValue(value: number) {
    return Number.isFinite(value) ? value.toFixed(4) : '0';
}

export function buildDirectionalShadowDepthSignature({
    lightPosition,
    shadowCameraSize,
    shadowMapSize,
    shadows,
}: {
    lightPosition: ShadowLightPosition;
    shadowCameraSize: number;
    shadowMapSize: number;
    shadows: boolean;
}) {
    return [
        shadows ? 'shadows' : 'no-shadows',
        shadowMapSize,
        formatShadowSignatureValue(shadowCameraSize),
        formatShadowSignatureValue(lightPosition.x),
        formatShadowSignatureValue(lightPosition.y),
        formatShadowSignatureValue(lightPosition.z),
    ].join('|');
}

export function hasShadowDynamicCadenceChanged(
    previousRefreshMs: number | undefined,
    refreshMs: number | undefined,
) {
    return previousRefreshMs !== refreshMs;
}

export function resolveShadowMapRefreshTick({
    dynamicRefreshMs,
    nextDynamicRefreshAt,
    now,
    settleUntil,
}: {
    dynamicRefreshMs: number | undefined;
    nextDynamicRefreshAt: number;
    now: number;
    settleUntil: number;
}) {
    const hasDynamicRefresh =
        typeof dynamicRefreshMs === 'number' &&
        Number.isFinite(dynamicRefreshMs) &&
        dynamicRefreshMs > 0;
    const shouldRefreshDynamic =
        hasDynamicRefresh && now >= nextDynamicRefreshAt;
    const shouldRefreshSettling = now <= settleUntil;

    return {
        nextDynamicRefreshAt: shouldRefreshDynamic
            ? now + dynamicRefreshMs
            : hasDynamicRefresh
              ? nextDynamicRefreshAt
              : 0,
        shouldRefresh: shouldRefreshSettling || shouldRefreshDynamic,
        shouldRefreshDynamic,
        shouldRefreshSettling,
    };
}
