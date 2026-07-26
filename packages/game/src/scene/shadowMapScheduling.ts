type ShadowLightPosition = {
    x: number;
    y: number;
    z: number;
};

type ShadowMapRefreshTarget = {
    enabled: boolean;
    needsUpdate: boolean;
};

export function requestPrimaryShadowMapRefresh(
    shadowMap: ShadowMapRefreshTarget,
    enabled: boolean,
    refreshCount: number,
) {
    if (!enabled) {
        return refreshCount;
    }

    shadowMap.enabled = true;
    shadowMap.needsUpdate = true;
    return refreshCount + 1;
}

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
