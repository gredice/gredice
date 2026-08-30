import type {
    GardenStructureEdgePartMetadata,
    GardenStructureKitMetadata,
    GardenStructureMaterialMetadata,
    GardenStructurePropPartMetadata,
    GardenStructureRoofStyleMetadata,
} from './structurePlanTypes';

export type GardenStructureKitVector3 = readonly [
    x: number,
    y: number,
    height: number,
];

export type GardenStructureKitBounds = Readonly<{
    minimum: GardenStructureKitVector3;
    maximum: GardenStructureKitVector3;
}>;

export type GardenStructureKitAnchor = Readonly<{
    kind: 'cell-base-center' | 'edge-base-center';
    position: GardenStructureKitVector3;
}>;

export type GardenStructureKitNodeBinding = Readonly<{
    nodeName: string;
    nodeMaterialNames: readonly string[];
    transparency: 'opaque' | 'transparent';
}>;

export type GardenStructureKitSemanticMaterial =
    GardenStructureMaterialMetadata &
        Readonly<{
            nodeMaterialNames: readonly string[];
        }>;

export type GardenStructureKitFloorAssetPart = Readonly<{
    anchor: GardenStructureKitAnchor;
    bounds: GardenStructureKitBounds;
    collision: Readonly<{
        kind: 'walkable-surface';
        thickness: number;
    }>;
    materialId: string;
    nodes: readonly GardenStructureKitNodeBinding[];
}>;

export type GardenStructureKitEdgeAssetPart = GardenStructureEdgePartMetadata &
    Readonly<{
        anchor: GardenStructureKitAnchor;
        bounds: GardenStructureKitBounds;
        nodes: readonly GardenStructureKitNodeBinding[];
    }>;

export type GardenStructureKitRoofAssetPart = GardenStructureRoofStyleMetadata &
    Readonly<{
        anchor: GardenStructureKitAnchor;
        bounds: GardenStructureKitBounds;
        materialIds: readonly string[];
        nodes: readonly GardenStructureKitNodeBinding[];
    }>;

export type GardenStructureKitPropAssetPart = GardenStructurePropPartMetadata &
    Readonly<{
        anchor: GardenStructureKitAnchor;
        bounds: GardenStructureKitBounds;
        nodes: readonly GardenStructureKitNodeBinding[];
    }>;

export type GardenStructureKitAssetManifest = Readonly<{
    assetName: 'GardenStructureKitV1';
    kitKey: 'gredice-buildings';
    kitVersion: '1';
    units: Readonly<{
        length: 'metre';
        metresPerUnit: 1;
        semanticAxes: Readonly<{
            x: 'right';
            y: 'front';
            height: 'up';
        }>;
        sourceAxes: Readonly<{
            x: 'right';
            y: 'front';
            z: 'up';
        }>;
        tileEdge: 1;
    }>;
    nodeMaterials: Readonly<Record<string, GardenStructureMaterialMetadata>>;
    materials: Readonly<Record<string, GardenStructureKitSemanticMaterial>>;
    floorParts: Readonly<Record<string, GardenStructureKitFloorAssetPart>>;
    edgeParts: Readonly<Record<string, GardenStructureKitEdgeAssetPart>>;
    roofStyles: Readonly<Record<string, GardenStructureKitRoofAssetPart>>;
    propParts: Readonly<Record<string, GardenStructureKitPropAssetPart>>;
}>;

export type GardenStructureKitManifestIssue = Readonly<{
    code:
        | 'bounds'
        | 'collision'
        | 'duplicate-node'
        | 'glass-separation'
        | 'material-reference'
        | 'node-name'
        | 'portal'
        | 'reference-set'
        | 'units';
    path: string;
    message: string;
}>;

const prefix = 'GardenStructureKitV1';
const physicalMaterial = `Material.${prefix}`;

const physicalMaterialNames = Object.freeze({
    allotmentGreen: `${physicalMaterial}.AllotmentGreen`,
    darkMetal: `${physicalMaterial}.DarkMetal`,
    darkWood: `${physicalMaterial}.DarkWood`,
    glass: `${physicalMaterial}.Glass`,
    greyStone: `${physicalMaterial}.GreyStone`,
    honeyWood: `${physicalMaterial}.HoneyWood`,
    limePlaster: `${physicalMaterial}.LimePlaster`,
    limestone: `${physicalMaterial}.Limestone`,
    soil: `${physicalMaterial}.Soil`,
    terracotta: `${physicalMaterial}.Terracotta`,
    terracottaDark: `${physicalMaterial}.TerracottaDark`,
    warmWood: `${physicalMaterial}.WarmWood`,
});

