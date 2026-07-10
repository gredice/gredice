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
import { createPrecipitationMaterial } from '../PrecipitationMaterial';
import { useSceneTimeInvalidation, useSceneTimeUniform } from '../SceneTime';

const DEFAULT_FLAKE_SIZE = 0.07;
const DEFAULT_SIZE = 30;
const DEFAULT_HEIGHT = 5;
const DEFAULT_HEIGHT_OFFSET = 10;
const DEFAULT_GRAVITY = 0.002;
const DEFAULT_GROUND_LEVEL = 0;

const snowVertexShader = /* glsl */ `
    attribute vec4 instanceSnowBase;
    attribute vec4 instanceSnowMotion;
    attribute vec4 instanceSnowShape;

    uniform float uTime;
    uniform float uSize;
    uniform float uHeightRange;
    uniform float uGroundLevel;

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
        float screenY =
            mod(instanceSnowBase.y - uTime * instanceSnowBase.w, uHeightRange) -
            uHeightRange * 0.5;
        float x = wrapRange(
            instanceSnowBase.x +
                instanceSnowMotion.x * uTime +
                sin(uTime * 0.85 + instanceSnowMotion.z) * 0.28,
            -halfSize,
            halfSize
        );
        float z = wrapRange(
            instanceSnowBase.z + instanceSnowMotion.y * uTime,
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
    const camera = useThree((state) => state.camera);
    const gameCamera = useGameState((state) => state.gameCamera);
    const timeUniform = useSceneTimeUniform();
    useSceneTimeInvalidation();
    // Convert wind direction (0-360 degrees) to directional components
    // 0° = North (negative z), 90° = East (positive x), 180° = South (positive z), 270° = West (negative x)
    const windDirectionRadians = (windDirection * Math.PI) / 180;
    const windDriftX = Math.sin(windDirectionRadians) * windSpeed;
    const windDriftZ = -Math.cos(windDirectionRadians) * windSpeed;
    const heightRange = Math.max(0.001, height + heightOffset - groundLevel);
    const fallSpeedBase = Math.max(0.2, gravity * 280 + windSpeed * 0.08);

    const geometry = useMemo(() => {
        const snowGeometry = new THREE.PlaneGeometry(1, 1);
        const baseAttributes = new Float32Array(count * 4);
        const motionAttributes = new Float32Array(count * 4);
        const shapeAttributes = new Float32Array(count * 4);

        for (let i = 0; i < count; i++) {
            const baseOffset = i * 4;
            baseAttributes[baseOffset] = (Math.random() - 0.5) * size;
            baseAttributes[baseOffset + 1] = Math.random() * heightRange;
            baseAttributes[baseOffset + 2] = (Math.random() - 0.5) * size;
            baseAttributes[baseOffset + 3] =
                THREE.MathUtils.randFloat(0.55, 1.35) + fallSpeedBase;

            const motionOffset = i * 4;
            motionAttributes[motionOffset] =
                THREE.MathUtils.randFloatSpread(0.22) + windDriftX * 0.3;
            motionAttributes[motionOffset + 1] =
                THREE.MathUtils.randFloatSpread(0.16) + windDriftZ * 0.3;
            motionAttributes[motionOffset + 2] = Math.random() * Math.PI * 2;
            motionAttributes[motionOffset + 3] = THREE.MathUtils.randFloat(
                0.45,
                1.25,
            );

            const shapeOffset = i * 4;
            shapeAttributes[shapeOffset] =
                flakeSize * THREE.MathUtils.randFloat(0.75, 1.25);
            shapeAttributes[shapeOffset + 1] = THREE.MathUtils.randFloat(
                0.86,
                1,
            );
            shapeAttributes[shapeOffset + 2] = 0;
            shapeAttributes[shapeOffset + 3] = 0;
        }

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
    }, [
        count,
        fallSpeedBase,
        flakeSize,
        heightRange,
        size,
        windDriftX,
        windDriftZ,
    ]);

    useEffect(() => () => geometry.dispose(), [geometry]);

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

    const material = useMemo(
        () =>
            createPrecipitationMaterial({
                fragmentShader: snowFragmentShader,
                timeUniform,
                uniforms: {
                    uSize: { value: size },
                    uHeightRange: { value: heightRange },
                    uGroundLevel: { value: groundLevel },
                },
                vertexShader: snowVertexShader,
            }),
        [groundLevel, heightRange, size, timeUniform],
    );

    useEffect(() => () => material.dispose(), [material]);

    return (
        <group ref={fref} name="Weather:Snow">
            <instancedMesh
                name={`Weather:SnowFlakes:count:${count}`}
                args={[geometry, undefined, count]}
                frustumCulled={false}
                renderOrder={36}
            >
                <primitive attach="material" object={material} />
            </instancedMesh>
        </group>
    );
};

export default Snow;
