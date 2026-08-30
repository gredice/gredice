export const gardenStructureSchemaVersion: 1 = 1;
export const gardenStructureMaxFootprintCells = 100;
export const gardenStructureMaxSideLength = 20;
/**
 * Hard safety ceiling shared by mutation and rendering paths. A garden lock
 * serializes creates, so the API can enforce this count without races.
 */
export const gardenStructureMaxActivePerGarden = 625;
export const gardenStructureSunflowerPricePerCell = 50;
// A connected n-cell polyomino has at most 4n - (n - 1) distinct incident
// grid edges. For the fixed 100-cell limit, every usable boundary and
// partition slot therefore fits in 301 entries.
export const gardenStructureMaxEdges = 301;
export const gardenStructureMaxRoofRegions = 100;
export const gardenStructureMaxProps = 100;
export const gardenStructureMaxIdentifierLength = 96;
export const gardenStructureMaxCoordinateMagnitude = 1_000;
export const gardenStructureMaxPayloadBytes = 192 * 1_024;

export type GardenStructureRotation = 0 | 1 | 2 | 3;

export type GardenStructureCoordinate = Readonly<{
    x: number;
    y: number;
}>;

export type GardenStructureSpaceKind = 'interior' | 'covered-outdoor';

export type GardenStructureFootprintCell = GardenStructureCoordinate &
    Readonly<{
        spaceKind: GardenStructureSpaceKind;
    }>;

export type GardenStructureFloor = Readonly<{
    cell: GardenStructureCoordinate;
    materialId: string;
}>;

export type GardenStructureEdgeDirection = 'north' | 'east';
export type GardenStructureEdgeKind = 'wall' | 'door' | 'window';

export type GardenStructureEdge = Readonly<{
    id: string;
    from: GardenStructureCoordinate;
    direction: GardenStructureEdgeDirection;
    partId: string;
    kind: GardenStructureEdgeKind;
}>;

export type GardenStructureRoofRegion = Readonly<{
    id: string;
    cells: readonly GardenStructureCoordinate[];
    styleId: string;
    materialId: string;
    rotation: GardenStructureRotation;
}>;

export type GardenStructureProp = Readonly<{
    id: string;
    partId: string;
    x: number;
    y: number;
    rotation: GardenStructureRotation;
    variantId?: string;
}>;

export type GardenStructureDocumentV1 = Readonly<{
    schemaVersion: typeof gardenStructureSchemaVersion;
    footprint: Readonly<{
        cells: readonly GardenStructureFootprintCell[];
    }>;
    floors: readonly GardenStructureFloor[];
    edges: readonly GardenStructureEdge[];
    roofRegions: readonly GardenStructureRoofRegion[];
    props: readonly GardenStructureProp[];
}>;

export type GardenStructureDocument = GardenStructureDocumentV1;

export type GardenStructurePlacement = Readonly<{
    anchorX: number;
    anchorY: number;
    rotation: GardenStructureRotation;
}>;

export type GardenStructureFootprintBounds = Readonly<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    depth: number;
}>;

export type GardenStructureTemplateKey =
    | 'barn'
    | 'house'
    | 'greenhouse'
    | 'blank';

export type GardenStructureTemplateSeed = Readonly<{
    templateKey: GardenStructureTemplateKey;
    kitKey: 'gredice-buildings';
    kitVersion: '1';
    document: GardenStructureDocumentV1;
}>;

export type GardenStructureValidationSeverity = 'error' | 'warning';

export type GardenStructureValidationIssueCode =
    | 'invalid-document'
    | 'payload-too-large'
    | 'unsupported-schema-version'
    | 'invalid-field'
    | 'invalid-coordinate'
    | 'invalid-identifier'
    | 'invalid-part-reference'
    | 'too-many-items'
    | 'empty-footprint'
    | 'duplicate-footprint-cell'
    | 'disconnected-footprint'
    | 'footprint-cell-limit'
    | 'footprint-side-limit'
    | 'part-outside-footprint'
    | 'duplicate-part-id'
    | 'duplicate-edge'
    | 'duplicate-floor'
    | 'duplicate-roof-cell'
    | 'overlapping-roof-region'
    | 'overlapping-prop'
    | 'interior-without-floor'
    | 'incomplete-interior-shell'
    | 'covered-outdoor-without-roof';

export type GardenStructureValidationIssue = Readonly<{
    code: GardenStructureValidationIssueCode;
    severity: GardenStructureValidationSeverity;
    path: string;
    message: string;
}>;

export type GardenStructureValidationResult =
    | Readonly<{
          valid: true;
          document: GardenStructureDocumentV1;
          warnings: readonly GardenStructureValidationIssue[];
      }>
    | Readonly<{
          valid: false;
          issues: readonly GardenStructureValidationIssue[];
      }>;

export type GardenStructureReferenceKind =
    | 'edge-part'
    | 'floor-material'
    | 'prop-part'
    | 'prop-variant'
    | 'roof-material'
    | 'roof-style';

export type GardenStructureReference = Readonly<{
    id: string;
    kind: GardenStructureReferenceKind;
    path: string;
    edgeKind?: GardenStructureEdgeKind;
    ownerId?: string;
    parentReferenceId?: string;
}>;

/**
 * Renderer-free hook for validating kit/version-scoped identifiers. The API
 * supplies the immutable server allowlist; the shared decoder remains free of
 * catalogue, browser, and Three.js dependencies.
 */
export type GardenStructureReferenceValidator = (
    reference: GardenStructureReference,
) => boolean;

export type GardenStructureValidationOptions = Readonly<{
    isReferenceAllowed?: GardenStructureReferenceValidator;
}>;

export type GardenStructurePriceDelta = Readonly<{
    cellDelta: number;
    debit: number;
    refund: number;
    nextRefundablePrincipal: number;
}>;