function vector3(
    x: number,
    y: number,
    height: number,
): GardenStructureKitVector3 {
    return Object.freeze([x, y, height]);
}

function bounds(
    minimum: GardenStructureKitVector3,
    maximum: GardenStructureKitVector3,
): GardenStructureKitBounds {
    return Object.freeze({ minimum, maximum });
}

const cellAnchor: GardenStructureKitAnchor = Object.freeze({
    kind: 'cell-base-center',
    position: vector3(0, 0, 0),
});

const edgeAnchor: GardenStructureKitAnchor = Object.freeze({
    kind: 'edge-base-center',
    position: vector3(0, 0, 0),
});

function node(
    nodeName: string,
    transparency: GardenStructureKitNodeBinding['transparency'],
    nodeMaterialNames: readonly string[],
): GardenStructureKitNodeBinding {
    return Object.freeze({
        nodeName,
        nodeMaterialNames: Object.freeze([...nodeMaterialNames]),
        transparency,
    });
}

function semanticMaterial(
    transparency: GardenStructureKitSemanticMaterial['transparency'],
    nodeMaterialNames: readonly string[],
): GardenStructureKitSemanticMaterial {
    return Object.freeze({
        nodeMaterialNames: Object.freeze([...nodeMaterialNames]),
        transparency,
    });
}

function floorPart(
    value: GardenStructureKitFloorAssetPart,
): GardenStructureKitFloorAssetPart {
    return Object.freeze(value);
}

function edgePart(
    value: GardenStructureKitEdgeAssetPart,
): GardenStructureKitEdgeAssetPart {
    return Object.freeze(value);
}

function roofStyle(
    value: GardenStructureKitRoofAssetPart,
): GardenStructureKitRoofAssetPart {
    return Object.freeze(value);
}

function propPart(
    value: GardenStructureKitPropAssetPart,
): GardenStructureKitPropAssetPart {
    return Object.freeze(value);
}

const opaque = Object.freeze({
    transparency: 'opaque',
}) satisfies GardenStructureMaterialMetadata;
const transparent = Object.freeze({
    transparency: 'transparent',
}) satisfies GardenStructureMaterialMetadata;

const nodeMaterials = Object.freeze({
    [physicalMaterialNames.allotmentGreen]: opaque,
    [physicalMaterialNames.darkMetal]: opaque,
    [physicalMaterialNames.darkWood]: opaque,
    [physicalMaterialNames.glass]: transparent,
    [physicalMaterialNames.greyStone]: opaque,
    [physicalMaterialNames.honeyWood]: opaque,
    [physicalMaterialNames.limePlaster]: opaque,
    [physicalMaterialNames.limestone]: opaque,
    [physicalMaterialNames.soil]: opaque,
    [physicalMaterialNames.terracotta]: opaque,
    [physicalMaterialNames.terracottaDark]: opaque,
    [physicalMaterialNames.warmWood]: opaque,
});

const woodMaterials = Object.freeze([
    physicalMaterialNames.darkWood,
    physicalMaterialNames.honeyWood,
    physicalMaterialNames.warmWood,
]);

