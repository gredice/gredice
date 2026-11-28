'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mesh, Vector3 } from 'three';
import { updateGameProfileMetadata } from '../../gameProfileMetadata';
import {
    useSceneDeadline,
    useSceneElapsedTimeReader,
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneTimeInvalidation,
} from '../../SceneTime';
import { getSkyCloudGlowUniforms } from '../sky/skyCloudMaterial';
import { type SkyBoltAnchor, skyLayoutRules, viewToWorld } from '../skyLayout';
import {
    isWeatherLayerHidden,
    useWeatherFrame,
    type WeatherFrame,
} from '../WeatherFrameContext';
import { type BoltGeometryMeasure, resolveBoltGlowAmount } from './boltFlash';
import {
    getBoltGeometry,
    resolveBoltSilhouetteArea,
    resolveBoltSpan,
} from './boltGeometry';
import { createBoltMaterial } from './boltMaterial';
import { pickBoltAnchor, resolveBoltPlacement } from './boltPlacement';
import {
    createLightningSchedule,
    createSingleLightningSchedule,
    type LightningHit,
    type LightningSchedule,
    lightningMotion,
    resolveLightningEnvelope,
    silentLightningSchedule,
} from './lightningSchedule';

/** The cloud material's shared strike glow (WP1 owns the shader). */
const cloudGlow = getSkyCloudGlowUniforms();

function clearBoltGlow() {
    cloudGlow.uGlow.value = 0;
}

/**
 * The storm (GAME_ART.md "Weather > Storm and lightning"): a toy bolt that
 * hangs from the overcast deck's lower edge (thunder always brings the deck;
 * never from a free-sky cloud, since there are none), one strike every 7 to
 * 11 s, and a warm glow on the deck around the bolt's root. Between strikes the
 * storm reads through the violet storm tones the sky and clouds take from
 * the damped storm amount, and through the wind layer. A strike changes no
 * light, fog, sky or exposure, so the static cache never rebuilds for it.
 */
export function StormLayer() {
    const frame = useWeatherFrame();
    const show =
        frame.amounts.thundery > 0 &&
        frame.cameraMode === 'orthographic' &&
        !isWeatherLayerHidden(frame, 'lightning');

    useEffect(() => {
        if (!show) clearBoltGlow();
    }, [show]);

    return show ? <StormBolt frame={frame} /> : null;
}

type Placement = {
    position: Vector3;
    glowPosition: Vector3;
    glowRadius: number;
    heightWorld: number;
    out: 1 | -1;
};

/**
 * Where the bolt and its glow go for an anchor, in world space: in front of
 * the garden (the band is drawn in screen space, after the bolt, so the
 * deck covers the bolt's tucked top), on the anchor's spot on screen.
 */
function placeBolt(
    frame: WeatherFrame,
    anchor: SkyBoltAnchor,
    geometry: BoltGeometryMeasure,
    out: Placement,
) {
    const view = frame.view;
    const layout = frame.skyLayout;
    if (!view || !layout) return false;
    const placement = resolveBoltPlacement({ anchor, geometry, layout, view });
    if (!placement) return false;
    const { basis, pixelsPerUnit } = view;
    const altitude = skyLayoutRules.bandAltitude;
    viewToWorld(
        basis,
        placement.centreU,
        placement.centreV,
        altitude,
        out.position,
    );
    viewToWorld(
        basis,
        placement.glowU,
        placement.glowV,
        altitude,
        out.glowPosition,
    );
    out.glowRadius = placement.glowRadiusPx / pixelsPerUnit;
    out.heightWorld = placement.heightWorld;
    out.out = placement.out;
    return true;
}

