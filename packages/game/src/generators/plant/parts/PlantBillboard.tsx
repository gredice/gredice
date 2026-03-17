'use client';

import { Billboard } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { PlantLodLevel } from '../hooks/usePlantLod';

export interface PlantBillboardSummary {
    accentCenterY: number;
    accentColor?: string;
    canopyCenterY: number;
    canopyWidth: number;
    dominantColor: string;
    foliageColor: string;
    hasFoliage: boolean;
    height: number;
    stemColor: string;
    stemWidth: number;
}

interface PlantBillboardProps {
    level: Exclude<PlantLodLevel, 'near'>;
    summary: PlantBillboardSummary;
}

export function PlantBillboard({ level, summary }: PlantBillboardProps) {
    const farColor = useMemo(
        () => new THREE.Color(summary.dominantColor),
        [summary.dominantColor],
    );

    return (
        <Billboard follow>
            {level === 'mid' ? (
                <group>
                    <mesh position={[0, summary.height * 0.42, -0.02]}>
                        <planeGeometry
                            args={[
                                Math.max(summary.stemWidth, 0.06),
                                Math.max(summary.height * 0.9, 0.2),
                            ]}
                        />
                        <meshBasicMaterial
                            color={summary.stemColor}
                            transparent
                            opacity={0.9}
                            depthWrite={false}
                        />
                    </mesh>
                    {summary.hasFoliage ? (
                        <group>
                            <mesh
                                position={[
                                    -summary.canopyWidth * 0.08,
                                    summary.canopyCenterY,
                                    0,
                                ]}
                            >
                                <circleGeometry
                                    args={[
                                        Math.max(
                                            summary.canopyWidth * 0.28,
                                            0.16,
                                        ),
                                        18,
                                    ]}
                                />
                                <meshBasicMaterial
                                    color={summary.foliageColor}
                                    transparent
                                    opacity={0.88}
                                    depthWrite={false}
                                />
                            </mesh>
                            <mesh
                                position={[
                                    summary.canopyWidth * 0.1,
                                    summary.canopyCenterY +
                                        summary.height * 0.06,
                                    0.01,
                                ]}
                            >
                                <circleGeometry
                                    args={[
                                        Math.max(
                                            summary.canopyWidth * 0.24,
                                            0.14,
                                        ),
                                        18,
                                    ]}
                                />
                                <meshBasicMaterial
                                    color={summary.foliageColor}
                                    transparent
                                    opacity={0.78}
                                    depthWrite={false}
                                />
                            </mesh>
                        </group>
                    ) : null}
                    {summary.accentColor ? (
                        <mesh position={[0, summary.accentCenterY, 0.02]}>
                            <circleGeometry
                                args={[
                                    Math.max(summary.canopyWidth * 0.1, 0.07),
                                    16,
                                ]}
                            />
                            <meshBasicMaterial
                                color={summary.accentColor}
                                transparent
                                opacity={0.95}
                                depthWrite={false}
                            />
                        </mesh>
                    ) : null}
                </group>
            ) : (
                <mesh position={[0, summary.height * 0.5, 0]}>
                    <planeGeometry
                        args={[
                            Math.max(summary.canopyWidth * 0.42, 0.12),
                            Math.max(summary.height * 0.72, 0.18),
                        ]}
                    />
                    <meshBasicMaterial
                        color={farColor}
                        transparent
                        opacity={0.84}
                        depthWrite={false}
                    />
                </mesh>
            )}
        </Billboard>
    );
}