const materials = Object.freeze({
    'floor.limestone': semanticMaterial('opaque', [
        physicalMaterialNames.limestone,
    ]),
    'floor.stone': semanticMaterial('opaque', [
        physicalMaterialNames.greyStone,
    ]),
    'floor.timber': semanticMaterial('opaque', [
        physicalMaterialNames.honeyWood,
        physicalMaterialNames.warmWood,
    ]),
    'roof.clay': semanticMaterial('opaque', [
        physicalMaterialNames.darkWood,
        physicalMaterialNames.terracotta,
        physicalMaterialNames.terracottaDark,
    ]),
    'roof.greenhouse-panel': semanticMaterial('transparent', [
        physicalMaterialNames.allotmentGreen,
        physicalMaterialNames.glass,
    ]),
    'wall.timber': semanticMaterial('opaque', [
        ...woodMaterials,
        physicalMaterialNames.limestone,
    ]),
    'wall.plaster': semanticMaterial('opaque', [
        physicalMaterialNames.allotmentGreen,
        physicalMaterialNames.limePlaster,
        physicalMaterialNames.limestone,
    ]),
    'wall.greenhouse-panel': semanticMaterial('transparent', [
        physicalMaterialNames.allotmentGreen,
        physicalMaterialNames.glass,
    ]),
    'window.house': semanticMaterial('transparent', [
        physicalMaterialNames.allotmentGreen,
        physicalMaterialNames.glass,
        physicalMaterialNames.limePlaster,
        physicalMaterialNames.limestone,
    ]),
    'door.timber-wide-open': semanticMaterial('opaque', [
        ...woodMaterials,
        physicalMaterialNames.darkMetal,
        physicalMaterialNames.limestone,
    ]),
    'door.house-open': semanticMaterial('opaque', [
        physicalMaterialNames.allotmentGreen,
        physicalMaterialNames.darkMetal,
        physicalMaterialNames.honeyWood,
        physicalMaterialNames.limePlaster,
    ]),
    'door.greenhouse-open': semanticMaterial('transparent', [
        physicalMaterialNames.allotmentGreen,
        physicalMaterialNames.darkMetal,
        physicalMaterialNames.glass,
    ]),
    'prop.workbench': semanticMaterial('opaque', [
        ...woodMaterials,
        physicalMaterialNames.allotmentGreen,
    ]),
    'prop.table': semanticMaterial('opaque', woodMaterials),
    'prop.planter': semanticMaterial('opaque', [
        ...woodMaterials,
        physicalMaterialNames.soil,
    ]),
    'prop.chair': semanticMaterial('opaque', [
        physicalMaterialNames.allotmentGreen,
        physicalMaterialNames.darkWood,
        physicalMaterialNames.honeyWood,
    ]),
    'prop.shelf': semanticMaterial('opaque', [
        ...woodMaterials,
        physicalMaterialNames.allotmentGreen,
    ]),
    'prop.crate': semanticMaterial('opaque', woodMaterials),
});

const floorParts = Object.freeze({
    'floor.limestone': floorPart({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.5, -0.5, 0), vector3(0.5, 0.5, 0.08)),
        collision: Object.freeze({
            kind: 'walkable-surface',
            thickness: 0.08,
        }),
        materialId: 'floor.limestone',
        nodes: Object.freeze([
            node(`${prefix}_FloorLimestone`, 'opaque', [
                physicalMaterialNames.limestone,
            ]),
        ]),
    }),
    'floor.stone': floorPart({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.5, -0.5, 0), vector3(0.5, 0.5, 0.08)),
        collision: Object.freeze({
            kind: 'walkable-surface',
            thickness: 0.08,
        }),
        materialId: 'floor.stone',
        nodes: Object.freeze([
            node(`${prefix}_FloorStone`, 'opaque', [
                physicalMaterialNames.greyStone,
            ]),
        ]),
    }),
    'floor.timber': floorPart({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.5, -0.5, 0), vector3(0.5, 0.5, 0.08)),
        collision: Object.freeze({
            kind: 'walkable-surface',
            thickness: 0.08,
        }),
        materialId: 'floor.timber',
        nodes: Object.freeze([
            node(`${prefix}_FloorTimber`, 'opaque', [
                physicalMaterialNames.honeyWood,
                physicalMaterialNames.warmWood,
            ]),
        ]),
    }),
});