function StormBolt({ frame }: { frame: WeatherFrame }) {
    const readElapsedSeconds = useSceneElapsedTimeReader();
    const fixedTimeSeconds = useSceneFixedTimeSeconds();
    const requestRender = useSceneRenderRequest();
    const frozen = fixedTimeSeconds !== undefined;
    const reducedMotion = frame.reducedMotion;
    const debugLightning = frame.debug.lightning;

    // A live storm counts from when thunder started; a frozen clock counts
    // from 0, so a fixed-time frame always shows the same strike.
    const [stormStartSeconds] = useState(() =>
        frozen ? 0 : readElapsedSeconds(),
    );
    const debugMode = debugLightning?.mode ?? null;
    const debugSeconds =
        debugLightning?.mode === 'at' ? debugLightning.seconds : null;
    const schedule = useMemo<LightningSchedule>(() => {
        if (debugMode === 'off') return silentLightningSchedule;
        if (debugMode === 'at' && debugSeconds !== null) {
            return createSingleLightningSchedule(debugSeconds);
        }
        return createLightningSchedule({
            startSeconds: frozen ? 0 : stormStartSeconds,
        });
    }, [debugMode, debugSeconds, frozen, stormStartSeconds]);

    const geometry = getBoltGeometry();
    const span = useMemo(() => resolveBoltSpan(geometry), [geometry]);
    const measure = useMemo<BoltGeometryMeasure>(
        () => ({ silhouetteArea: resolveBoltSilhouetteArea(geometry), span }),
        [geometry, span],
    );
    const material = useMemo(() => createBoltMaterial(span), [span]);
    const mesh = useMemo(() => {
        const value = new Mesh(geometry, material);
        value.name = 'Weather:LightningBolt';
        value.frustumCulled = false;
        value.renderOrder = 26;
        value.visible = false;
        value.raycast = () => {};
        return value;
    }, [geometry, material]);
    useEffect(() => () => material.dispose(), [material]);

    const { boltFace, boltGlow, boltLight, boltSide } = frame.roles;
    useEffect(() => {
        material.uniforms.uFace.value.copy(boltFace);
        material.uniforms.uSide.value.copy(boltSide);
        material.uniforms.uLight.value.copy(boltLight);
        cloudGlow.uGlowColor.value.copy(boltGlow);
        requestRender('weather-lightning-colour');
    }, [boltFace, boltGlow, boltLight, boltSide, material, requestRender]);

    // A render lease only while a strike is on screen; between strikes a
    // deadline wakes the layer for the next one.
    const [strikeOn, setStrikeOn] = useState(false);
    const [nextStrikeAtMs, setNextStrikeAtMs] = useState<number | null>(null);
    useSceneTimeInvalidation('weather-lightning', strikeOn && !frozen);
    // Profile: live strikes since this storm started, one per strike index
    // (a strike counts once however often its lease is taken).
    const strikeCount = useRef(0);
    const countedStrike = useRef<number | null>(null);
    const countStrike = (index: number) => {
        if (countedStrike.current === index) return;
        countedStrike.current = index;
        strikeCount.current += 1;
        updateGameProfileMetadata({
            lightningStrikeCount: strikeCount.current,
        });
    };
    useEffect(
        () => () => updateGameProfileMetadata({ lightningStrikeCount: 0 }),
        [],
    );
    useSceneDeadline({
        callback: () => {
            setNextStrikeAtMs(null);
            // Only a strike that is due takes the lease; the frame plans the
            // next deadline otherwise.
            if (schedule.strikeAt(readElapsedSeconds(), reducedMotion)) {
                setStrikeOn(true);
            }
            requestRender('weather-lightning-strike');
        },
        deadlineMs: nextStrikeAtMs,
        enabled: !strikeOn && !frozen,
        owner: 'weather-lightning-next',
    });
    // biome-ignore lint/correctness/useExhaustiveDependencies: a new schedule, motion setting or layout needs one frame to place the bolt and plan the next deadline.
    useEffect(() => {
        setNextStrikeAtMs(null);
        requestRender('weather-lightning-change');
    }, [frame.skyLayout, reducedMotion, requestRender, schedule]);
    useEffect(() => () => clearBoltGlow(), []);

    const frameRef = useRef(frame);
    frameRef.current = frame;
    const placement = useMemo<Placement>(
        () => ({
            position: new Vector3(),
            glowPosition: new Vector3(),
            glowRadius: 1,
            heightWorld: 1,
            out: 1,
        }),
        [],
    );

    const hide = () => {
        if (mesh.visible) mesh.visible = false;
        cloudGlow.uGlow.value = 0;
    };

    const showStrike = (
        hit: LightningHit,
        camera: { quaternion: Mesh['quaternion'] },
    ) => {
        const current = frameRef.current;
        const layout = current.skyLayout;
        if (!layout) return hide();
        const anchor = pickBoltAnchor(layout.boltAnchors, hit.strike.side);
        if (!anchor || !placeBolt(current, anchor, measure, placement)) {
            return hide();
        }
        const envelope = resolveLightningEnvelope(hit.age, reducedMotion);
        cloudGlow.uGlow.value = resolveBoltGlowAmount(envelope.glow);
        cloudGlow.uGlowRadius.value = placement.glowRadius;
        cloudGlow.uGlowPos.value.copy(placement.glowPosition);
        // No free sky for a bolt anywhere: only the deck glows.
        if (!envelope.visible || !anchor.bolt) {
            mesh.visible = false;
            return;
        }
        const scale = placement.heightWorld / Math.max(1e-6, span.height);
        mesh.visible = true;
        mesh.position.copy(placement.position);
        mesh.quaternion.copy(camera.quaternion);
        mesh.rotateZ(
            hit.strike.lean + lightningMotion.leanOutward * placement.out,
        );
        mesh.scale.set(scale * envelope.width, scale, scale);
        material.uniforms.uOpacity.value = envelope.opacity;
        material.uniforms.uReveal.value = envelope.reveal;
        material.uniforms.uRetract.value = envelope.retract;
    };

    useFrame(({ camera }) => {
        const now = readElapsedSeconds();
        const hit = schedule.strikeAt(now, reducedMotion);
        if (!frozen) {
            const active = hit !== null;
            if (active !== strikeOn) setStrikeOn(active);
            if (hit) countStrike(hit.strike.index);
            // The frame saw the strike before its deadline fired: drop the
            // stale deadline, or it would fire as soon as the strike ends and
            // take the lease again for a strike that is already over.
            if (active && nextStrikeAtMs !== null) setNextStrikeAtMs(null);
            if (!active && nextStrikeAtMs === null) {
                const next = schedule.nextStrikeAfter(now);
                if (next) {
                    setNextStrikeAtMs(
                        performance.now() +
                            Math.max(0, next.time - now) * 1000 +
                            10,
                    );
                }
            }
        }
        if (hit) showStrike(hit, camera);
        else hide();
    });

    return <primitive object={mesh} dispose={null} />;
}
