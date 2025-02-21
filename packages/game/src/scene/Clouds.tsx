import { useFrame } from "@react-three/fiber"
import { useControls } from "leva"
import { useRef } from "react"
import { Clouds as CloudsImpl, Cloud, CameraControls, Sky as SkyImpl, StatsGl } from "@react-three/drei"
import * as THREE from "three"

export function Clouds() {
    const ref = useRef();
    const { x, y, z } = {x: 0, y: 0, z: 0};
    const config = {
        
    };
    // const { color, x, y, z, ...config } = useControls({
    //   seed: { value: 1, min: 1, max: 100, step: 1 },
    //   segments: { value: 20, min: 1, max: 80, step: 1 },
    //   volume: { value: 6, min: 0, max: 100, step: 0.1 },
    //   opacity: { value: 0.8, min: 0, max: 1, step: 0.01 },
    //   fade: { value: 10, min: 0, max: 400, step: 1 },
    //   growth: { value: 4, min: 0, max: 20, step: 1 },
    //   speed: { value: 0.1, min: 0, max: 1, step: 0.01 },
    //   x: { value: 6, min: 0, max: 100, step: 1 },
    //   y: { value: 1, min: 0, max: 100, step: 1 },
    //   z: { value: 1, min: 0, max: 100, step: 1 },
    //   color: "white",
    // })
    useFrame((state, delta) => {
      
    })
    return (
      <>
        <group ref={ref}>
          {/* <Clouds material={THREE.MeshLambertMaterial} limit={400} range={10}>
            <Cloud {...config} bounds={[x, y, z]} color="#eed0d0" seed={2} position={[15, 0, 0]} />
            <Cloud {...config} bounds={[x, y, z]} color="#d0e0d0" seed={3} position={[-15, 0, 0]} />
            <Cloud {...config} bounds={[x, y, z]} color="#a0b0d0" seed={4} position={[0, 0, -12]} />
          </Clouds> */}
        </group>
      </>
    )
  }
  