const edgeParts = Object.freeze({
    'wall.timber': edgePart({
        anchor: edgeAnchor,
        bounds: bounds(vector3(-0.5, -0.07, 0), vector3(0.5, 0.07, 2.4)),
        collisionHeight: 2.4,
        collisionThickness: 0.12,
        edgeKind: 'wall',
        materialId: 'wall.timber',
        nodes: Object.freeze([
            node(`${prefix}_WallTimber`, 'opaque', [
                ...woodMaterials,
                physicalMaterialNames.limestone,
            ]),
        ]),
        passage: 'solid',
    }),
    'wall.plaster': edgePart({
        anchor: edgeAnchor,
        bounds: bounds(vector3(-0.5, -0.07, 0), vector3(0.5, 0.07, 2.4)),
        collisionHeight: 2.4,
        collisionThickness: 0.12,
        edgeKind: 'wall',
        materialId: 'wall.plaster',
        nodes: Object.freeze([
            node(`${prefix}_WallPlaster`, 'opaque', [
                physicalMaterialNames.allotmentGreen,
                physicalMaterialNames.limePlaster,
                physicalMaterialNames.limestone,
            ]),
        ]),
        passage: 'solid',
    }),
    'wall.greenhouse-panel': edgePart({
        anchor: edgeAnchor,
        bounds: bounds(vector3(-0.5, -0.04, 0), vector3(0.5, 0.04, 2.4)),
        collisionHeight: 2.4,
        collisionThickness: 0.08,
        edgeKind: 'wall',
        materialId: 'wall.greenhouse-panel',
        nodes: Object.freeze([
            node(`${prefix}_WallGreenhouseFrame`, 'opaque', [
                physicalMaterialNames.allotmentGreen,
            ]),
            node(`${prefix}_WallGreenhouseGlass`, 'transparent', [
                physicalMaterialNames.glass,
            ]),
        ]),
        passage: 'solid',
    }),
    'window.house': edgePart({
        anchor: edgeAnchor,
        bounds: bounds(vector3(-0.5, -0.07, 0), vector3(0.5, 0.12, 2.4)),
        collisionHeight: 2.4,
        collisionThickness: 0.12,
        edgeKind: 'window',
        materialId: 'window.house',
        nodes: Object.freeze([
            node(`${prefix}_WindowHouseFrame`, 'opaque', [
                physicalMaterialNames.allotmentGreen,
                physicalMaterialNames.limePlaster,
                physicalMaterialNames.limestone,
            ]),
            node(`${prefix}_WindowHouseGlass`, 'transparent', [
                physicalMaterialNames.glass,
            ]),
        ]),
        passage: 'solid',
    }),
    'door.timber-wide-open': edgePart({
        anchor: edgeAnchor,
        bounds: bounds(vector3(-0.5, -0.07, 0), vector3(0.5, 0.85, 2.4)),
        collisionHeight: 2.4,
        collisionThickness: 0.12,
        edgeKind: 'door',
        materialId: 'door.timber-wide-open',
        nodes: Object.freeze([
            node(`${prefix}_DoorTimberWideOpen`, 'opaque', [
                ...woodMaterials,
                physicalMaterialNames.darkMetal,
                physicalMaterialNames.limestone,
            ]),
        ]),
        passage: 'open-portal',
        portalClearanceHeight: 2.2,
        portalClearanceWidth: 0.88,
    }),
    'door.house-open': edgePart({
        anchor: edgeAnchor,
        bounds: bounds(vector3(-0.5, -0.07, 0), vector3(0.5, 0.8, 2.4)),
        collisionHeight: 2.4,
        collisionThickness: 0.12,
        edgeKind: 'door',
        materialId: 'door.house-open',
        nodes: Object.freeze([
            node(`${prefix}_DoorHouseOpen`, 'opaque', [
                physicalMaterialNames.allotmentGreen,
                physicalMaterialNames.darkMetal,
                physicalMaterialNames.honeyWood,
                physicalMaterialNames.limePlaster,
            ]),
        ]),
        passage: 'open-portal',
        portalClearanceHeight: 2.15,
        portalClearanceWidth: 0.82,
    }),
    'door.greenhouse-open': edgePart({
        anchor: edgeAnchor,
        bounds: bounds(vector3(-0.5, -0.07, 0), vector3(0.5, 0.8, 2.4)),
        collisionHeight: 2.4,
        collisionThickness: 0.12,
        edgeKind: 'door',
        materialId: 'door.greenhouse-open',
        nodes: Object.freeze([
            node(`${prefix}_DoorGreenhouseOpenFrame`, 'opaque', [
                physicalMaterialNames.allotmentGreen,
                physicalMaterialNames.darkMetal,
            ]),
            node(`${prefix}_DoorGreenhouseOpenGlass`, 'transparent', [
                physicalMaterialNames.glass,
            ]),
        ]),
        passage: 'open-portal',
        portalClearanceHeight: 2.15,
        portalClearanceWidth: 0.84,
    }),
});

