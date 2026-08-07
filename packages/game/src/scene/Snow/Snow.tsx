import { useThree } from '@react-three/fiber';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import * as THREE from 'three';
import { useGameState } from '../../useGameState';
import { updateGameProfileMetadata } from '../gameProfileMetadata';
import { createPrecipitationMaterial } from '../PrecipitationMaterial';
import { useSceneTimeInvalidation, useSceneTimeUniform } from '../SceneTime';
import {
    advanceSnowMotionOffset,
    clampSnowParticleCount,
    createSnowParticleAttributes,
    resolveSnowWeatherMotion,
} from './snowParticles';

const DEFAULT_FLAKE_SIZE = 0.07;
const DEFAULT_SIZE = 30;
const DEFAULT_HEIGHT = 5;
const DEFAULT_HEIGHT_OFFSET = 10;
const DEFAULT_GRAVITY = 0.002;
const DEFAULT_GROUND_LEVEL = 0;
let snowParticleGeometryBuildCount = 0;
const reportedSnowParticleGeometries = new WeakSet<THREE.BufferGeometry>();

const snowVertexShader = /* glsl */ `
    attribute vec4 instanceSnowBase;
    attribute vec4 instanceSnowMotion;
    attribute vec4 instanceSnowShape;

    uniform float uTime;
    uniform float uSize;
    uniform float uHeightRange;
    uniform float uGroundLevel;
    uniform float uFallOffset;
    uniform float uFallVelocity;
    uniform float uMotionEpoch;
    uniform vec2 uWindOffset;
    uniform vec2 uWindVelocity;

    varying vec2 vUv;
    varying float vSnowBrightness;

    float wrapRange(float value, float minValue, float maxValue) {
        float range = max(maxValue - minValue, 0.0001);
        return mod(value - minValue, range) + minValue;
    }

    mat2 rotate2d(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat2(
            c, -s,
            s, c
        );
    }

    void main() {
        vUv = uv;
        float halfSize = uSize * 0.5;
        float weatherMotionTime = max(0.0, uTime - uMotionEpoch);
        float weatherFallOffset =
            uFallOffset + uFallVelocity * weatherMotionTime;
        vec2 weatherWindOffset =
            uWindOffset + uWindVelocity * weatherMotionTime;
        float screenY =
            mod(
                instanceSnowBase.y -
                    uTime * instanceSnowBase.w -
                    weatherFallOffset,
                uHeightRange
            ) -
            uHeightRange * 0.5;
        float x = wrapRange(
            instanceSnowBase.x +
                instanceSnowMotion.x * uTime +
                weatherWindOffset.x +
                sin(uTime * 0.85 + instanceSnowMotion.z) * 0.28,
            -halfSize,
            halfSize
        );
        float z = wrapRange(
            instanceSnowBase.z +
                instanceSnowMotion.y * uTime +
                weatherWindOffset.y,
            -halfSize,
            halfSize
        );

        float rotation = uTime * instanceSnowMotion.w + instanceSnowMotion.z;
        vec3 localCenter = vec3(x, uGroundLevel + 2.0, z);
        vec4 centerView = modelViewMatrix * vec4(localCenter, 1.0);
        centerView.y += screenY;
        vec2 flakeCorner = position.xy * vec2(0.72, 1.18) * instanceSnowShape.x;
        centerView.xy += rotate2d(rotation) * flakeCorner;

        vSnowBrightness = instanceSnowShape.y;
        gl_Position = projectionMatrix * centerView;
    }
`;

const snowFragmentShader = /* glsl */ `
    varying vec2 vUv;
    varying float vSnowBrightness;

    void main() {
        vec2 center = vUv - 0.5;
        float core = 1.0 - smoothstep(0.14, 0.5, length(center));
        float sparkle = 1.0 - smoothstep(0.0, 0.5, abs(center.x) + abs(center.y));
        float alpha = max(core, sparkle * 0.45);

        if (alpha < 0.02) {
            discard;
        }

        vec3 snowColor = vec3(
            vSnowBrightness * 0.95,
            vSnowBrightness * 0.98,
            vSnowBrightness
        );

        gl_FragColor = vec4(snowColor, alpha * 0.96);
    }
`;

// Note: Source - https://tympanus.net/codrops/2025/09/18/creating-an-immersive-3d-weather-visualization-with-react-three-fiber/

