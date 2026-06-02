import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useSceneTimeUniform } from '../SceneTime';

const DEFAULT_FLAKE_SIZE = 0.03;
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

    varying float vSnowBrightness;

    float wrapRange(float value, float minValue, float maxValue) {
        float range = max(maxValue - minValue, 0.0001);
        return mod(value - minValue, range) + minValue;
    }

    mat3 rotateX(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat3(
            1.0, 0.0, 0.0,
            0.0, c, -s,
            0.0, s, c
        );
    }

    mat3 rotateY(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat3(
            c, 0.0, s,
            0.0, 1.0, 0.0,
            -s, 0.0, c
        );
    }

    void main() {
        float halfSize = uSize * 0.5;
        float y = uGroundLevel + mod(
            instanceSnowBase.y - uGroundLevel - uTime * instanceSnowBase.w * 60.0,
            uHeightRange
        );
        float x = wrapRange(
            instanceSnowBase.x +
                instanceSnowMotion.x * uTime * 60.0 +
                sin(uTime + instanceSnowMotion.z) * 0.32,
            -halfSize,
            halfSize
        );
        float z = wrapRange(
            instanceSnowBase.z + instanceSnowMotion.y * uTime * 60.0,
            -halfSize,
            halfSize
        );

        float rotationX = uTime * instanceSnowMotion.w + instanceSnowMotion.z;
        float rotationY = uTime * instanceSnowMotion.w * 1.45 + instanceSnowMotion.z * 0.7;
        vec3 rotatedPosition =
            rotateY(rotationY) * rotateX(rotationX) * position * instanceSnowShape.x;
        vec3 transformed = rotatedPosition + vec3(x, y, z);

        vSnowBrightness = instanceSnowShape.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
    }
`;

const snowFragmentShader = /* glsl */ `
    varying float vSnowBrightness;

    void main() {
        gl_FragColor = vec4(vec3(vSnowBrightness), 1.0);
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
    const timeUniform = useSceneTimeUniform();
    // Convert wind direction (0-360 degrees) to directional components
    // 0° = North (negative z), 90° = East (positive x), 180° = South (positive z), 270° = West (negative x)
    const windDirectionRadians = (windDirection * Math.PI) / 180;
    const windDriftX = Math.sin(windDirectionRadians) * windSpeed;
    const windDriftZ = -Math.cos(windDirectionRadians) * windSpeed;
    const heightRange = Math.max(0.001, height + heightOffset - groundLevel);

    const geometry = useMemo(() => {
        const snowGeometry = new THREE.OctahedronGeometry(flakeSize, 0);
        const baseAttributes = new Float32Array(count * 4);
        const motionAttributes = new Float32Array(count * 4);
        const shapeAttributes = new Float32Array(count * 4);

        for (let i = 0; i < count; i++) {
            const baseOffset = i * 4;
            baseAttributes[baseOffset] = (Math.random() - 0.5) * size;
            baseAttributes[baseOffset + 1] =
                Math.random() * height + heightOffset;
            baseAttributes[baseOffset + 2] = (Math.random() - 0.5) * size;
            baseAttributes[baseOffset + 3] =
                Math.random() * 0.02 + gravity * windSpeed * 10;

            const motionOffset = i * 4;
            motionAttributes[motionOffset] =
                (Math.random() - 0.5) * 0.02 + windDriftX * gravity * 10;
            motionAttributes[motionOffset + 1] =
                (Math.random() - 0.5) * 0.01 + windDriftZ * gravity * 10;
            motionAttributes[motionOffset + 2] = Math.random() * Math.PI * 2;
            motionAttributes[motionOffset + 3] = THREE.MathUtils.randFloat(
                1.4,
                3.4,
            );

            const shapeOffset = i * 4;
            shapeAttributes[shapeOffset] = THREE.MathUtils.randFloat(
                0.75,
                1.25,
            );
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
        flakeSize,
        gravity,
        height,
        heightOffset,
        size,
        windDriftX,
        windDriftZ,
        windSpeed,
    ]);

    useEffect(() => () => geometry.dispose(), [geometry]);

    const uniforms = useMemo(
        () => ({
            uTime: timeUniform,
            uSize: { value: size },
            uHeightRange: { value: heightRange },
            uGroundLevel: { value: groundLevel },
        }),
        [groundLevel, heightRange, size, timeUniform],
    );

    return (
        <instancedMesh
            args={[geometry, undefined, count]}
            frustumCulled={false}
        >
            <shaderMaterial
                vertexShader={snowVertexShader}
                fragmentShader={snowFragmentShader}
                uniforms={uniforms}
            />
        </instancedMesh>
    );
};

export default Snow;
