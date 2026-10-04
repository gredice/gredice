import { createHash } from 'node:crypto';
import type { FaqData } from '@gredice/directory-types';
import { bustCached, cacheKeys } from '../src/cache/directoriesCached';
import { publicFaqCategories, publicFaqEntries } from '../src/data/publicFaq';
import {
    closeStorage,
    createEntity,
    getAttributeDefinitions,
    getEntitiesFormatted,
    getEntitiesRaw,
    updateEntity,
    upsertAttributeValue,
} from '../src/index';

class FaqSyncError extends Error {}

const actor = { id: 'codex-public-faq', name: 'Public FAQ content update' };
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const expected = args.find((arg) => arg.startsWith('--expect='))?.slice(9);
for (const arg of args) {
    if (arg !== '--apply' && !arg.startsWith('--expect=')) {
        throw new FaqSyncError(`Unknown argument: ${arg}`);
    }
}

type RawEntity = Awaited<ReturnType<typeof getEntitiesRaw>>[number];
function values(entity: RawEntity | undefined) {
    return Object.fromEntries(
        (entity?.attributes ?? []).map((attribute) => [
            `${attribute.attributeDefinition.category}.${attribute.attributeDefinition.name}`,
            attribute.value,
        ]),
    );
}
function matchesValues(
    row: RawEntity | undefined,
    desired: Record<string, string>,
) {
    return Object.entries(desired).every(([path, value]) => {
        const attributes =
            row?.attributes.filter(
                (attribute) =>
                    `${attribute.attributeDefinition.category}.${attribute.attributeDefinition.name}` ===
                    path,
            ) ?? [];
        return (
            attributes.length > 0 &&
            attributes.every((attribute) => attribute.value === value)
        );
    });
}
function matching(rows: RawEntity[], name: string) {
    const matches = rows.filter(
        (row) => values(row)['information.name'] === name,
    );
    if (matches.length > 1)
        throw new FaqSyncError(`Duplicate directory name: ${name}`);
    return matches[0];
}

