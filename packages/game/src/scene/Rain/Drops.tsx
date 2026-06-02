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
import { useSceneTimeUniform } from '../SceneTime';

interface DropsProps {
    count?: number;
}

const RAIN_ALPHA = 0.56;

export const Drops = ({ count = 2000 }: DropsProps) => {
    const fref = useRef<THREE.Group>(null);
    const camera = useThree((state) => state.camera);
    const gameCamera = useGameState((state) => state.gameCamera);
    const timeUniform = useSceneTimeUniform();

    const size = 40;
    const speed = 15;

    const geometry = useMemo(() => {
        const rainGeometry = new THREE.PlaneGeometry(0.5, 1);
        const seedAttributes = new Float32Array(count * 4);
        const motionAttributes = new Float32Array(count * 4);

        for (let i = 0; i < count; i++) {
            const seedOffset = i * 4;
            seedAttributes[seedOffset] = THREE.MathUtils.randFloatSpread(size);
            seedAttributes[seedOffset + 1] =
                THREE.MathUtils.randFloatSpread(size);
            seedAttributes[seedOffset + 2] = THREE.MathUtils.randFloat(
                -0.1,
                size,
            );
            seedAttributes[seedOffset + 3] = THREE.MathUtils.randFloat(
                speed * 0.72,
                speed * 1.28,
            );

            const motionOffset = i * 4;
            motionAttributes[motionOffset] = Math.random() * size;
            motionAttributes[motionOffset + 1] =
                THREE.MathUtils.randFloatSpread(0.28);
            motionAttributes[motionOffset + 2] = THREE.MathUtils.randFloat(
                0.78,
                1.18,
            );
            motionAttributes[motionOffset + 3] = THREE.MathUtils.randFloat(
                0.72,
                1.12,
            );
        }

        rainGeometry.setAttribute(
            'instanceRainSeed',
            new THREE.InstancedBufferAttribute(seedAttributes, 4),
        );
        rainGeometry.setAttribute(
            'instanceRainMotion',
            new THREE.InstancedBufferAttribute(motionAttributes, 4),
        );

        return rainGeometry;
    }, [count]);

    useEffect(() => () => geometry.dispose(), [geometry]);

    const updateRainFieldPosition = useCallback((x: number, z: number) => {
        const group = fref.current;
        if (!group) {
            return;
        }

        group.position.set(x, 0, z);
    }, []);

    useLayoutEffect(() => {
        const snapshot = gameCamera?.getSnapshot();
        updateRainFieldPosition(
            snapshot?.target[0] ?? camera.position.x,
            snapshot?.target[2] ?? camera.position.z,
        );

        if (!gameCamera) {
            return;
        }

        return gameCamera.subscribe((snapshot) => {
            updateRainFieldPosition(snapshot.target[0], snapshot.target[2]);
        });
    }, [camera, gameCamera, updateRainFieldPosition]);

    const vertexShader = useMemo(
        () => /* glsl */ `
        uniform float uTime;
        uniform float uRainFieldSize;
        attribute vec4 instanceRainSeed;
        attribute vec4 instanceRainMotion;
  
        varying vec3 vInstancePosition;
        varying vec2 vUv;
        varying float vRainAlpha;
  
        void main() {
          vUv = uv;

          float fallRange = uRainFieldSize + 0.2;
          float y = mod(
            instanceRainSeed.z + instanceRainMotion.x - uTime * instanceRainSeed.w,
            fallRange
          ) - 0.1;
          float drift = sin(uTime * 0.55 + instanceRainMotion.x) * 0.18;
          vec3 localCenter = vec3(
            instanceRainSeed.x + drift,
            y,
            instanceRainSeed.y
          );
          vInstancePosition = localCenter;
          vRainAlpha = instanceRainMotion.w;

          vec4 centerView = viewMatrix * modelMatrix * vec4(localCenter, 1.0);
          float streakScale = instanceRainMotion.z;
          vec2 screenOffset = vec2(
            position.x * 0.7 * streakScale + position.y * instanceRainMotion.y,
            position.y * 1.55 * streakScale
          );
          centerView.xy += screenOffset;
          gl_Position = projectionMatrix * centerView;
        }
      `,
        [],
    );

    const fragmentShader = useMemo(
        () => /* glsl */ `
        uniform float uRainProgress;
        uniform float uRainFieldSize;
  
        varying vec3 vInstancePosition;
        varying vec2 vUv;
        varying float vRainAlpha;

        float sdUnevenCapsule( vec2 p, float r1, float r2, float h ) {
          p.x = abs(p.x);
          float b = (r1-r2)/h;
          float a = sqrt(1.0-b*b);
          float k = dot(p,vec2(-b,a));
          if( k < 0.0 ) return length(p) - r1;
          if( k > a*h ) return length(p-vec2(0.0,h)) - r2;
          return dot(p, vec2(a,b) ) - r1;
        }
  
        float blur(float steps) {
          vec2 coord = vUv - 0.5;
          coord *= 10.0;
  
          // Get n droplets around this one and average their distance
          float total = 0.0;
          for (float i = 0.0; i < steps; i++) {
            float dropletDistance = sdUnevenCapsule(coord, 0.05, 0.0, 2.0);
            dropletDistance = 1.0 - smoothstep(0.0, 0.05, dropletDistance);
            total += dropletDistance;
            coord += vec2(0.0, 0.2);
          }
          return total / steps;
        }

        void main() {
          float dropletDistance = blur(${size.toFixed(1)});
          float rainProgress = smoothstep(0.0, 0.5, uRainProgress);
          rainProgress = clamp(rainProgress, 0.0, 1.0);
          float fieldRadius = uRainFieldSize * 0.5;
          float fieldFade = 1.0 - smoothstep(
            fieldRadius * 0.82,
            fieldRadius,
            length(vInstancePosition.xz)
          );
          float verticalFade =
            smoothstep(-0.1, 1.6, vInstancePosition.y) *
            (1.0 - smoothstep(uRainFieldSize - 3.5, uRainFieldSize, vInstancePosition.y));
          float alpha =
            dropletDistance * ${RAIN_ALPHA.toFixed(2)} * rainProgress * fieldFade * verticalFade * vRainAlpha;
          gl_FragColor = vec4(vec3(0.88, 0.94, 1.0), alpha);
        }
      `,
        [],
    );

    const uniforms = useMemo(
        () => ({
            uTime: timeUniform,
            uRainFieldSize: { value: size },
            uRainProgress: { value: 1 },
        }),
        [timeUniform],
    );

    return (
        <group ref={fref}>
            <instancedMesh
                args={[geometry, undefined, count]}
                frustumCulled={false}
                renderOrder={35}
            >
                <shaderMaterial
                    key={vertexShader + fragmentShader}
                    depthTest={false}
                    depthWrite={false}
                    vertexShader={vertexShader}
                    fragmentShader={fragmentShader}
                    side={THREE.DoubleSide}
                    uniforms={uniforms}
                    transparent
                />
            </instancedMesh>
        </group>
    );
};
