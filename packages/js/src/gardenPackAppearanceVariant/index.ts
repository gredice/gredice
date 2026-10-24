import { getEntityAppearanceVariantDefinition } from '../entityAppearanceVariants';

/** Decode a versioned, fixed snapshot selection; never choose a random or default appearance. */
export function resolveGardenPackLineVariant(line: {
    modelName: string;
    variant: { versionId: string; appearance: Record<string, string> } | null;
}): number | null {
    const definition = getEntityAppearanceVariantDefinition(line.modelName);
    if (!definition) {
        if (line.variant !== null)
            throw new Error('This model does not support a fixed appearance');
        return null;
    }
    if (
        line.variant?.versionId !== 'entity-appearance:v1' ||
        Object.keys(line.variant.appearance).length !== 1
    )
        throw new Error('Unsupported fixed appearance version');
    const selected = definition.variants.find(
        (candidate) => candidate.id === line.variant?.appearance.id,
    );
    if (!selected) throw new Error('Fixed appearance selection is unavailable');
    return selected.value;
}
