import { useFrame } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useContext,
    useRef,
    useState,
} from 'react';
import { Euler, Vector3 } from 'three';

export enum ParticleType {
    Hay = 'hay',
    Leaf = 'leaf',
}

interface Particle {
    id: number;
    type: ParticleType;
    position: Vector3;
    velocity: Vector3;
    rotation: Euler;
    life: number;
}

interface ParticleContextValue {
    spawn: (type: ParticleType, position: Vector3, count?: number) => void;
}

const ParticleContext = createContext<ParticleContextValue | null>(null);

export function useParticles() {
    const ctx = useContext(ParticleContext);
    if (!ctx) {
        throw new Error(
            'useParticles must be used within ParticleSystemProvider',
        );
    }
    return ctx;
}

export function ParticleSystemProvider({ children }: PropsWithChildren) {
    const [particles, setParticles] = useState<Particle[]>([]);
    const idRef = useRef(0);

    const spawn = (type: ParticleType, position: Vector3, count = 8) => {
        const created: Particle[] = [];
        for (let i = 0; i < count; i++) {
            created.push({
                id: idRef.current++,
                type,
                position: position.clone(),
                velocity: new Vector3(
                    (Math.random() - 0.5) * 0.8,
                    Math.random() * 0.8 + 0.2,
                    (Math.random() - 0.5) * 0.8,
                ),
                rotation: new Euler(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                ),
                life: 1,
            });
        }
        setParticles((p) => [...p, ...created]);
    };

    useFrame((_, delta) => {
        setParticles((prev) =>
            prev
                .map((p) => {
                    p.position.addScaledVector(p.velocity, delta);
                    p.velocity.y -= 1 * delta;
                    p.rotation.x += delta;
                    p.rotation.y += delta;
                    return { ...p, life: p.life - delta };
                })
                .filter((p) => p.life > 0),
        );
    });

    return (
        <ParticleContext.Provider value={{ spawn }}>
            {children}
            <group>
                {particles.map((p) => (
                    <mesh
                        key={p.id}
                        position={p.position}
                        rotation={p.rotation}
                    >
                        {p.type === ParticleType.Hay ? (
                            <boxGeometry args={[0.05, 0.01, 0.01]} />
                        ) : (
                            <planeGeometry args={[0.05, 0.03]} />
                        )}
                        <meshStandardMaterial
                            color={
                                p.type === ParticleType.Hay
                                    ? '#d2b48c'
                                    : '#228b22'
                            }
                            side={2}
                        />
                    </mesh>
                ))}
            </group>
        </ParticleContext.Provider>
    );
}

export type { ParticleContextValue as ParticleSystem };
