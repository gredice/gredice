import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import CSM from "three-custom-shader-material";

interface DropsProps {
    count?: number;
}

export const Drops = ({ count = 2000 }: DropsProps) => {
    const fref = useRef<THREE.Group>(null);
    const dropsRef = useRef<THREE.InstancedMesh>(null!);
    const _dummy = useMemo(() => new THREE.Object3D(), []);
    const initialY = useMemo(() => new Float32Array(count).fill(0), []);
    const angles = useMemo(() => new Float32Array(count).fill(0), []);

    const size = 40;
    const speed = 15;

    useEffect(() => {
        const dropsMesh = dropsRef.current;
        for (let i = 0; i < count; i++) {
            _dummy.position.set(
                THREE.MathUtils.randFloatSpread(size),
                THREE.MathUtils.randFloat(-0.1, size),
                THREE.MathUtils.randFloatSpread(size)
            );
            _dummy.scale.set(0.7, 0.7, 0.7);
            _dummy.updateMatrix();
            dropsMesh.setMatrixAt(i, _dummy.matrix);
        }
        dropsMesh.instanceMatrix.needsUpdate = true;
    }, []);

    useFrame(({ camera }, dt) => {
        const dropsMesh = dropsRef.current;

        // Calculate what is camera target on the ground in front of the camera
        if (fref?.current) {
            fref.current.position.set((camera.position.x + 100), 0, (camera.position.z + 100));
        }

        for (let i = 0; i < count; i++) {
            dropsMesh.getMatrixAt(i, _dummy.matrix);
            _dummy.matrix.decompose(
                _dummy.position,
                _dummy.quaternion,
                _dummy.scale
            );

            _dummy.rotation.y = Math.atan2(
                camera.position.x - _dummy.position.x,
                camera.position.z - _dummy.position.z
            );
            _dummy.rotation.x = angles[i];
            _dummy.position.y -= dt * speed;

            if (_dummy.position.y <= 0) {
                _dummy.position.set(
                    THREE.MathUtils.randFloatSpread(size),
                    THREE.MathUtils.randFloat(-0.1, size),
                    THREE.MathUtils.randFloatSpread(size)
                );
                initialY[i] = _dummy.position.y;
                angles[i] = THREE.MathUtils.randFloatSpread(
                    THREE.MathUtils.degToRad(20)
                );
            }

            _dummy.updateMatrix();
            dropsMesh.setMatrixAt(i, _dummy.matrix);
        }
        dropsMesh.instanceMatrix.needsUpdate = true;
    });

    const vertexShader = useMemo(
        () => /* glsl */ `
        uniform float uTime;
  
        varying vec3 vInstancePosition;
        varying vec2 vUv;
  
        void main() {
          vInstancePosition = (instanceMatrix * vec4(position, 1.0)).xyz;
          vUv = uv;
        }
      `,
        []
    );

    const fragmentShader = useMemo(
        () => /* glsl */ `
        uniform float uRainProgress;
  
        varying vec3 vInstancePosition;
        varying vec2 vUv;

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

        float sdCircle( vec2 p, float r ) {
          return length(p) - r;
        }
  
        void main() {
          float dropletDistance = blur(${size.toFixed(1)});
          float rainProgress = smoothstep(0.0, 0.5, uRainProgress);
          rainProgress = clamp(rainProgress, 0.0, 1.0);
          float circle = 1.0 - sdCircle(vInstancePosition.xz, ${(size / 2).toFixed(1)});
          csm_DiffuseColor.a = dropletDistance * 0.1 * rainProgress * circle; 
        }
      `,
        []
    );

    const uniforms = useMemo(
        () => ({
            uRainProgress: { value: 1 },
        }),
        []
    );

    return (
        <group ref={fref}>
            <instancedMesh
                ref={dropsRef}
                args={[undefined, undefined, count]}
                renderOrder={2}
            >
                <planeGeometry args={[0.5, 1]} />
                <CSM
                    key={vertexShader + fragmentShader}
                    baseMaterial={THREE.MeshBasicMaterial}
                    vertexShader={vertexShader}
                    fragmentShader={fragmentShader}
                    uniforms={uniforms}
                    transparent
                />
            </instancedMesh>
        </group>
    );
}
