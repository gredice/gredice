import {
    type BufferGeometry,
    type Material,
    Matrix4,
    Mesh,
    type Object3D,
} from 'three';
import {
    type GardenStructureKitNodeBinding,
    gardenStructureKitV1AssetManifest,
} from './gardenStructureKitV1Manifest';
import type { GardenStructureBatchGeometryKind } from './structurePlanTypes';

export type GardenStructureKitV1AssetResolutionIssue = Readonly<{
    code:
        | 'duplicate-node'
        | 'material-mismatch'
        | 'missing-node'
        | 'missing-renderable-mesh';
    geometryId: string;
    message: string;
    nodeName: string;
}>;

export type GardenStructureKitV1ResolvedPrimitive = Readonly<{
    geometry: BufferGeometry;
    material: Material | Material[];
    nodeName: string;
    sourceMatrix: Matrix4;
    sourceNodeName: string;
    transparency: GardenStructureKitNodeBinding['transparency'];
}>;

export type GardenStructureKitV1ResolvedGeometry = Readonly<{
    geometryId: string;
    issues: readonly GardenStructureKitV1AssetResolutionIssue[];
    primitives: readonly GardenStructureKitV1ResolvedPrimitive[];
    status: 'missing' | 'resolved';
}>;

export type GardenStructureKitV1AssetResolution = Readonly<{
    geometries: ReadonlyMap<string, GardenStructureKitV1ResolvedGeometry>;
    issues: readonly GardenStructureKitV1AssetResolutionIssue[];
}>;

export type GardenStructureKitV1BatchGeometryReference = Readonly<{
    geometryId: string;
    geometryKind: GardenStructureBatchGeometryKind;
    materialId: string;
}>;

type GardenStructureKitAssetPart = Readonly<{
    nodes: readonly GardenStructureKitNodeBinding[];
}>;

const manifest = gardenStructureKitV1AssetManifest;

const semanticPartEntries = Object.freeze([
    ...Object.entries(manifest.floorParts),
    ...Object.entries(manifest.edgeParts),
    ...Object.entries(manifest.roofStyles),
    ...Object.entries(manifest.propParts),
]) satisfies readonly (readonly [string, GardenStructureKitAssetPart])[];

export const gardenStructureKitV1SemanticGeometryIds = Object.freeze(
    semanticPartEntries.map(([geometryId]) => geometryId),
);

function materialNames(material: Material | Material[]) {
    return (Array.isArray(material) ? material : [material])
        .map(({ name }) => name)
        .toSorted((left, right) => left.localeCompare(right));
}

function sameStrings(left: readonly string[], right: readonly string[]) {
    return (
        left.length === right.length &&
        left.every((value, index) => value === right[index])
    );
}

function localMatrix(node: Object3D) {
    if (!node.matrixAutoUpdate) {
        return node.matrix.clone();
    }
    return new Matrix4().compose(node.position, node.quaternion, node.scale);
}

function collectRenderableMeshes(
    node: Object3D,
    parentMatrix = new Matrix4(),
): readonly Readonly<{ matrix: Matrix4; mesh: Mesh }>[] {
    const matrix = new Matrix4().multiplyMatrices(
        parentMatrix,
        localMatrix(node),
    );
    const meshes: Readonly<{ matrix: Matrix4; mesh: Mesh }>[] =
        node instanceof Mesh ? [{ matrix, mesh: node }] : [];
    return [
        ...meshes,
        ...node.children.flatMap((child) =>
            collectRenderableMeshes(child, matrix),
        ),
    ];
}

function indexNamedNodes(root: Object3D) {
    const nodes = new Map<string, Object3D[]>();
    const visit = (node: Object3D) => {
        if (node.name) {
            const matches = nodes.get(node.name);
            if (matches) {
                matches.push(node);
            } else {
                nodes.set(node.name, [node]);
            }
        }
        for (const child of node.children) {
            visit(child);
        }
    };
    visit(root);
    return nodes;
}

function issue(
    code: GardenStructureKitV1AssetResolutionIssue['code'],
    geometryId: string,
    nodeName: string,
    message: string,
): GardenStructureKitV1AssetResolutionIssue {
    return Object.freeze({ code, geometryId, message, nodeName });
}

