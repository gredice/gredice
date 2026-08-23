import { closeStorage, getEntitiesRaw } from '../src';
import { auditAdvancedSowingCatalogue } from './lib/advancedSowingCatalogueAudit';

function numberValue(value: string | null) {
    if (value === null) {
        return null;
    }
    const trimmed = value.trim();
    return /^-?\d+(?:\.\d+)?$/u.test(trimmed) ? Number(trimmed) : value;
}

async function run() {
    // Use the uncached authoritative catalogue view so an activation preflight
    // cannot pass against an older directory cache immediately after edits.
    const plants = await getEntitiesRaw('plant', 'published');
    const result = auditAdvancedSowingCatalogue(
        plants.map((plant) => ({
            attributes: Object.fromEntries(
                plant.attributes
                    .filter(
                        (attribute) =>
                            attribute.attributeDefinition.category ===
                                'attributes' &&
                            (attribute.attributeDefinition.name ===
                                'seedingDistance' ||
                                attribute.attributeDefinition.name ===
                                    'seedingDistanceMin' ||
                                attribute.attributeDefinition.name ===
                                    'seedingDistanceMax'),
                    )
                    .map((attribute) => [
                        attribute.attributeDefinition.name,
                        numberValue(attribute.value),
                    ]),
            ),
            id: plant.id,
            name:
                plant.attributes.find(
                    (attribute) =>
                        attribute.attributeDefinition.category ===
                            'information' &&
                        attribute.attributeDefinition.name === 'name',
                )?.value ?? null,
        })),
    );

    console.info(JSON.stringify(result, null, 2));
    if (result.findings.length > 0) {
        process.exitCode = 1;
    }
}

try {
    await run();
} finally {
    await closeStorage();
}
