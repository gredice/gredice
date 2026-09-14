import type {
    GardenStructureDocumentV1,
    GardenStructurePlacement,
    GardenStructureTemplateKey,
} from '@gredice/js/gardenStructures';

export type GardenStructureProfileFixtureKey =
    | 'barn'
    | 'blank'
    | 'greenhouse'
    | 'house'
    | 'worst-case';

/**
 * Serializable input owned by the server-gated profile route. GameScene only
 * consumes this bounded document; it never imports fixture constructors.
 */
export type GardenStructureProfileFixtureDescriptor = Readonly<{
    document: GardenStructureDocumentV1;
    editorTemplateKey: GardenStructureTemplateKey;
    key: GardenStructureProfileFixtureKey;
    label: string;
    placement: GardenStructurePlacement;
    revision: number;
    structureId: string;
}>;