function resolveBinding(
    geometryId: string,
    binding: GardenStructureKitNodeBinding,
    indexedNodes: ReadonlyMap<string, readonly Object3D[]>,
) {
    const matches = indexedNodes.get(binding.nodeName) ?? [];
    if (matches.length === 0) {
        return {
            issues: [
                issue(
                    'missing-node',
                    geometryId,
                    binding.nodeName,
                    `Missing GLB node ${binding.nodeName}.`,
                ),
            ],
            primitives: [],
        };
    }
    if (matches.length > 1) {
        return {
            issues: [
                issue(
                    'duplicate-node',
                    geometryId,
                    binding.nodeName,
                    `GLB node ${binding.nodeName} is not unique.`,
                ),
            ],
            primitives: [],
        };
    }

    const meshes = collectRenderableMeshes(matches[0]);
    if (meshes.length === 0) {
        return {
            issues: [
                issue(
                    'missing-renderable-mesh',
                    geometryId,
                    binding.nodeName,
                    `GLB node ${binding.nodeName} has no renderable mesh.`,
                ),
            ],
            primitives: [],
        };
    }

    const actualMaterialNames = [
        ...new Set(meshes.flatMap(({ mesh }) => materialNames(mesh.material))),
    ].toSorted((left, right) => left.localeCompare(right));
    const expectedMaterialNames = [...binding.nodeMaterialNames].toSorted(
        (left, right) => left.localeCompare(right),
    );
    if (!sameStrings(actualMaterialNames, expectedMaterialNames)) {
        return {
            issues: [
                issue(
                    'material-mismatch',
                    geometryId,
                    binding.nodeName,
                    `GLB node ${binding.nodeName} uses ${actualMaterialNames.join(', ') || 'no named material'}; expected ${expectedMaterialNames.join(', ')}.`,
                ),
            ],
            primitives: [],
        };
    }

    return {
        issues: [],
        primitives: meshes.map(({ matrix, mesh }) =>
            Object.freeze({
                geometry: mesh.geometry,
                material: mesh.material,
                nodeName: mesh.name,
                sourceMatrix: matrix,
                sourceNodeName: binding.nodeName,
                transparency: binding.transparency,
            }),
        ),
    };
}

/**
 * Resolves the immutable semantic kit to loader-owned GLB primitives. This is
 * deliberately pure: it only reads the scene graph and never clones, mutates,
 * or disposes loader-owned geometry and materials.
 */
export function resolveGardenStructureKitV1Asset(
    root: Object3D,
): GardenStructureKitV1AssetResolution {
    const indexedNodes = indexNamedNodes(root);
    const geometries = new Map<string, GardenStructureKitV1ResolvedGeometry>();
    const allIssues: GardenStructureKitV1AssetResolutionIssue[] = [];

    for (const [geometryId, part] of semanticPartEntries) {
        const primitives: GardenStructureKitV1ResolvedPrimitive[] = [];
        const issues: GardenStructureKitV1AssetResolutionIssue[] = [];
        for (const binding of part.nodes) {
            const bindingResolution = resolveBinding(
                geometryId,
                binding,
                indexedNodes,
            );
            primitives.push(...bindingResolution.primitives);
            issues.push(...bindingResolution.issues);
        }
        const resolvedIssues = Object.freeze(issues);
        allIssues.push(...resolvedIssues);
        geometries.set(
            geometryId,
            Object.freeze({
                geometryId,
                issues: resolvedIssues,
                primitives:
                    resolvedIssues.length === 0
                        ? Object.freeze(primitives)
                        : Object.freeze([]),
                status: resolvedIssues.length === 0 ? 'resolved' : 'missing',
            }),
        );
    }

    return Object.freeze({
        geometries,
        issues: Object.freeze(allIssues),
    });
}

export function getGardenStructureKitV1BatchGeometryId(
    batch: GardenStructureKitV1BatchGeometryReference,
) {
    return batch.geometryKind === 'floor-cell'
        ? batch.materialId
        : batch.geometryId;
}

export function resolveGardenStructureKitV1BatchGeometry(
    resolution: GardenStructureKitV1AssetResolution,
    batch: GardenStructureKitV1BatchGeometryReference,
) {
    return resolution.geometries.get(
        getGardenStructureKitV1BatchGeometryId(batch),
    );
}
