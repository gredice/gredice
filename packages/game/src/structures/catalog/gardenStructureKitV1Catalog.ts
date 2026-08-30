import type { GardenStructureTemplateKey } from '@gredice/js/gardenStructures';
import { gardenStructureKitV1AssetManifest } from '../gardenStructureKitV1Manifest';

export const gardenStructureCatalogTemplateImageSize = 128;
export const gardenStructureCatalogPartImageSize = 96;
export const gardenStructureCatalogMaterialImageSize = 48;

export const gardenStructureCatalogTemplateMaxBytes = 4 * 1024;
export const gardenStructureCatalogPartMaxBytes = 2 * 1024;
export const gardenStructureCatalogMaterialMaxBytes = 1024;
export const gardenStructureCatalogTotalMaxBytes = 32 * 1024;

export type GardenStructureCatalogEntryKind = 'template' | 'part' | 'material';

export type GardenStructureCatalogPartCategory =
    | 'floor'
    | 'edge'
    | 'roof'
    | 'prop';

export type GardenStructureCatalogImage = Readonly<{
    height: number;
    maxBytes: number;
    src: string;
    width: number;
}>;

type GardenStructureCatalogEntryBase = Readonly<{
    image: GardenStructureCatalogImage;
    key: string;
    kitKey: 'gredice-buildings';
    kitVersion: '1';
    label: string;
}>;

export type GardenStructureCatalogTemplateEntry =
    GardenStructureCatalogEntryBase &
        Readonly<{
            id: GardenStructureTemplateKey;
            kind: 'template';
        }>;

export type GardenStructureCatalogPartEntry = GardenStructureCatalogEntryBase &
    Readonly<{
        category: GardenStructureCatalogPartCategory;
        id: string;
        kind: 'part';
    }>;

export type GardenStructureCatalogMaterialEntry =
    GardenStructureCatalogEntryBase &
        Readonly<{
            id: string;
            kind: 'material';
        }>;

export type GardenStructureCatalogEntry =
    | GardenStructureCatalogTemplateEntry
    | GardenStructureCatalogPartEntry
    | GardenStructureCatalogMaterialEntry;

const manifest = gardenStructureKitV1AssetManifest;
const catalogAssetRoot = `/assets/structures/${manifest.kitKey}/v${manifest.kitVersion}/catalog`;

const templateLabels = Object.freeze({
    barn: 'Staja',
    house: 'Kuća',
    greenhouse: 'Staklenik',
    blank: 'Prazna građevina',
}) satisfies Readonly<Record<GardenStructureTemplateKey, string>>;

const partLabels = Object.freeze({
    'floor.limestone': 'Pod od vapnenca',
    'floor.stone': 'Kameni pod',
    'floor.timber': 'Drveni pod',
    'wall.timber': 'Drveni zid',
    'wall.plaster': 'Žbukani zid',
    'wall.greenhouse-panel': 'Staklena stijena',
    'window.house': 'Prozor kuće',
    'door.timber-wide-open': 'Široka vrata staje',
    'door.house-open': 'Vrata kuće',
    'door.greenhouse-open': 'Vrata staklenika',
    'roof.gable': 'Dvostrešni krov',
    'roof.shed': 'Jednostrešni krov',
    'roof.greenhouse-gable': 'Krov staklenika',
    'prop.workbench': 'Radni stol',
    'prop.table': 'Stol',
    'prop.planter': 'Posuda za sadnju',
    'prop.chair': 'Stolica',
    'prop.shelf': 'Polica',
    'prop.crate': 'Sanduk',
});

const materialLabels = Object.freeze({
    'floor.limestone': 'Vapnenac',
    'floor.stone': 'Sivi kamen',
    'floor.timber': 'Toplo drvo poda',
    'roof.clay': 'Glineni crijep',
    'roof.greenhouse-panel': 'Staklo krova staklenika',
    'wall.timber': 'Drvo zida',
    'wall.plaster': 'Svijetla žbuka',
    'wall.greenhouse-panel': 'Staklo zida staklenika',
    'window.house': 'Okvir i staklo prozora',
    'door.timber-wide-open': 'Drvo vrata staje',
    'door.house-open': 'Drvo vrata kuće',
    'door.greenhouse-open': 'Okvir i staklo vrata',
    'prop.workbench': 'Drvo radnog stola',
    'prop.table': 'Drvo stola',
    'prop.planter': 'Drvo i zemlja posude',
    'prop.chair': 'Drvo stolice',
    'prop.shelf': 'Drvo police',
    'prop.crate': 'Drvo sanduka',
});

function catalogImage(
    kind: GardenStructureCatalogEntryKind,
    id: string,
): GardenStructureCatalogImage {
    const size =
        kind === 'template'
            ? gardenStructureCatalogTemplateImageSize
            : kind === 'part'
              ? gardenStructureCatalogPartImageSize
              : gardenStructureCatalogMaterialImageSize;
    const maxBytes =
        kind === 'template'
            ? gardenStructureCatalogTemplateMaxBytes
            : kind === 'part'
              ? gardenStructureCatalogPartMaxBytes
              : gardenStructureCatalogMaterialMaxBytes;
    return Object.freeze({
        height: size,
        maxBytes,
        src: `${catalogAssetRoot}/${kind}s/${id}.webp`,
        width: size,
    });
}

function labelFor(record: Readonly<Record<string, string>>, id: string) {
    const label = record[id];
    if (!label) {
        throw new Error(
            `Missing Garden Structure Kit V1 catalogue label for ${id}.`,
        );
    }
    return label;
}

function baseEntry(kind: GardenStructureCatalogEntryKind, id: string) {
    return {
        image: catalogImage(kind, id),
        key: `${manifest.kitKey}@${manifest.kitVersion}:${kind}:${id}`,
        kitKey: manifest.kitKey,
        kitVersion: manifest.kitVersion,
    };
}

function templateEntry(
    id: GardenStructureTemplateKey,
): GardenStructureCatalogTemplateEntry {
    return Object.freeze({
        ...baseEntry('template', id),
        id,
        kind: 'template',
        label: templateLabels[id],
    });
}

function partEntries(
    category: GardenStructureCatalogPartCategory,
    ids: readonly string[],
): readonly GardenStructureCatalogPartEntry[] {
    return Object.freeze(
        ids.map((id) =>
            Object.freeze({
                ...baseEntry('part', id),
                category,
                id,
                kind: 'part',
                label: labelFor(partLabels, id),
            }),
        ),
    );
}

function materialEntry(id: string): GardenStructureCatalogMaterialEntry {
    return Object.freeze({
        ...baseEntry('material', id),
        id,
        kind: 'material',
        label: labelFor(materialLabels, id),
    });
}

const templates = Object.freeze([
    templateEntry('barn'),
    templateEntry('house'),
    templateEntry('greenhouse'),
    templateEntry('blank'),
]);

const parts = Object.freeze([
    ...partEntries('floor', Object.keys(manifest.floorParts)),
    ...partEntries('edge', Object.keys(manifest.edgeParts)),
    ...partEntries('roof', Object.keys(manifest.roofStyles)),
    ...partEntries('prop', Object.keys(manifest.propParts)),
]);

const materials = Object.freeze(
    Object.keys(manifest.materials).map(materialEntry),
);

export const gardenStructureKitV1Catalog = Object.freeze({
    kitKey: manifest.kitKey,
    kitVersion: manifest.kitVersion,
    materials,
    parts,
    templates,
});

export const gardenStructureKitV1CatalogEntries: readonly GardenStructureCatalogEntry[] =
    Object.freeze([...templates, ...parts, ...materials]);