const roofStyles = Object.freeze({
    'roof.gable': roofStyle({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.57, -0.55, 2.36), vector3(0.57, 0.55, 3.2)),
        ceilingHeight: 2.4,
        materialIds: Object.freeze(['roof.clay']),
        maximumHeight: 3.2,
        nodes: Object.freeze([
            node(`${prefix}_RoofGable`, 'opaque', [
                physicalMaterialNames.terracotta,
                physicalMaterialNames.terracottaDark,
            ]),
        ]),
    }),
    'roof.shed': roofStyle({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.55, -0.55, 2.29), vector3(0.55, 0.55, 2.9)),
        ceilingHeight: 2.35,
        materialIds: Object.freeze(['roof.clay']),
        maximumHeight: 2.9,
        nodes: Object.freeze([
            node(`${prefix}_RoofShed`, 'opaque', [
                physicalMaterialNames.darkWood,
                physicalMaterialNames.terracotta,
            ]),
        ]),
    }),
    'roof.greenhouse-gable': roofStyle({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.57, -0.55, 2.36), vector3(0.57, 0.55, 3.1)),
        ceilingHeight: 2.4,
        materialIds: Object.freeze(['roof.greenhouse-panel']),
        maximumHeight: 3.1,
        nodes: Object.freeze([
            node(`${prefix}_RoofGreenhouseGableFrame`, 'opaque', [
                physicalMaterialNames.allotmentGreen,
            ]),
            node(`${prefix}_RoofGreenhouseGableGlass`, 'transparent', [
                physicalMaterialNames.glass,
            ]),
        ]),
    }),
});

const propParts = Object.freeze({
    'prop.workbench': propPart({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.41, -0.25, 0), vector3(0.41, 0.25, 0.92)),
        collisionDepth: 0.5,
        collisionHeight: 0.92,
        collisionWidth: 0.82,
        materialId: 'prop.workbench',
        nodes: Object.freeze([
            node(`${prefix}_PropWorkbench`, 'opaque', [
                ...woodMaterials,
                physicalMaterialNames.allotmentGreen,
            ]),
        ]),
    }),
    'prop.table': propPart({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.37, -0.37, 0), vector3(0.37, 0.37, 0.8)),
        collisionDepth: 0.74,
        collisionHeight: 0.8,
        collisionWidth: 0.74,
        materialId: 'prop.table',
        nodes: Object.freeze([
            node(`${prefix}_PropTable`, 'opaque', woodMaterials),
        ]),
    }),
    'prop.planter': propPart({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.36, -0.32, 0), vector3(0.36, 0.32, 0.5)),
        collisionDepth: 0.64,
        collisionHeight: 0.5,
        collisionWidth: 0.72,
        materialId: 'prop.planter',
        nodes: Object.freeze([
            node(`${prefix}_PropPlanter`, 'opaque', [
                ...woodMaterials,
                physicalMaterialNames.soil,
            ]),
        ]),
    }),
    'prop.chair': propPart({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.23, -0.22, 0), vector3(0.23, 0.22, 0.86)),
        collisionDepth: 0.44,
        collisionHeight: 0.86,
        collisionWidth: 0.46,
        materialId: 'prop.chair',
        nodes: Object.freeze([
            node(`${prefix}_PropChair`, 'opaque', [
                physicalMaterialNames.allotmentGreen,
                physicalMaterialNames.darkWood,
                physicalMaterialNames.honeyWood,
            ]),
        ]),
    }),
    'prop.shelf': propPart({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.39, -0.15, 0), vector3(0.39, 0.15, 1.6)),
        collisionDepth: 0.3,
        collisionHeight: 1.6,
        collisionWidth: 0.78,
        materialId: 'prop.shelf',
        nodes: Object.freeze([
            node(`${prefix}_PropShelf`, 'opaque', [
                ...woodMaterials,
                physicalMaterialNames.allotmentGreen,
            ]),
        ]),
    }),
    'prop.crate': propPart({
        anchor: cellAnchor,
        bounds: bounds(vector3(-0.24, -0.21, 0), vector3(0.24, 0.21, 0.38)),
        collisionDepth: 0.42,
        collisionHeight: 0.38,
        collisionWidth: 0.48,
        materialId: 'prop.crate',
        nodes: Object.freeze([
            node(`${prefix}_PropCrate`, 'opaque', woodMaterials),
        ]),
    }),
});

export const gardenStructureKitV1AssetManifest: GardenStructureKitAssetManifest =
    Object.freeze({
        assetName: 'GardenStructureKitV1',
        edgeParts,
        floorParts,
        kitKey: 'gredice-buildings',
        kitVersion: '1',
        materials,
        nodeMaterials,
        propParts,
        roofStyles,
        units: Object.freeze({
            length: 'metre',
            metresPerUnit: 1,
            semanticAxes: Object.freeze({
                height: 'up',
                x: 'right',
                y: 'front',
            }),
            sourceAxes: Object.freeze({
                x: 'right',
                y: 'front',
                z: 'up',
            }),
            tileEdge: 1,
        }),
    });

