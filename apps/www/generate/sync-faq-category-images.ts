import {
    closeStorage,
    createAttributeDefinition,
    getAttributeDefinitions,
    getEntitiesRaw,
    imageAttributeValueFromUrl,
    imageUrlFromAttributeValue,
    upsertAttributeValue,
} from '@gredice/storage';
import {
    faqCategoryArtwork,
    faqCategoryAssetOrigin,
    getFaqCategoryArtwork,
} from '../components/faq/faqCategoryArtwork.ts';

const entityTypeName = 'faq-category';
const definitionConfig = {
    category: 'image',
    dataType: 'image',
    description:
        'Ilustracija kategorije za naslove i istaknute točke čestih pitanja.',
    display: true,
    entityTypeName,
    label: 'Ilustracija kategorije',
    multiple: false,
    name: 'cover',
    order: 'za',
    required: false,
};

async function main() {
    const args = process.argv.slice(2);
    for (const arg of args) {
        if (!['--apply', '--definition-only'].includes(arg)) {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    const apply = args.includes('--apply');
    const definitionOnly = args.includes('--definition-only');
    const definitions = (await getAttributeDefinitions(entityTypeName)).filter(
        (item) => item.category === 'image' && item.name === 'cover',
    );
    if (definitions.length > 1) {
        throw new Error(
            'Multiple active faq-category.image.cover definitions.',
        );
    }
    const existingDefinition = definitions[0];
    if (existingDefinition && existingDefinition.dataType !== 'image') {
        throw new Error('Existing faq-category.image.cover is not an image.');
    }
    const categories = await getEntitiesRaw(entityTypeName, 'published');
    const planned = categories.map((category) => {
        const name = category.attributes.find(
            (item) =>
                item.attributeDefinition.category === 'information' &&
                item.attributeDefinition.name === 'name',
        )?.value;
        const existing = category.attributes.find(
            (item) =>
                item.attributeDefinition.category === 'image' &&
                item.attributeDefinition.name === 'cover',
        );
        const path = getFaqCategoryArtwork(name ?? undefined);
        const url = path ? `${faqCategoryAssetOrigin}${path}` : null;
        const currentUrl = imageUrlFromAttributeValue(existing?.value);
        const action = !url
            ? 'unmapped'
            : currentUrl === url
              ? 'unchanged'
              : existing?.value?.trim()
                ? 'preserve-existing'
                : 'create';
        return {
            entityId: category.id,
            name,
            valueId: existing?.id,
            url,
            action,
        };
    });

    // Never write URLs before the PR's static assets have reached production.
    if (apply && !definitionOnly) {
        for (const item of planned.filter((item) => item.action === 'create')) {
            if (!item.url) continue;
            const response = await fetch(item.url, {
                method: 'HEAD',
                signal: AbortSignal.timeout(15000),
            });
            if (
                !response.ok ||
                !response.headers.get('content-type')?.startsWith('image/')
            ) {
                throw new Error(
                    `Publish the FAQ artwork before assigning ${item.url}.`,
                );
            }
        }
    }

    const definitionId =
        existingDefinition?.id ??
        (apply ? await createAttributeDefinition(definitionConfig) : null);
    if (apply && !definitionOnly && definitionId) {
        for (const item of planned.filter((item) => item.action === 'create')) {
            if (!item.url) continue;
            await upsertAttributeValue(
                {
                    id: item.valueId,
                    entityId: item.entityId,
                    entityTypeName,
                    attributeDefinitionId: definitionId,
                    value: imageAttributeValueFromUrl(item.url),
                },
                { id: 'codex', name: 'Codex' },
            );
        }
        const persisted = await getEntitiesRaw(entityTypeName, 'published');
        for (const item of planned.filter((item) => item.action === 'create')) {
            const value = persisted
                .find((category) => category.id === item.entityId)
                ?.attributes.find(
                    (attribute) =>
                        attribute.attributeDefinitionId === definitionId,
                )?.value;
            if (imageUrlFromAttributeValue(value) !== item.url) {
                throw new Error(`Failed to verify category ${item.entityId}.`);
            }
        }
    }
    console.log(
        JSON.stringify(
            {
                mode: apply ? 'apply' : 'dry-run',
                definitionOnly,
                definitionId,
                definitionAction: existingDefinition ? 'unchanged' : 'create',
                artworkCount: faqCategoryArtwork.length,
                categories: planned,
            },
            null,
            2,
        ),
    );
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(closeStorage);