async function main() {
    if (
        apply &&
        (!process.env.PLANTS_SILO_KV_REST_API_URL ||
            !process.env.PLANTS_SILO_KV_REST_API_TOKEN)
    )
        throw new FaqSyncError(
            'Apply requires WWW directory cache credentials; use the WWW environment.',
        );
    const categoryRows = await getEntitiesRaw('faq-category');
    const faqRows = await getEntitiesRaw('faq');
    const definitions = {
        'faq-category': await getAttributeDefinitions('faq-category'),
        faq: await getAttributeDefinitions('faq'),
    };
    const targets = [
        ...publicFaqCategories.map((category) => ({
            type: 'faq-category' as const,
            name: category.name,
            row: matching(categoryRows, category.name),
            desired: {
                'information.name': category.name,
                'information.label': category.label,
            },
        })),
        ...publicFaqEntries.map((entry) => ({
            type: 'faq' as const,
            name: entry.name,
            row: matching(faqRows, entry.name),
            desired: {
                'information.name': entry.name,
                'information.header': entry.header,
                'information.content': entry.content,
                'attributes.category': String(
                    matching(categoryRows, entry.category)?.id ??
                        `new:${entry.category}`,
                ),
            },
        })),
    ];
    for (const target of targets) {
        for (const path of Object.keys(target.desired)) {
            const found = definitions[target.type].filter(
                (d) => `${d.category}.${d.name}` === path,
            );
            if (found.length !== 1 || found[0].multiple)
                throw new FaqSyncError(
                    `Unexpected definition: ${target.type}.${path}`,
                );
        }
    }
    const snapshot = targets.map(({ type, name, row, desired }) => ({
        type,
        name,
        id: row?.id,
        state: row?.state,
        current:
            row?.attributes
                .filter((attribute) =>
                    Object.hasOwn(
                        desired,
                        `${attribute.attributeDefinition.category}.${attribute.attributeDefinition.name}`,
                    ),
                )
                .map((attribute) => ({
                    id: attribute.id,
                    definition: attribute.attributeDefinitionId,
                    value: attribute.value,
                }))
                .sort((a, b) => a.id - b.id) ?? [],
        desired,
    }));
    const hash = createHash('sha256')
        .update(JSON.stringify(snapshot))
        .digest('hex');
    const changes = targets.filter(
        ({ row, desired }) =>
            row?.state !== 'published' || !matchesValues(row, desired),
    );
    console.log(
        JSON.stringify(
            {
                mode: apply ? 'apply' : 'dry-run',
                hash,
                categories: publicFaqCategories.length,
                questions: publicFaqEntries.length,
                changes: changes.map((target) => ({
                    type: target.type,
                    name: target.name,
                    id: target.row?.id,
                    action: target.row ? 'update' : 'create',
                })),
            },
            null,
            2,
        ),
    );
    if (!apply) return;
    if (!expected || hash !== expected)
        throw new FaqSyncError(
            'Dry-run hash differs. Review a fresh dry run and pass --expect=<hash>.',
        );
    const categoryIds = new Map(
        categoryRows.map((row) => [values(row)['information.name'], row.id]),
    );
    for (const target of targets) {
        const desired: Record<string, string> = { ...target.desired };
        if (target.type === 'faq') {
            const entry = publicFaqEntries.find(
                (entry) => entry.name === target.name,
            );
            const categoryId = entry && categoryIds.get(entry.category);
            if (!categoryId)
                throw new FaqSyncError(`Missing category for ${target.name}`);
            desired['attributes.category'] = String(categoryId);
        }
        const entityId =
            target.row?.id ?? (await createEntity(target.type, actor));
        for (const [path, value] of Object.entries(desired)) {
            const definition = definitions[target.type].find(
                (d) => `${d.category}.${d.name}` === path,
            );
            if (!definition)
                throw new FaqSyncError(`Missing definition ${path}`);
            const existing =
                target.row?.attributes.filter(
                    (a) => a.attributeDefinitionId === definition.id,
                ) ?? [];
            // Legacy singleton attributes can have duplicate active values. Update
            // each through the repository so no stale answer or history is lost.
            for (const current of existing.length ? existing : [undefined]) {
                if (current?.value === value) continue;
                await upsertAttributeValue(
                    {
                        id: current?.id,
                        entityId,
                        entityTypeName: target.type,
                        attributeDefinitionId: definition.id,
                        value,
                    },
                    actor,
                );
            }
        }
        if (target.row?.state !== 'published')
            await updateEntity({ id: entityId, state: 'published' }, actor);
        if (target.type === 'faq-category')
            categoryIds.set(target.name, entityId);
    }
    for (const type of ['faq-category', 'faq']) {
        const persisted = await getEntitiesRaw(type);
        for (const target of targets.filter((target) => target.type === type)) {
            const row = matching(persisted, target.name);
            const desired: Record<string, string> = { ...target.desired };
            if (type === 'faq') {
                const entry = publicFaqEntries.find(
                    (entry) => entry.name === target.name,
                );
                desired['attributes.category'] = String(
                    entry && categoryIds.get(entry.category),
                );
            }
            if (row?.state !== 'published' || !matchesValues(row, desired))
                throw new FaqSyncError(`Readback failed: ${target.name}`);
        }
    }
    await bustCached(cacheKeys.entityTypeName('faq'));
    await bustCached(cacheKeys.entityTypeName('faq-category'));
    const publicEntries = await getEntitiesFormatted<FaqData>('faq');
    for (const expectedEntry of publicFaqEntries) {
        const actual = publicEntries.find(
            (entry) => entry.information.name === expectedEntry.name,
        );
        if (
            actual?.information.content !== expectedEntry.content ||
            actual.attributes.category.information.name !==
                expectedEntry.category
        )
            throw new FaqSyncError(
                `Formatted readback failed: ${expectedEntry.name}`,
            );
    }
    console.log(
        JSON.stringify({
            verified: true,
            categories: publicFaqCategories.length,
            questions: publicFaqEntries.length,
        }),
    );
}
main()
    .catch((error: unknown) => {
        console.error(
            error instanceof FaqSyncError
                ? error.message
                : 'FAQ update failed; inspect storage diagnostics.',
        );
        process.exitCode = 1;
    })
    .finally(closeStorage);