export const gardenStructureKitV1Metadata: GardenStructureKitMetadata =
    Object.freeze({
        ceilingThickness: 0.06,
        edgeParts,
        floorThickness: 0.08,
        kitKey: gardenStructureKitV1AssetManifest.kitKey,
        kitVersion: gardenStructureKitV1AssetManifest.kitVersion,
        materials,
        propParts,
        roofStyles,
        visualHorizontalPadding: 0.06,
    });

const expectedReferenceIds = Object.freeze({
    edgeParts: Object.freeze([
        'door.greenhouse-open',
        'door.house-open',
        'door.timber-wide-open',
        'wall.greenhouse-panel',
        'wall.plaster',
        'wall.timber',
        'window.house',
    ]),
    floorParts: Object.freeze([
        'floor.limestone',
        'floor.stone',
        'floor.timber',
    ]),
    propParts: Object.freeze([
        'prop.chair',
        'prop.crate',
        'prop.planter',
        'prop.shelf',
        'prop.table',
        'prop.workbench',
    ]),
    roofStyles: Object.freeze([
        'roof.gable',
        'roof.greenhouse-gable',
        'roof.shed',
    ]),
});

function allParts(manifest: GardenStructureKitAssetManifest) {
    return [
        ...Object.entries(manifest.floorParts),
        ...Object.entries(manifest.edgeParts),
        ...Object.entries(manifest.roofStyles),
        ...Object.entries(manifest.propParts),
    ];
}

export function getGardenStructureKitV1NodeNames(
    manifest: GardenStructureKitAssetManifest = gardenStructureKitV1AssetManifest,
) {
    return Object.freeze(
        allParts(manifest)
            .flatMap(([, part]) => part.nodes.map(({ nodeName }) => nodeName))
            .toSorted((left, right) => left.localeCompare(right)),
    );
}

function finitePositive(value: number) {
    return Number.isFinite(value) && value > 0;
}

function issue(
    code: GardenStructureKitManifestIssue['code'],
    path: string,
    message: string,
): GardenStructureKitManifestIssue {
    return Object.freeze({ code, message, path });
}

function sameSortedValues(left: readonly string[], right: readonly string[]) {
    return (
        left.length === right.length &&
        left.every((value, index) => value === right[index])
    );
}

/**
 * Validates only data and strings. It deliberately imports no renderer or GLTF
 * loader, so API validation, 2D summaries, and workers can share this contract.
 */
