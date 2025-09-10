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
    TreeLeaf = 'treeLeaf',
    Stone = 'stone',
}

interface Particle {
    id: number;
    type: ParticleType;
    position: Vector3;
    velocity: Vector3;
    rotation: Euler;
    life: number;
    maxLife: number;
    ground?: number;
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

    const configs: Record<
        ParticleType,
        {
            geometry: () => JSX.Element;
            color: string;
            life: number;
            velocity: () => Vector3;
        }
    > = {
        [ParticleType.Hay]: {
            geometry: () => <boxGeometry args={[0.05, 0.01, 0.01]} />,
            color: '#d2b48c',
            life: 1,
            velocity: () =>
                new Vector3(
                    (Math.random() - 0.5) * 1.2,
                    Math.random() * 1 + 0.5,
                    (Math.random() - 0.5) * 1.2,
                ),
        },
        [ParticleType.Leaf]: {
            geometry: () => <planeGeometry args={[0.05, 0.03]} />,
            color: '#228b22',
            life: 1.2,
            velocity: () =>
                new Vector3(
                    (Math.random() - 0.5) * 0.8,
                    Math.random() * 0.8 + 0.2,
                    (Math.random() - 0.5) * 0.8,
                ),
        },
        [ParticleType.TreeLeaf]: {
            geometry: () => <planeGeometry args={[0.05, 0.03]} />,
            color: '#228b22',
            life: 1.5,
            velocity: () =>
                new Vector3(
                    (Math.random() - 0.5) * 0.2,
                    -(Math.random() * 0.1),
                    (Math.random() - 0.5) * 0.2,
                ),
        },
        [ParticleType.Stone]: {
            geometry: () => <sphereGeometry args={[0.02, 4, 4]} />,
            color: '#808080',
            life: 1.5,
            velocity: () =>
                new Vector3(
                    (Math.random() - 0.5) * 0.6,
                    Math.random() * 0.8 + 0.5,
                    (Math.random() - 0.5) * 0.6,
                ),
        },
    };

    const spawn = (type: ParticleType, position: Vector3, count = 8) => {
        const config = configs[type];
        const created: Particle[] = [];
        for (let i = 0; i < count; i++) {
            created.push({
                id: idRef.current++,
                type,
                position: position.clone(),
                velocity: config.velocity(),
                rotation: new Euler(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                ),
                life: config.life,
                maxLife: config.life,
                ground: position.y,
            });
        }
        setParticles((p) => [...p, ...created]);
    };

    useFrame((_, delta) => {
        setParticles((prev) =>
            prev
                .map((p) => {
                    p.position.addScaledVector(p.velocity, delta);
                    switch (p.type) {
                        case ParticleType.TreeLeaf: {
                            p.velocity.y -= 0.5 * delta;
                            p.rotation.z += delta * 0.5;
                            break;
                        }
                        case ParticleType.Stone: {
                            p.velocity.y -= 2 * delta;
                            if (p.position.y <= (p.ground ?? 0)) {
                                p.position.y = p.ground ?? 0;
                                if (p.velocity.y < 0) {
                                    p.velocity.y *= -0.3;
                                    p.velocity.x *= 0.7;
                                    p.velocity.z *= 0.7;
                                }
                            }
                            p.rotation.x += p.velocity.z * 5 * delta;
                            p.rotation.z += p.velocity.x * -5 * delta;
                            break;
                        }
                        default: {
                            p.velocity.y -= 1 * delta;
                            p.rotation.x += delta;
                            p.rotation.y += delta;
                        }
                    }
                    return { ...p, life: p.life - delta };
                })
                .filter((p) => p.life > 0),
        );
    });

    return (
        <ParticleContext.Provider value={{ spawn }}>
            {children}
            <group>
                {particles.map((p) => {
                    const cfg = configs[p.type];
                    return (
                        <mesh
                            key={p.id}
                            position={p.position}
                            rotation={p.rotation}
                        >
                            {cfg.geometry()}
                            <meshStandardMaterial
                                color={cfg.color}
                                side={2}
                                transparent
                                opacity={p.life / p.maxLife}
                            />
                        </mesh>
                    );
                })}
            </group>
        </ParticleContext.Provider>
    );
}

export type { ParticleContextValue as ParticleSystem };
