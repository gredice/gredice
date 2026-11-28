'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useCurrentGarden } from '../../../hooks/useCurrentGarden';
import { useSceneCurrentGarden } from '../../../hooks/useSceneCurrentGarden';
import { RainPuddles } from '../../../rain/RainPuddles';
import { RainRipples } from '../../../rain/RainRipples';
import { RainSplashes } from '../../../rain/RainSplashes';
import {
    resolveRainWetSheenColor,
    setRainWetSheenColor,
} from '../../../rain/rainWetSheen';
import { updateGameProfileMetadata } from '../../gameProfileMetadata';
import { RainDropField } from '../../Rain/Drops';
import {
    rainDropLook,
    resolveRainDropFallSpeed,
    resolveRainDropMotion,
    resolveRainDropOpacity,
    resolveRainDropSizePx,
    resolveRainSplashCount,
    resolveRainSplashOpacity,
} from '../../Rain/rainParticles';
import { useSceneRenderRequest } from '../../SceneTime';
import { isWeatherLayerHidden, useWeatherFrame } from '../WeatherFrameContext';
import { resolveRainDropCount } from '../weatherTierCaps';
import {
    resolveRainSlant,
    resolveWindScreenSide,
    resolveWindVector,
} from '../windClass';

/** Height of the terrain tops the cloud base is measured from. */
const rainGroundY = 0.4;

/** Most splash rings at once on any tier (the high tier's 29). */
const rainSplashCapacity = 29;

/**
 * WP2: slim streak rain, splash rings, puddles and the wet look
 * (GAME_ART.md "Weather > Rain and heavy rain"). Everything reads the shared
 * weather frame: the blended rain, the tier caps, the wind class, colours
 * from the roles and reduced motion. `hideWeather=rain` hides the drops and
 * splash rings; puddles and the wet look stay, as ground effects.
 */
export function RainLayer() {
    const frame = useWeatherFrame();
    const viewHeightPx = useThree((state) => state.size.height);
    const requestRender = useSceneRenderRequest();
    const { data: garden } = useCurrentGarden();
    const sceneGarden = useSceneCurrentGarden(garden);
    const stacks = sceneGarden?.stacks;
    const hidden = isWeatherLayerHidden(frame, 'rain');
    const { amounts, caps, reducedMotion, roles, view, viewAreaScale } = frame;
    const rainy = amounts.rainy;

    const dropCount = hidden
        ? 0
        : resolveRainDropCount(caps, rainy, viewAreaScale);
    const fallSpeed = resolveRainDropFallSpeed(rainy, reducedMotion);
    // Rain slants sideways on screen, toward the side the wind blows to
    // (the side the clouds and their shadows drift to).
    const wind = resolveWindVector(amounts.windDirection);
    const basis = view?.basis;
    const windSide = basis ? resolveWindScreenSide(wind, basis.right) : 1;
    const slant = resolveRainSlant(amounts.windClass, reducedMotion) * windSide;
    // The avatar views have no orthographic view: the shader then fills a
    // box in front of the camera (`rainAvatarField`), and so does the
    // motion here, in world units per second.
    const motion = resolveRainDropMotion({
        avatar: frame.cameraMode === 'avatar',
        fallSpeed,
        halfHeight: view?.halfHeight ?? 4,
        halfWidth: view?.halfWidth ?? 7,
        pixelsPerUnit:
            view?.pixelsPerUnit ?? rainDropLook.referencePixelsPerUnit,
        slant,
    });
    const size = resolveRainDropSizePx(rainy);
    const opacity = resolveRainDropOpacity(rainy);
    const splashCount = hidden
        ? 0
        : resolveRainSplashCount(caps.splashRings, rainy, reducedMotion);

    // The wet sheen follows the time of day (the puddle roles).
    useEffect(() => {
        if (
            setRainWetSheenColor(
                resolveRainWetSheenColor(roles.puddleDeep, roles.puddleLight),
            )
        ) {
            requestRender('rain-wet-sheen');
        }
    }, [requestRender, roles.puddleDeep, roles.puddleLight]);

    useEffect(() => {
        updateGameProfileMetadata({
            rainParticleCount: dropCount,
            rainSplashCount: splashCount,
        });
    }, [dropCount, splashCount]);
    useEffect(
        () => () =>
            updateGameProfileMetadata({
                rainParticleCount: 0,
                rainSplashCount: 0,
            }),
        [],
    );

    return (
        <>
            {dropCount > 0 ? (
                <RainDropField
                    capacity={caps.rainCapacity}
                    coreWidthPx={size.coreWidthPx}
                    count={dropCount}
                    fallSpeed={fallSpeed}
                    fallVelocity={motion.fallVelocity}
                    groundY={rainGroundY}
                    head={roles.rainHead}
                    lengthPx={size.lengthPx}
                    opacity={opacity}
                    quadWidthPx={size.quadWidthPx}
                    slant={slant}
                    tail={roles.rainTail}
                    viewHeightPx={viewHeightPx}
                    windVelocity={motion.windVelocity}
                />
            ) : null}
            {splashCount > 0 ? (
                <RainSplashes
                    capacity={rainSplashCapacity}
                    count={splashCount}
                    edge={roles.splashRingEdge}
                    opacity={resolveRainSplashOpacity(rainy)}
                    ring={roles.splashRing}
                    stacks={stacks}
                />
            ) : null}
            <RainPuddles
                cap={caps.puddles}
                deep={roles.puddleDeep}
                gardenId={garden?.id}
                light={roles.puddleLight}
                rainy={rainy}
                reducedMotion={reducedMotion}
                rim={roles.splashRing}
                snowCover={amounts.snowCover}
                stacks={stacks}
            />
            <RainRipples
                enabled={!hidden}
                gardenId={garden?.id}
                groundRings={false}
                reducedMotion={reducedMotion}
                snow={amounts.snowy}
                stacks={stacks}
                tier={caps.tier}
            />
        </>
    );
}
