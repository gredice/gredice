import type {
    GardenStructureEdgeKind,
    GardenStructureReference,
    GardenStructureReferenceValidator,
    GardenStructureTemplateKey,
} from './types';

export type GardenStructureKitReferenceDefinition = Readonly<{
    kitKey: string;
    kitVersion: string;
    templateKeys: readonly GardenStructureTemplateKey[];
    floorMaterialIds: readonly string[];
    edgeParts: Readonly<Record<string, GardenStructureEdgeKind>>;
    roofStyles: Readonly<Record<string, readonly string[]>>;
    propVariants: Readonly<Record<string, readonly string[]>>;
}>;

const versionOneTemplateKeys: readonly GardenStructureTemplateKey[] =
    Object.freeze(['barn', 'house', 'greenhouse', 'blank']);

const versionOneKit = Object.freeze({
    kitKey: 'gredice-buildings',
    kitVersion: '1',
    templateKeys: versionOneTemplateKeys,
    floorMaterialIds: Object.freeze([
        'floor.limestone',
        'floor.stone',
        'floor.timber',
    ]),
    edgeParts: Object.freeze({
        'door.greenhouse-open': 'door',
        'door.house-open': 'door',
        'door.timber-wide-open': 'door',
        'wall.greenhouse-panel': 'wall',
        'wall.plaster': 'wall',
        'wall.timber': 'wall',
        'window.house': 'window',
    }),
    roofStyles: Object.freeze({
        'roof.gable': Object.freeze(['roof.clay']),
        'roof.greenhouse-gable': Object.freeze(['roof.greenhouse-panel']),
        'roof.shed': Object.freeze(['roof.clay']),
    }),
    propVariants: Object.freeze({
        'prop.chair': Object.freeze([]),
        'prop.crate': Object.freeze([]),
        'prop.planter': Object.freeze([]),
        'prop.shelf': Object.freeze([]),
        'prop.table': Object.freeze([]),
        'prop.workbench': Object.freeze([]),
    }),
}) satisfies GardenStructureKitReferenceDefinition;

export const gardenStructureKitReferenceRegistry: Readonly<
    Record<string, GardenStructureKitReferenceDefinition>
> = Object.freeze({
    [`${versionOneKit.kitKey}@${versionOneKit.kitVersion}`]: versionOneKit,
});

export function getGardenStructureKitReferenceDefinition(
    kitKey: string,
    kitVersion: string,
) {
    return gardenStructureKitReferenceRegistry[`${kitKey}@${kitVersion}`];
}

function contains(values: readonly string[], value: string) {
    return values.includes(value);
}

export function isGardenStructureReferenceAllowed(
    definition: GardenStructureKitReferenceDefinition,
    reference: GardenStructureReference,
) {
    switch (reference.kind) {
        case 'floor-material':
            return contains(definition.floorMaterialIds, reference.id);
        case 'edge-part':
            return (
                Object.hasOwn(definition.edgeParts, reference.id) &&
                definition.edgeParts[reference.id] === reference.edgeKind
            );
        case 'roof-style':
            return Object.hasOwn(definition.roofStyles, reference.id);
        case 'roof-material': {
            const styleId = reference.parentReferenceId;
            return (
                typeof styleId === 'string' &&
                Object.hasOwn(definition.roofStyles, styleId) &&
                contains(definition.roofStyles[styleId] ?? [], reference.id)
            );
        }
        case 'prop-part':
            return Object.hasOwn(definition.propVariants, reference.id);
        case 'prop-variant': {
            const partId = reference.parentReferenceId;
            return (
                typeof partId === 'string' &&
                Object.hasOwn(definition.propVariants, partId) &&
                contains(definition.propVariants[partId] ?? [], reference.id)
            );
        }
    }
}

export function createGardenStructureReferenceValidator(
    kitKey: string,
    kitVersion: string,
): GardenStructureReferenceValidator | undefined {
    const definition = getGardenStructureKitReferenceDefinition(
        kitKey,
        kitVersion,
    );
    return definition
        ? (reference) =>
              isGardenStructureReferenceAllowed(definition, reference)
        : undefined;
}

export function isGardenStructureTemplateAvailable(
    kitKey: string,
    kitVersion: string,
    templateKey: GardenStructureTemplateKey,
) {
    const definition = getGardenStructureKitReferenceDefinition(
        kitKey,
        kitVersion,
    );
    return Boolean(definition?.templateKeys.includes(templateKey));
}
