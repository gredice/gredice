import { useFrame } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import { Euler, type InstancedMesh, Object3D, Vector3 } from 'three';

export enum ParticleType {
    Default = 'default',
    Hay = 'hay',
    Leaf = 'leaf',
    TreeLeaf = 'treeLeaf',
    Stone = 'stone',
    Water = 'water',
}

const particlePoolSize = 96;
const defaultParticleBurstCount = 6;
const particleTypes = [
    ParticleType.Default,
    ParticleType.Hay,
    ParticleType.Leaf,
    ParticleType.TreeLeaf,
    ParticleType.Stone,
    ParticleType.Water,
] as const;

interface ParticleContextValue {
    spawn: (
        type: ParticleType | null | undefined,
        position: Vector3,
        count?: number,
    ) => void;
}

const ParticleContext = createContext<ParticleContextValue | null>(null);

export function resolveBlockParticleType(
    blockName: string,
): ParticleType | null {
    switch (blockName) {
        case 'BaleHey':
        case 'MulchHey':
            return ParticleType.Hay;
        case 'Bush':
            return ParticleType.Leaf;
        case 'Tree':
        case 'Pine':
            return ParticleType.TreeLeaf;
        case 'StoneSmall':
        case 'StoneMedium':
        case 'StoneLarge':
        case 'DesertStoneSmall':
        case 'DesertStoneMedium':
        case 'DesertStoneLarge':
            return ParticleType.Stone;
        case 'Block_Water':
            return ParticleType.Water;
        default:
            return null;
    }
}

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
    const meshDefault = useRef<InstancedMesh>(null);
    const meshHay = useRef<InstancedMesh>(null);
    const meshLeaf = useRef<InstancedMesh>(null);
    const meshTreeLeaf = useRef<InstancedMesh>(null);
    const meshStone = useRef<InstancedMesh>(null);
    const meshWater = useRef<InstancedMesh>(null);
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < particlePoolSize; i++) {
            temp.push({
                rotation: {
                    x: 0,
                    y: 0,
                    z: 0,
                },
                velocity: {
                    x: 0,
                    y: 0,
                    z: 0,
                },
                type: ParticleType.Default,
                life: 0,
                maxLife: 0,
                ground: 0,
                position: {
                    x: 0,
                    y: 0,
                    z: 0,
                },
            });
        }
        return temp;
    }, []);

    const configs: Record<
        ParticleType,
        {
            life: number;
            offset?: () => { x: number; y: number; z: number };
            velocity: () => Vector3;
        }
    > = {
        [ParticleType.Default]: {
            life: 1.2,
            offset: () => ({
                x: Math.random() * 0.5,
                y: 0,
                z: Math.random() * 0.5,
            }),
            velocity: () =>
                new Vector3(
                    (Math.random() - 0.5) * 2.0,
                    Math.random() * 2 + 1,
                    (Math.random() - 0.5) * 2.0,
                ),
        },
        [ParticleType.Hay]: {
            life: 0.8,
            velocity: () =>
                new Vector3(
                    (Math.random() - 0.5) * 2.5,
                    Math.random() * 3 + 1,
                    (Math.random() - 0.5) * 2.5,
                ),
        },
        [ParticleType.Leaf]: {
            life: 2.0,
            velocity: () =>
                new Vector3(
                    (Math.random() - 0.5) * 1.5,
                    Math.random() * 1 + 1,
                    (Math.random() - 0.5) * 1.5,
                ),
        },
        [ParticleType.TreeLeaf]: {
            life: 1.5,
            offset: () => ({
                x: (Math.random() - 0.5) * 0.5,
                y: (Math.random() - 0.5) * 2 + 1.5,
                z: (Math.random() - 0.5) * 0.5,
            }),
            velocity: () =>
                new Vector3(
                    (Math.random() - 0.5) * 1.5,
                    Math.random() * 1,
                    (Math.random() - 0.5) * 1.5,
                ),
        },
        [ParticleType.Stone]: {
            life: 1.5,
            velocity: () =>
                new Vector3(
                    (Math.random() - 0.5) * 1.5,
                    Math.random() * 1 + 3,
                    (Math.random() - 0.5) * 1.5,
                ),
        },
        [ParticleType.Water]: {
            life: 0.9,
            offset: () => ({
                x: (Math.random() - 0.5) * 0.5,
                y: 0,
                z: (Math.random() - 0.5) * 0.5,
            }),
            velocity: () =>
                new Vector3(
                    (Math.random() - 0.5) * 2.0,
                    Math.random() * 2 + 1.5,
                    (Math.random() - 0.5) * 2.0,
                ),
        },
    };

    const spawn = (
        type: ParticleType | null | undefined,
        position: Vector3,
        count = defaultParticleBurstCount,
    ) => {
        // Use default particle type if none provided
        const particleType = type ?? ParticleType.Default;

        let activatedParticles = 0;
        const config = configs[particleType];
        for (const p of particles) {
            // Skip still active particles
            if (p.life < p.maxLife) {
                continue;
            }

            // Revive this particle
            p.type = particleType;
            p.position = position
                .clone()
                .add(config.offset?.() ?? { x: 0, y: 0, z: 0 });
            p.velocity = config.velocity();
            p.rotation = new Euler(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI,
            );
            p.life = 0;
            p.maxLife = config.life;
            p.ground = position.y;
            activatedParticles++;
            if (activatedParticles >= count) {
                break;
            }
        }
    };

    const dummy = useMemo(() => new Object3D(), []);

    const getParticleMesh = (type: ParticleType) => {
        switch (type) {
            case ParticleType.Default:
                return meshDefault.current;
            case ParticleType.Hay:
                return meshHay.current;
            case ParticleType.Leaf:
                return meshLeaf.current;
            case ParticleType.TreeLeaf:
                return meshTreeLeaf.current;
            case ParticleType.Stone:
                return meshStone.current;
            case ParticleType.Water:
                return meshWater.current;
        }
    };

    useLayoutEffect(() => {
        // Keep idle particle pools out of the draw list. Active particles are
        // compacted to the first N instances per mesh type during useFrame.
        const meshes = [
            meshDefault.current,
            meshHay.current,
            meshLeaf.current,
            meshTreeLeaf.current,
            meshStone.current,
            meshWater.current,
        ];

        for (const mesh of meshes) {
            if (!mesh) {
                continue;
            }

            mesh.count = 0;
            mesh.visible = false;
        }
    }, []);

    useFrame((_, delta) => {
        const activeCounts: Record<ParticleType, number> = {
            [ParticleType.Default]: 0,
            [ParticleType.Hay]: 0,
            [ParticleType.Leaf]: 0,
            [ParticleType.TreeLeaf]: 0,
            [ParticleType.Stone]: 0,
            [ParticleType.Water]: 0,
        };
        const touchedMeshes = new Set<InstancedMesh>();

        for (const p of particles) {
            if (p.life >= p.maxLife) {
                continue;
            }

            // Apply gravity
            p.velocity.y = p.velocity.y - 9 * delta;

            // p.position.addScaledVector(p.velocity, delta);
            switch (p.type) {
                case ParticleType.Hay: {
                    // Light gravity with air resistance for hay
                    p.velocity.x =
                        p.velocity.x < 0
                            ? p.velocity.x + 0.98 * delta
                            : p.velocity.x - 0.98 * delta;
                    p.velocity.z =
                        p.velocity.z < 0
                            ? p.velocity.z + 0.98 * delta
                            : p.velocity.z - 0.98 * delta;
                    // Tumbling rotation
                    p.rotation.x += 2 * delta;
                    p.rotation.y += 1.5 * delta;
                    p.rotation.z += 0.8 * delta;
                    break;
                }
                case ParticleType.Leaf: {
                    // Gentle gravity with swaying motion for leaves
                    p.velocity.y += 7 * delta;
                    // Add gentle swaying motion
                    const time = (p.maxLife - p.life) * 3;
                    p.velocity.x += Math.sin(time) * 0.2 * delta;
                    p.velocity.z += Math.cos(time * 0.7) * 0.2 * delta;
                    // Air resistance
                    p.velocity.x *= 0.99 ** (delta * 60);
                    p.velocity.z *= 0.99 ** (delta * 60);
                    // Gentle floating rotation
                    p.rotation.x += delta * 0.5;
                    p.rotation.y += delta * 0.3;
                    p.rotation.z += Math.sin(time * 0.5) * delta * 0.2;
                    break;
                }
                case ParticleType.TreeLeaf: {
                    // Gentle gravity with swaying motion for leaves
                    p.velocity.y += 7 * delta;
                    // Add gentle swaying motion
                    const time = (p.maxLife - p.life) * 3;
                    p.velocity.x += Math.sin(time) * 0.2 * delta;
                    p.velocity.z += Math.cos(time * 0.7) * 0.2 * delta;
                    // Air resistance
                    p.velocity.x *= 0.99 ** (delta * 60);
                    p.velocity.z *= 0.99 ** (delta * 60);
                    // Gentle floating rotation
                    p.rotation.x += delta * 0.5;
                    p.rotation.y += delta * 0.3;
                    p.rotation.z += Math.sin(time * 0.5) * delta * 0.2;
                    break;
                }
                case ParticleType.Stone: {
                    p.rotation.x += p.velocity.z * 1 * delta;
                    p.rotation.z += p.velocity.x * -1 * delta;
                    break;
                }
                case ParticleType.Water: {
                    p.velocity.x *= 0.99 ** (delta * 60);
                    p.velocity.z *= 0.99 ** (delta * 60);
                    break;
                }
                default: {
                    // Basic physics with simple tumbling rotation
                    p.velocity.x *= 0.98 ** (delta * 60);
                    p.velocity.z *= 0.98 ** (delta * 60);
                    p.rotation.x += 1.5 * delta;
                    p.rotation.y += 1.2 * delta;
                    p.rotation.z += 0.9 * delta;
                    break;
                }
            }

            p.position.x += p.velocity.x * delta;
            p.position.y += p.velocity.y * delta;
            p.position.z += p.velocity.z * delta;

            // Apply near zero threshold to stop very slow movement
            if (Math.abs(p.velocity.x) < 0.01) p.velocity.x = 0;
            if (Math.abs(p.velocity.y) < 0.01) p.velocity.y = 0;
            if (Math.abs(p.velocity.z) < 0.01) p.velocity.z = 0;

            // Apply ground
            if (p.ground !== undefined && p.position.y <= p.ground) {
                p.position.y = p.ground;
                p.velocity.y = 0;
            }

            dummy.position.set(p.position.x, p.position.y, p.position.z);

            // Calculate scale factor: starts at 1, goes to 0 as life approaches maxLife
            // Use gentler easing - scale factor of ~0.8 at 50% life
            const lifeProgress = p.life / p.maxLife;
            const scaleFactor = (1 - lifeProgress) ** 1.5;
            dummy.scale.set(scaleFactor, scaleFactor, scaleFactor);

            dummy.rotation.set(p.rotation.x, p.rotation.y, p.rotation.z);
            dummy.updateMatrix();

            p.life = p.life + delta;
            if (p.life >= p.maxLife) {
                continue;
            }

            const targetMesh = getParticleMesh(p.type);
            if (!targetMesh) {
                continue;
            }

            const matrixIndex = activeCounts[p.type];
            activeCounts[p.type] += 1;
            targetMesh.setMatrixAt(matrixIndex, dummy.matrix);
            touchedMeshes.add(targetMesh);
        }

        for (const type of particleTypes) {
            const mesh = getParticleMesh(type);
            if (!mesh) {
                continue;
            }

            const nextCount = activeCounts[type];
            mesh.visible = nextCount > 0;
            if (mesh.count !== nextCount) {
                mesh.count = nextCount;
                mesh.instanceMatrix.needsUpdate = true;
                continue;
            }

            if (nextCount > 0 && touchedMeshes.has(mesh)) {
                mesh.instanceMatrix.needsUpdate = true;
            }
        }
    });

    return (
        <ParticleContext.Provider value={{ spawn }}>
            {children}
            {/* Default mesh */}
            <instancedMesh
                ref={meshDefault}
                name="Particles:default"
                args={[undefined, undefined, particlePoolSize]}
            >
                <boxGeometry args={[0.03, 0.03, 0.03]} />
                <meshStandardMaterial color="#4a270d" />
            </instancedMesh>

            {/* Hay mesh */}
            <instancedMesh
                ref={meshHay}
                name="Particles:hay"
                args={[undefined, undefined, particlePoolSize]}
            >
                <boxGeometry args={[0.05, 0.01, 0.01]} />
                <meshStandardMaterial color="yellow" />
            </instancedMesh>

            {/* Leaf mesh */}
            <instancedMesh
                ref={meshLeaf}
                name="Particles:leaf"
                args={[undefined, undefined, particlePoolSize]}
            >
                <planeGeometry args={[0.08, 0.05]} />
                <meshStandardMaterial color="#558b22" side={2} />
            </instancedMesh>

            {/* Tree Leaf mesh */}
            <instancedMesh
                ref={meshTreeLeaf}
                name="Particles:treeLeaf"
                args={[undefined, undefined, particlePoolSize]}
            >
                <planeGeometry args={[0.08, 0.05]} />
                <meshStandardMaterial color="#558b22" side={2} />
            </instancedMesh>

            {/* Stone mesh */}
            <instancedMesh
                ref={meshStone}
                name="Particles:stone"
                args={[undefined, undefined, particlePoolSize]}
            >
                <sphereGeometry args={[0.04, 4, 4]} />
                <meshStandardMaterial color="#555566" />
            </instancedMesh>

            {/* Water mesh */}
            <instancedMesh
                ref={meshWater}
                name="Particles:water"
                args={[undefined, undefined, particlePoolSize]}
            >
                <sphereGeometry args={[0.035, 6, 6]} />
                <meshStandardMaterial
                    color="#8fcfc4"
                    transparent
                    opacity={0.85}
                />
            </instancedMesh>
        </ParticleContext.Provider>
    );
}

export type { ParticleContextValue as ParticleSystem };