export function validateGardenStructureKitV1Manifest(
    manifest: GardenStructureKitAssetManifest = gardenStructureKitV1AssetManifest,
): readonly GardenStructureKitManifestIssue[] {
    const issues: GardenStructureKitManifestIssue[] = [];
    if (
        manifest.units.length !== 'metre' ||
        manifest.units.metresPerUnit !== 1 ||
        manifest.units.tileEdge !== 1
    ) {
        issues.push(
            issue('units', 'units', 'Version one must use a one-metre grid.'),
        );
    }

    const validateReferenceSet = (
        key: string,
        record: Readonly<Record<string, unknown>>,
        expected: readonly string[],
    ) => {
        const actual = Object.keys(record).toSorted((left, right) =>
            left.localeCompare(right),
        );
        if (!sameSortedValues(actual, expected)) {
            issues.push(
                issue(
                    'reference-set',
                    key,
                    `Expected ${expected.join(', ')}, received ${actual.join(', ')}.`,
                ),
            );
        }
    };
    validateReferenceSet(
        'edgeParts',
        manifest.edgeParts,
        expectedReferenceIds.edgeParts,
    );
    validateReferenceSet(
        'floorParts',
        manifest.floorParts,
        expectedReferenceIds.floorParts,
    );
    validateReferenceSet(
        'propParts',
        manifest.propParts,
        expectedReferenceIds.propParts,
    );
    validateReferenceSet(
        'roofStyles',
        manifest.roofStyles,
        expectedReferenceIds.roofStyles,
    );

    const seenNodes = new Set<string>();
    const usedNodeMaterials = new Set<string>();
    const usedSemanticMaterials = new Set<string>();
    const boundNodeMaterialsBySemanticMaterial = new Map<string, Set<string>>();
    for (const [materialId, materialMetadata] of Object.entries(
        manifest.materials,
    )) {
        for (const materialName of materialMetadata.nodeMaterialNames) {
            const nodeMaterialMetadata = manifest.nodeMaterials[materialName];
            if (!nodeMaterialMetadata) {
                issues.push(
                    issue(
                        'material-reference',
                        `materials.${materialId}`,
                        `Semantic material references missing node material ${materialName}.`,
                    ),
                );
            }
        }
    }

    for (const [partId, part] of allParts(manifest)) {
        const path = `parts.${partId}`;
        const semanticMaterialIds =
            'materialId' in part ? [part.materialId] : part.materialIds;
        const allowedNodeMaterialNames = new Set(
            semanticMaterialIds.flatMap(
                (materialId) =>
                    manifest.materials[materialId]?.nodeMaterialNames ?? [],
            ),
        );
        if (
            part.anchor.position.some((value) => value !== 0) ||
            !part.bounds.minimum.every(Number.isFinite) ||
            !part.bounds.maximum.every(Number.isFinite) ||
            part.bounds.minimum.some(
                (value, index) => value > (part.bounds.maximum[index] ?? value),
            )
        ) {
            issues.push(
                issue(
                    'bounds',
                    path,
                    'Anchor must be at zero and bounds must be finite and ordered.',
                ),
            );
        }

        for (const binding of part.nodes) {
            const nodePath = `${path}.nodes.${binding.nodeName}`;
            if (!binding.nodeName.startsWith(`${prefix}_`)) {
                issues.push(
                    issue(
                        'node-name',
                        nodePath,
                        `Node must start with ${prefix}_.`,
                    ),
                );
            }
            if (seenNodes.has(binding.nodeName)) {
                issues.push(
                    issue(
                        'duplicate-node',
                        nodePath,
                        'A GLB node may belong to only one semantic part.',
                    ),
                );
            }
            seenNodes.add(binding.nodeName);

            const usesGlass = binding.nodeMaterialNames.includes(
                physicalMaterialNames.glass,
            );
            if (
                usesGlass !== (binding.transparency === 'transparent') ||
                (usesGlass &&
                    (binding.nodeMaterialNames.length !== 1 ||
                        !binding.nodeName.endsWith('Glass')))
            ) {
                issues.push(
                    issue(
                        'glass-separation',
                        nodePath,
                        'Glass must use one dedicated transparent node and material.',
                    ),
                );
            }

            for (const materialName of binding.nodeMaterialNames) {
                usedNodeMaterials.add(materialName);
                const materialMetadata = manifest.nodeMaterials[materialName];
                if (
                    !materialMetadata ||
                    materialMetadata.transparency !== binding.transparency ||
                    !allowedNodeMaterialNames.has(materialName)
                ) {
                    issues.push(
                        issue(
                            'material-reference',
                            nodePath,
                            `Node material ${materialName} is missing or has the wrong transparency.`,
                        ),
                    );
                }
            }
        }

        const onlySemanticMaterialId = semanticMaterialIds[0];
        if (
            semanticMaterialIds.length === 1 &&
            typeof onlySemanticMaterialId === 'string'
        ) {
            const boundMaterials =
                boundNodeMaterialsBySemanticMaterial.get(
                    onlySemanticMaterialId,
                ) ?? new Set<string>();
            for (const binding of part.nodes) {
                for (const materialName of binding.nodeMaterialNames) {
                    boundMaterials.add(materialName);
                }
            }
            boundNodeMaterialsBySemanticMaterial.set(
                onlySemanticMaterialId,
                boundMaterials,
            );
        }
    }

    for (const [
        materialId,
        boundMaterials,
    ] of boundNodeMaterialsBySemanticMaterial) {
        const material = manifest.materials[materialId];
        if (
            material &&
            !sameSortedValues(
                [...material.nodeMaterialNames].toSorted((left, right) =>
                    left.localeCompare(right),
                ),
                [...boundMaterials].toSorted((left, right) =>
                    left.localeCompare(right),
                ),
            )
        ) {
            issues.push(
                issue(
                    'material-reference',
                    `materials.${materialId}`,
                    'A single-semantic part must declare exactly the physical materials bound by its nodes.',
                ),
            );
        }
    }

    for (const materialName of Object.keys(manifest.nodeMaterials)) {
        if (!usedNodeMaterials.has(materialName)) {
            issues.push(
                issue(
                    'material-reference',
                    `nodeMaterials.${materialName}`,
                    'Every physical material must be reachable from a node binding.',
                ),
            );
        }
    }

    for (const [partId, part] of Object.entries(manifest.floorParts)) {
        usedSemanticMaterials.add(part.materialId);
        if (
            part.materialId !== partId ||
            !manifest.materials[part.materialId] ||
            part.anchor.kind !== 'cell-base-center' ||
            part.bounds.minimum[0] !== -0.5 ||
            part.bounds.minimum[1] !== -0.5 ||
            part.bounds.maximum[0] !== 0.5 ||
            part.bounds.maximum[1] !== 0.5 ||
            part.collision.thickness !== 0.08
        ) {
            issues.push(
                issue(
                    'collision',
                    `floorParts.${partId}`,
                    'Floor tiles must share the one-metre, 0.08-metre collision contract.',
                ),
            );
        }
    }

    for (const [partId, part] of Object.entries(manifest.edgeParts)) {
        usedSemanticMaterials.add(part.materialId);
        const thickness = part.bounds.maximum[1] - part.bounds.minimum[1];
        const height = part.bounds.maximum[2] - part.bounds.minimum[2];
        if (
            part.anchor.kind !== 'edge-base-center' ||
            !manifest.materials[part.materialId] ||
            !finitePositive(part.collisionHeight) ||
            !finitePositive(part.collisionThickness) ||
            part.collisionHeight > height + 0.000_001 ||
            part.collisionThickness > thickness + 0.000_001
        ) {
            issues.push(
                issue(
                    'collision',
                    `edgeParts.${partId}`,
                    'Edge collision must be positive, fit its declared bounds, and use the edge anchor.',
                ),
            );
        }
        const hasPortal =
            finitePositive(part.portalClearanceHeight ?? 0) &&
            finitePositive(part.portalClearanceWidth ?? 0);
        if (
            (part.passage === 'open-portal') !== hasPortal ||
            (hasPortal &&
                ((part.portalClearanceHeight ?? 0) > part.collisionHeight ||
                    (part.portalClearanceWidth ?? 0) > 1))
        ) {
            issues.push(
                issue(
                    'portal',
                    `edgeParts.${partId}`,
                    'Open portals need bounded width and height clearances; solid edges must not.',
                ),
            );
        }
    }

    for (const [partId, part] of Object.entries(manifest.propParts)) {
        usedSemanticMaterials.add(part.materialId);
        const width = part.bounds.maximum[0] - part.bounds.minimum[0];
        const depth = part.bounds.maximum[1] - part.bounds.minimum[1];
        const height = part.bounds.maximum[2] - part.bounds.minimum[2];
        if (
            part.anchor.kind !== 'cell-base-center' ||
            !finitePositive(part.collisionWidth) ||
            !finitePositive(part.collisionDepth) ||
            !finitePositive(part.collisionHeight) ||
            part.collisionWidth > width + 0.000_001 ||
            part.collisionDepth > depth + 0.000_001 ||
            part.collisionHeight > height + 0.000_001
        ) {
            issues.push(
                issue(
                    'collision',
                    `propParts.${partId}`,
                    'Prop collision must be positive and fit its declared bounds.',
                ),
            );
        }
    }

    for (const [styleId, style] of Object.entries(manifest.roofStyles)) {
        for (const materialId of style.materialIds) {
            usedSemanticMaterials.add(materialId);
            if (!manifest.materials[materialId]) {
                issues.push(
                    issue(
                        'material-reference',
                        `roofStyles.${styleId}`,
                        `Roof references missing semantic material ${materialId}.`,
                    ),
                );
            }
        }
        if (
            style.anchor.kind !== 'cell-base-center' ||
            !finitePositive(style.ceilingHeight) ||
            style.maximumHeight < style.ceilingHeight ||
            style.bounds.maximum[2] > style.maximumHeight
        ) {
            issues.push(
                issue(
                    'bounds',
                    `roofStyles.${styleId}`,
                    'Roof height metadata must enclose the visual bounds.',
                ),
            );
        }
    }

    for (const materialId of Object.keys(manifest.materials)) {
        if (!usedSemanticMaterials.has(materialId)) {
            issues.push(
                issue(
                    'material-reference',
                    `materials.${materialId}`,
                    'Every semantic material must be reachable from a kit part.',
                ),
            );
        }
    }

    return Object.freeze(
        issues.toSorted((left, right) =>
            `${left.path}:${left.code}`.localeCompare(
                `${right.path}:${right.code}`,
            ),
        ),
    );
}