const Snow = ({
    activeCount,
    capacity,
    count = 500,
    windSpeed = 0.5,
    windDirection = 0,
    size = DEFAULT_SIZE,
    height = DEFAULT_HEIGHT,
    heightOffset = DEFAULT_HEIGHT_OFFSET,
    groundLevel = DEFAULT_GROUND_LEVEL,
    flakeSize = DEFAULT_FLAKE_SIZE,
    gravity = DEFAULT_GRAVITY,
}: {
    activeCount?: number;
    capacity?: number;
    count?: number;
    windSpeed?: number;
    windDirection?: number;
    /** Area size (width/depth) of the snow field */
    size?: number;
    /** Height range for particles */
    height?: number;
    /** Vertical offset for particle spawn */
    heightOffset?: number;
    /** Y level where particles reset */
    groundLevel?: number;
    /** Size of individual snowflakes */
    flakeSize?: number;
    /** Base gravity/fall speed */
    gravity?: number;
}) => {
    const fref = useRef<THREE.Group>(null);
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const camera = useThree((state) => state.camera);
    const gameCamera = useGameState((state) => state.gameCamera);
    const timeUniform = useSceneTimeUniform();
    useSceneTimeInvalidation();
    const heightRange = Math.max(0.001, height + heightOffset - groundLevel);
    const requestedActiveCount = activeCount ?? count;
    const particleCapacity = Math.max(
        0,
        Math.floor(capacity ?? requestedActiveCount),
    );
    const visibleParticleCount = clampSnowParticleCount(
        requestedActiveCount,
        particleCapacity,
    );
    const { fallVelocity, windVelocityX, windVelocityZ } =
        resolveSnowWeatherMotion({ gravity, windDirection, windSpeed });

    const geometry = useMemo(() => {
        const snowGeometry = new THREE.PlaneGeometry(1, 1);
        const { baseAttributes, motionAttributes, shapeAttributes } =
            createSnowParticleAttributes({
                capacity: particleCapacity,
                flakeSize,
                heightRange,
                size,
            });

        snowGeometry.setAttribute(
            'instanceSnowBase',
            new THREE.InstancedBufferAttribute(baseAttributes, 4),
        );
        snowGeometry.setAttribute(
            'instanceSnowMotion',
            new THREE.InstancedBufferAttribute(motionAttributes, 4),
        );
        snowGeometry.setAttribute(
            'instanceSnowShape',
            new THREE.InstancedBufferAttribute(shapeAttributes, 4),
        );

        return snowGeometry;
    }, [flakeSize, heightRange, particleCapacity, size]);

    useEffect(() => {
        if (!reportedSnowParticleGeometries.has(geometry)) {
            reportedSnowParticleGeometries.add(geometry);
            snowParticleGeometryBuildCount += 1;
            updateGameProfileMetadata({ snowParticleGeometryBuildCount });
        }

        return () => geometry.dispose();
    }, [geometry]);

    const updateSnowFieldPosition = useCallback((x: number, z: number) => {
        const group = fref.current;
        if (!group) {
            return;
        }

        group.position.set(x, 0, z);
    }, []);

    useLayoutEffect(() => {
        const snapshot = gameCamera?.getSnapshot();
        updateSnowFieldPosition(
            snapshot?.target[0] ?? camera.position.x,
            snapshot?.target[2] ?? camera.position.z,
        );

        if (!gameCamera) {
            return;
        }

        return gameCamera.subscribe((snapshot) => {
            updateSnowFieldPosition(snapshot.target[0], snapshot.target[2]);
        });
    }, [camera, gameCamera, updateSnowFieldPosition]);

    const weatherMotionUniforms = useMemo(
        () => ({
            uFallOffset: { value: 0 },
            uFallVelocity: { value: 0 },
            uMotionEpoch: { value: timeUniform.value },
            uWindOffset: { value: new THREE.Vector2() },
            uWindVelocity: { value: new THREE.Vector2() },
        }),
        [timeUniform],
    );

    useLayoutEffect(() => {
        const elapsed = Math.max(
            0,
            timeUniform.value - weatherMotionUniforms.uMotionEpoch.value,
        );
        weatherMotionUniforms.uFallOffset.value = advanceSnowMotionOffset(
            weatherMotionUniforms.uFallOffset.value,
            weatherMotionUniforms.uFallVelocity.value,
            elapsed,
            heightRange,
        );
        weatherMotionUniforms.uWindOffset.value.set(
            advanceSnowMotionOffset(
                weatherMotionUniforms.uWindOffset.value.x,
                weatherMotionUniforms.uWindVelocity.value.x,
                elapsed,
                size,
            ),
            advanceSnowMotionOffset(
                weatherMotionUniforms.uWindOffset.value.y,
                weatherMotionUniforms.uWindVelocity.value.y,
                elapsed,
                size,
            ),
        );
        weatherMotionUniforms.uFallVelocity.value = fallVelocity;
        weatherMotionUniforms.uWindVelocity.value.set(
            windVelocityX,
            windVelocityZ,
        );
        weatherMotionUniforms.uMotionEpoch.value = timeUniform.value;
    }, [
        fallVelocity,
        heightRange,
        size,
        timeUniform,
        weatherMotionUniforms,
        windVelocityX,
        windVelocityZ,
    ]);

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        mesh.count = visibleParticleCount;
        mesh.visible = visibleParticleCount > 0;
    }, [visibleParticleCount]);

    const material = useMemo(
        () =>
            createPrecipitationMaterial({
                fragmentShader: snowFragmentShader,
                timeUniform,
                uniforms: {
                    ...weatherMotionUniforms,
                    uSize: { value: size },
                    uHeightRange: { value: heightRange },
                    uGroundLevel: { value: groundLevel },
                },
                vertexShader: snowVertexShader,
            }),
        [groundLevel, heightRange, size, timeUniform, weatherMotionUniforms],
    );

    useEffect(() => () => material.dispose(), [material]);

    return (
        <group ref={fref} name="Weather:Snow">
            <instancedMesh
                ref={meshRef}
                name={`Weather:SnowFlakes:count:${visibleParticleCount}:capacity:${particleCapacity}`}
                args={[geometry, undefined, particleCapacity]}
                frustumCulled={false}
                renderOrder={36}
            >
                <primitive attach="material" object={material} />
            </instancedMesh>
        </group>
    );
};

export default Snow;
