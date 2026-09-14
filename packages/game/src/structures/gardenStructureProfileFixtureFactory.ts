import {
    createGardenStructureTemplateSeed,
    gardenStructureMaxFootprintCells,
    gardenStructureMaxSideLength,
    getGardenStructureFootprintBounds,
    getGardenStructurePayloadByteLength,
} from '@gredice/js/gardenStructures';
import { createWorstCaseGardenStructureDocument } from './benchmarkStructureCompiler';
import type {
    GardenStructureProfileFixtureDescriptor,
    GardenStructureProfileFixtureKey,
} from './gardenStructureProfileFixtureDescriptor';

const profileDocumentByteLimit = 192 * 1024;

const fixtureLabels: Readonly<
    Record<GardenStructureProfileFixtureKey, string>
> = Object.freeze({
    barn: 'Profilna štala',
    blank: 'Profilni prazni tlocrt',
    greenhouse: 'Profilni staklenik',
    house: 'Profilna kuća',
    'worst-case': 'Profilni maksimum 20 x 9 / 100 polja',
});

/** Internal implementation; only the server-only package subpath exports it. */
export function createGardenStructureProfileFixtureDescriptor(
    key: GardenStructureProfileFixtureKey,
): GardenStructureProfileFixtureDescriptor {
    const document =
        key === 'worst-case'
            ? createWorstCaseGardenStructureDocument()
            : createGardenStructureTemplateSeed(key).document;
    const bounds = getGardenStructureFootprintBounds(document.footprint.cells);
    const payloadBytes = getGardenStructurePayloadByteLength(document);
    if (
        !bounds ||
        document.footprint.cells.length > gardenStructureMaxFootprintCells ||
        bounds.width > gardenStructureMaxSideLength ||
        bounds.depth > gardenStructureMaxSideLength ||
        payloadBytes === null ||
        payloadBytes > profileDocumentByteLimit
    ) {
        throw new Error(
            `Garden structure profile fixture ${key} is unbounded.`,
        );
    }

    return Object.freeze({
        document,
        editorTemplateKey: key === 'worst-case' ? 'house' : key,
        key,
        label: fixtureLabels[key],
        placement: Object.freeze({ anchorX: -1, anchorY: -1, rotation: 0 }),
        revision: 1,
        structureId: `debug-garden-structure-${key}`,
    });
}
