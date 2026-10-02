import { type RootState, useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
    type BufferGeometry,
    type Material,
    Mesh,
    MeshStandardMaterial,
    type Object3D,
} from 'three';
import { useEntityBlockInstances } from '../src/entities/EntityInstancesBlock';
import type { GLTFResult } from '../src/models/GameAssets';
import { readChunkCompilerMetrics } from '../src/scene/compiler/chunkCompilerMetrics';
import { readStaticRenderPacketMetrics } from '../src/scene/compiler/staticRenderPackets';
import { useSceneAfterFrame } from '../src/scene/useSceneAfterFrame';
import type { Stack } from '../src/types/Stack';
import { useGameStateStore } from '../src/useGameState';
import type { GardenPaletteInteractionPhase } from './GardenPaletteInteractionFixture';

function isInside(object: Object3D, prefix: string) {
    let current: Object3D | null = object;
    while (current) {
        if (current.name.startsWith(prefix)) return true;
        current = current.parent;
    }
    return false;
}

function materialInputs(material: Material | Material[]) {
    return (Array.isArray(material) ? material : [material]).map((value) =>
        value instanceof MeshStandardMaterial
            ? {
                  color: value.color.toArray(),
                  emissive: value.emissive.toArray(),
                  roughness: value.roughness,
                  metalness: value.metalness,
                  opacity: value.opacity,
                  alphaTest: value.alphaTest,
                  maps: [
                      value.map?.uuid ?? null,
                      value.alphaMap?.uuid ?? null,
                      value.roughnessMap?.uuid ?? null,
                      value.metalnessMap?.uuid ?? null,
                      value.emissiveMap?.uuid ?? null,
                  ],
              }
            : { type: value.type },
    );
}

export function GardenPaletteInteractionProbe({
    batch,
    phase,
    stacks,
    tree,
    box,
}: {
    batch: boolean;
    phase: GardenPaletteInteractionPhase;
    stacks: Stack[];
    tree: GLTFResult;
    box: GLTFResult;
}) {
    const scene = useThree((state) => state.scene);
    const gl = useThree((state) => state.gl);
    const store = useGameStateStore();
    const instances = useEntityBlockInstances({
        name: 'Tree',
        stacks,
        yOffset: 0.5,
    });
    const receipts = useRef(0);
    const sourceDisposals = useRef(0);
    useSceneAfterFrame(
        useCallback(() => {
            receipts.current++;
        }, []),
    );
    const sources = useMemo(
        () => [
            tree.nodes.Tree_1_1,
            box.nodes.GardenBox_Body_Planks,
            box.nodes.GardenBox_Lid_HingeOrigin,
        ],
        [box, tree],
    );
    useLayoutEffect(() => {
        const resources = new Set<BufferGeometry | Material>();
        for (const source of sources) {
            resources.add(source.geometry);
            for (const material of Array.isArray(source.material)
                ? source.material
                : [source.material])
                resources.add(material);
        }
        const disposed = () => sourceDisposals.current++;
        for (const resource of resources)
            resource.addEventListener('dispose', disposed);
        return () => {
            for (const resource of resources)
                resource.removeEventListener('dispose', disposed);
        };
    }, [sources]);
    const snapshot = () =>
        readInteractionSnapshot({
            batch,
            phase,
            scene,
            gl,
            sources,
            store,
            instances,
            receipts: receipts.current,
            sourceDisposals: sourceDisposals.current,
        });
    useLayoutEffect(() => {
        const witness = { snapshot };
        window.gardenPaletteInteractionWitness = witness;
        return () => {
            if (window.gardenPaletteInteractionWitness === witness)
                delete window.gardenPaletteInteractionWitness;
        };
    });
    return null;
}

function readInteractionSnapshot({
    batch,
    phase,
    scene,
    gl,
    sources,
    store,
    instances,
    receipts,
    sourceDisposals,
}: {
    batch: boolean;
    phase: GardenPaletteInteractionPhase;
    scene: RootState['scene'];
    gl: RootState['gl'];
    sources: Mesh[];
    store: ReturnType<typeof useGameStateStore>;
    instances: ReturnType<typeof useEntityBlockInstances>;
    receipts: number;
    sourceDisposals: number;
}) {
    const originalGeometries = new Set(sources.map((s) => s.geometry));
    const packetMeshes: Mesh[] = [];
    const animatedMeshes: Mesh[] = [];
    const outlineMeshes: Mesh[] = [];
    const authoredMeshes: Mesh[] = [];
    scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        if (object.name.startsWith('StaticRenderPacket:'))
            packetMeshes.push(object);
        if (isInside(object, 'Animation:PlacementDrop:Tree:'))
            animatedMeshes.push(object);
        if (isInside(object, 'Interaction:HoverOutlineTarget'))
            outlineMeshes.push(object);
        if (object.name.startsWith('BlockInstances:Tree:'))
            authoredMeshes.push(object);
    });
    const drop = scene.getObjectByName(
        'Animation:PlacementDropOffset:Tree:palette-picked-tree',
    );
    const state = store.getState();
    return {
        batch,
        phase,
        receipts: receipts,
        rendererFrame: gl.info.render.frame,
        sourceDisposals: sourceDisposals,
        sourceInputs: sources.map((source) => ({
            geometry: source.geometry.uuid,
            positionCount: source.geometry.getAttribute('position').count,
            indexCount: source.geometry.index?.count ?? null,
            material: materialInputs(source.material),
        })),
        compiler: readChunkCompilerMetrics(),
        packets: readStaticRenderPacketMetrics(),
        paletteMeshes: packetMeshes.filter((mesh) =>
            mesh.geometry.hasAttribute('aGardenPalette0'),
        ).length,
        pendingMeshes: packetMeshes.filter((mesh) =>
            mesh.name.includes(':fallback:'),
        ).length,
        authoredMeshes: authoredMeshes.length,
        animatedMeshes: animatedMeshes.length,
        animatedOriginalGeometry: animatedMeshes.filter((mesh) =>
            originalGeometries.has(mesh.geometry),
        ).length,
        outlineMeshes: outlineMeshes.length,
        outlineOriginalGeometry: outlineMeshes.filter((mesh) =>
            originalGeometries.has(mesh.geometry),
        ).length,
        dropOffsetY: drop?.position.y ?? null,
        dropAnimation:
            state.blockPlacementDropAnimations['palette-picked-tree'],
        treePositions: instances?.map((instance) => ({
            id: instance.block.id,
            position: instance.position,
            pickupOutlineVisible: instance.pickupOutlineVisible,
        })),
        rainSurfaceIntensity: state.rainSurfaceIntensity,
    };
}

declare global {
    interface Window {
        gardenPaletteInteractionWitness?: {
            snapshot: () => ReturnType<typeof readInteractionSnapshot>;
        };
    }
}
