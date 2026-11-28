'use client';

import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import { updateGameProfileMetadata } from '../../gameProfileMetadata';
import { useSceneTimeInvalidation } from '../../SceneTime';
import { SnowDiscs } from '../../Snow/SnowDiscs';
import { SnowIconFlakes } from '../../Snow/SnowIconFlakes';
import { SnowSparkles } from '../../Snow/SnowSparkles';
import {
    resolveSnowSparkleAmount,
    resolveSnowSparkleCount,
} from '../../Snow/snowParticles';
import { useSnowField } from '../../Snow/useSnowField';
import { usePrecipitationFieldPosition } from '../../usePrecipitationFieldPosition';
import {
    isWeatherLayerHidden,
    useWeatherFrame,
    type WeatherFrame,
} from '../WeatherFrameContext';
import { resolveSnowFlakeCounts } from '../weatherTierCaps';

/**
 * Falling snow: soft two-tone discs and spinning icon snowflakes in a field
 * that covers the view (GAME_ART.md "Weather > Snow"). The group keeps the
 * scene name `Weather:Snow` and follows the camera target like the legacy
 * field (`PrecipitationCameraFollowFixture`).
 */
function SnowFall({
    discs,
    frame,
    iconFlakes,
}: {
    discs: number;
    frame: WeatherFrame;
    iconFlakes: number;
}) {
    const fieldRef = useRef<Group>(null);
    usePrecipitationFieldPosition({ fieldRef, followCamera: true });
    useSceneTimeInvalidation('snow-particles');
    const field = useSnowField(frame);
    const { caps, reducedMotion, roles } = frame;

    return (
        <group name="Weather:Snow" ref={fieldRef}>
            <SnowDiscs
                capacity={caps.snowCapacity}
                count={discs}
                field={field}
                roles={roles}
            />
            <SnowIconFlakes
                capacity={caps.iconFlakeCapacity}
                count={iconFlakes}
                field={field}
                reducedMotion={reducedMotion}
                roles={roles}
            />
        </group>
    );
}

/**
 * WP3: two-tone flakes, spinning icon snowflakes and sparkles on cover
 * (GAME_ART.md "Weather > Snow"). Counts follow the tier, `snowy` and the
 * view's pixel area; colours come from the weather roles; reduced motion
 * slows the fall to 25%, stops the spin and drops the sparkles. Hidden with
 * `hideWeather=snow`.
 */
export function SnowLayer() {
    const frame = useWeatherFrame();
    const hidden = isWeatherLayerHidden(frame, 'snow');
    const { amounts, caps, reducedMotion, roles, viewAreaScale } = frame;
    const counts = hidden
        ? { discs: 0, iconFlakes: 0, total: 0 }
        : resolveSnowFlakeCounts(caps, amounts.snowy, viewAreaScale);
    const sparkleCount = hidden
        ? 0
        : resolveSnowSparkleCount(
              caps.sparkles,
              amounts.snowCover,
              reducedMotion,
          );
    const sparkleAmount = resolveSnowSparkleAmount(amounts.snowCover);
    const snowing = counts.total > 0;

    useEffect(() => {
        updateGameProfileMetadata({
            snowIconFlakeCount: counts.iconFlakes,
            snowParticleCapacity: snowing
                ? caps.snowCapacity + caps.iconFlakeCapacity
                : 0,
            snowParticleCount: counts.total,
            snowSparkleCount: sparkleCount,
        });
    }, [
        caps.iconFlakeCapacity,
        caps.snowCapacity,
        counts.iconFlakes,
        counts.total,
        snowing,
        sparkleCount,
    ]);

    useEffect(
        () => () =>
            updateGameProfileMetadata({
                snowIconFlakeCount: 0,
                snowParticleCapacity: 0,
                snowParticleCount: 0,
                snowSparkleCount: 0,
            }),
        [],
    );

    return (
        <>
            {snowing && (
                <SnowFall
                    discs={counts.discs}
                    frame={frame}
                    iconFlakes={counts.iconFlakes}
                />
            )}
            {sparkleCount > 0 && (
                <SnowSparkles
                    amount={sparkleAmount}
                    capacity={caps.sparkles}
                    count={sparkleCount}
                    roles={roles}
                />
            )}
        </>
    );
}
