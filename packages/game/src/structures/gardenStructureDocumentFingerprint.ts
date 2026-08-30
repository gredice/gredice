import type { GardenStructureDocumentV1 } from '@gredice/js/gardenStructures';
import { normalizeGardenStructureDocument } from '@gredice/js/gardenStructures';

const fingerprintVersion = 1;
const fnv1a64Offset = 0xcbf2_9ce4_8422_2325n;
const fnv1a64Prime = 0x0000_0100_0000_01b3n;
const uint64Mask = 0xffff_ffff_ffff_ffffn;

function compareCanonicalValues(left: string, right: string) {
    return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value: unknown) {
    return JSON.stringify(value);
}

function getCanonicalGardenStructureDocument(
    document: GardenStructureDocumentV1,
) {
    const normalized = normalizeGardenStructureDocument(document);

    return canonicalJson({
        schemaVersion: normalized.schemaVersion,
        footprint: normalized.footprint.cells
            .map((cell) =>
                canonicalJson({
                    x: cell.x,
                    y: cell.y,
                    spaceKind: cell.spaceKind,
                }),
            )
            .sort(compareCanonicalValues),
        floors: normalized.floors
            .map((floor) =>
                canonicalJson({
                    x: floor.cell.x,
                    y: floor.cell.y,
                    materialId: floor.materialId,
                }),
            )
            .sort(compareCanonicalValues),
        edges: normalized.edges
            .map((edge) =>
                canonicalJson({
                    id: edge.id,
                    x: edge.from.x,
                    y: edge.from.y,
                    direction: edge.direction,
                    partId: edge.partId,
                    kind: edge.kind,
                }),
            )
            .sort(compareCanonicalValues),
        roofRegions: normalized.roofRegions
            .map((region) =>
                canonicalJson({
                    id: region.id,
                    cells: region.cells
                        .map((cell) => canonicalJson([cell.x, cell.y]))
                        .sort(compareCanonicalValues),
                    styleId: region.styleId,
                    materialId: region.materialId,
                    rotation: region.rotation,
                }),
            )
            .sort(compareCanonicalValues),
        props: normalized.props
            .map((prop) =>
                canonicalJson({
                    id: prop.id,
                    partId: prop.partId,
                    x: prop.x,
                    y: prop.y,
                    rotation: prop.rotation,
                    variantId: prop.variantId ?? null,
                }),
            )
            .sort(compareCanonicalValues),
    });
}

function fnv1a64(value: string) {
    let hash = fnv1a64Offset;
    for (let index = 0; index < value.length; index++) {
        hash ^= BigInt(value.charCodeAt(index));
        hash = (hash * fnv1a64Prime) & uint64Mask;
    }
    return hash.toString(16).padStart(16, '0');
}

/**
 * Compact, stable identity for the render-affecting semantic document. Array
 * order and a translated local origin do not change the fingerprint because
 * they do not change compiler output.
 */
export function getGardenStructureDocumentFingerprint(
    document: GardenStructureDocumentV1,
) {
    const canonical = getCanonicalGardenStructureDocument(document);
    return `v${fingerprintVersion.toString()}-${canonical.length.toString(36)}-${fnv1a64(canonical)}`;
}
