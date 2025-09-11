import { useFrame } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useContext,
    useMemo,
    useRef,
} from 'react';
import { Euler, type InstancedMesh, Matrix4, Object3D, Vector3 } from 'three';

export enum ParticleType {
    Default = 'default',
    Hay = 'hay',
    Leaf = 'leaf',
    TreeLeaf = 'treeLeaf',
    Stone = 'stone',
}

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
            return ParticleType.Stone;
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
    const count = 500;
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
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
    };

    const spawn = (
        type: ParticleType | null | undefined,
        position: Vector3,
        count = 8,
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
    useFrame((_, delta) => {
        let i = -1;
        let updateDefaultMesh = false;
        let updateHayMesh = false;
        let updateLeafMesh = false;
        let updateTreeLeafMesh = false;
        let updateStoneMesh = false;
        for (const p of particles) {
            i++;
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
            let targetMesh: InstancedMesh | null = null;
            switch (p.type) {
                case ParticleType.Default:
                    targetMesh = meshDefault.current;
                    updateDefaultMesh = true;
                    break;
                case ParticleType.Hay:
                    targetMesh = meshHay.current;
                    updateHayMesh = true;
                    break;
                case ParticleType.Leaf:
                    targetMesh = meshLeaf.current;
                    updateLeafMesh = true;
                    break;
                case ParticleType.TreeLeaf:
                    targetMesh = meshTreeLeaf.current;
                    updateTreeLeafMesh = true;
                    break;
                case ParticleType.Stone:
                    targetMesh = meshStone.current;
                    updateStoneMesh = true;
                    break;
            }
            targetMesh?.setMatrixAt(
                i,
                p.life < p.maxLife
                    ? dummy.matrix
                    : new Matrix4().makeScale(0, 0, 0),
            );
        }

        if (updateDefaultMesh && meshDefault.current) {
            meshDefault.current.instanceMatrix.needsUpdate = true;
        }
        if (updateHayMesh && meshHay.current) {
            meshHay.current.instanceMatrix.needsUpdate = true;
        }
        if (updateLeafMesh && meshLeaf.current) {
            meshLeaf.current.instanceMatrix.needsUpdate = true;
        }
        if (updateTreeLeafMesh && meshTreeLeaf.current) {
            meshTreeLeaf.current.instanceMatrix.needsUpdate = true;
        }
        if (updateStoneMesh && meshStone.current) {
            meshStone.current.instanceMatrix.needsUpdate = true;
        }
    });

    return (
        <ParticleContext.Provider value={{ spawn }}>
            {children}
            {/* Default mesh */}
            <instancedMesh
                ref={meshDefault}
                args={[undefined, undefined, count]}
            >
                <boxGeometry args={[0.03, 0.03, 0.03]} />
                <meshStandardMaterial color="#4a270d" />
            </instancedMesh>

            {/* Hay mesh */}
            <instancedMesh ref={meshHay} args={[undefined, undefined, count]}>
                <boxGeometry args={[0.05, 0.01, 0.01]} />
                <meshStandardMaterial color="yellow" />
            </instancedMesh>

            {/* Leaf mesh */}
            <instancedMesh ref={meshLeaf} args={[undefined, undefined, count]}>
                <planeGeometry args={[0.08, 0.05]} />
                <meshStandardMaterial color="#558b22" side={2} />
            </instancedMesh>

            {/* Tree Leaf mesh */}
            <instancedMesh
                ref={meshTreeLeaf}
                args={[undefined, undefined, count]}
            >
                <planeGeometry args={[0.08, 0.05]} />
                <meshStandardMaterial color="#558b22" side={2} />
            </instancedMesh>

            {/* Stone mesh */}
            <instancedMesh ref={meshStone} args={[undefined, undefined, count]}>
                <sphereGeometry args={[0.04, 4, 4]} />
                <meshStandardMaterial color="#555566" />
            </instancedMesh>
        </ParticleContext.Provider>
    );
}

export type { ParticleContextValue as ParticleSystem };
