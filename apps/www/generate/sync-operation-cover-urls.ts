import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
    attributeValues,
    closeStorage,
    createAttributeValueMutationSideEffects,
    entities,
    flushAttributeValueMutationSideEffects,
    getEntityRaw,
    sql,
    storage,
    upsertAttributeValue,
} from '@gredice/storage';
import { readOperationCoverIllustrations } from './read-operation-cover-illustrations';

const actor = { id: 'codex', name: 'Codex' };
const entityTypeName = 'operation';
const publicBaseUrl =
    'https://www.gredice.com/assets/operation-icons/illustrated/';
const publicAssetPath = 'apps/www/public/assets/operation-icons/illustrated/';

class OperationCoverSyncError extends Error {}

function readTarget(
    operation: string,
    manifest: Awaited<ReturnType<typeof readOperationCoverIllustrations>>,
) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/u.test(operation)) {
        throw new OperationCoverSyncError(
            `Invalid operation name: ${operation}.`,
        );
    }

    const entry = manifest.get(operation);
    const fileName = `${operation}.webp`;
    const assetPath = `${publicAssetPath}${fileName}`;
    if (!entry || entry.asset !== assetPath) {
        throw new OperationCoverSyncError(
            `Missing or invalid illustration manifest entry for ${operation}.`,
        );
    }

    return {
        operation,
        entityId: entry.entityId,
        assetPath,
        previousUrl: entry.previousUrl,
        url: new URL(fileName, publicBaseUrl).href,
    };
}

type Target = ReturnType<typeof readTarget>;
type Database = ReturnType<typeof storage>;

function sha256(data: Uint8Array) {
    return createHash('sha256').update(data).digest('hex');
}

async function verifyAsset(target: Target, verifyDeployment: boolean) {
    const fileUrl = new URL(`../../../${target.assetPath}`, import.meta.url);
    const bytes = await readFile(fileUrl).catch(() => {
        throw new OperationCoverSyncError(
            `Missing illustration for ${target.operation}: ${target.assetPath}.`,
        );
    });
    if (
        bytes.toString('ascii', 0, 4) !== 'RIFF' ||
        bytes.toString('ascii', 8, 12) !== 'WEBP'
    ) {
        throw new OperationCoverSyncError(
            `The local illustration for ${target.operation} is not WebP.`,
        );
    }

    const checksum = sha256(bytes);
    if (verifyDeployment) {
        const response = await fetch(target.url, {
            cache: 'no-store',
            redirect: 'error',
            signal: AbortSignal.timeout(15_000),
        }).catch(() => {
            throw new OperationCoverSyncError(
                `Could not fetch the deployed illustration for ${target.operation}.`,
            );
        });
        if (
            !response.ok ||
            response.headers.get('content-type')?.split(';')[0] !== 'image/webp'
        ) {
            throw new OperationCoverSyncError(
                `Illustration for ${target.operation} isn't available as WebP at ${target.url} (HTTP ${response.status}).`,
            );
        }

        const deployedBytes = new Uint8Array(
            await response.arrayBuffer().catch(() => {
                throw new OperationCoverSyncError(
                    `Could not read the deployed illustration for ${target.operation}.`,
                );
            }),
        );
        if (sha256(deployedBytes) !== checksum) {
            throw new OperationCoverSyncError(
                `Deployed illustration for ${target.operation} differs from ${target.assetPath}.`,
            );
        }
    }

    return { ...target, checksum };
}

function parseCover(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    let cover: unknown;
    try {
        cover = JSON.parse(value);
    } catch {
        cover = value;
    }

    if (typeof cover === 'string' && /^https?:\/\//u.test(cover)) {
        return { url: cover };
    }

    if (
        cover &&
        typeof cover === 'object' &&
        !Array.isArray(cover) &&
        'url' in cover &&
        typeof cover.url === 'string'
    ) {
        return { ...cover, url: cover.url };
    }

    return undefined;
}

async function readAssignment(
    db: Database,
    target: Awaited<ReturnType<typeof verifyAsset>>,
    lock: boolean,
) {
    if (lock) {
        // Lock the entity against state changes and new attribute inserts.
        await db.execute(sql`
            select ${entities.id} from ${entities}
            where ${entities.id} = ${target.entityId}
            for update
        `);
        await db.execute(sql`
            select ${attributeValues.id} from ${attributeValues}
            where ${attributeValues.entityId} = ${target.entityId}
              and not ${attributeValues.isDeleted}
            order by ${attributeValues.id}
            for update
        `);
    }

    const entity = await getEntityRaw(target.entityId, db);
    if (
        entity?.state !== 'published' ||
        entity.entityTypeName !== entityTypeName
    ) {
        throw new OperationCoverSyncError(
            `Expected published operation ${target.operation} at entity ${target.entityId}.`,
        );
    }

    const nameValues = entity.attributes.filter(
        ({ attributeDefinition, id }) =>
            id > 0 &&
            attributeDefinition.category === 'information' &&
            attributeDefinition.name === 'name',
    );
    if (nameValues.length !== 1 || nameValues[0]?.value !== target.operation) {
        throw new OperationCoverSyncError(
            `Operation name at entity ${entity.id} does not match ${target.operation}.`,
        );
    }

    const definitions = entity.entityType.attributeDefinitions.filter(
        (definition) =>
            definition.category === 'image' && definition.name === 'cover',
    );
    const definition = definitions[0];
    if (
        definitions.length !== 1 ||
        !definition ||
        definition.multiple ||
        (definition.dataType !== 'image' &&
            !definition.dataType.startsWith('json'))
    ) {
        throw new OperationCoverSyncError(
            'Expected one compatible operation image.cover definition.',
        );
    }

    const coverValues = entity.attributes.filter(
        ({ attributeDefinitionId }) => attributeDefinitionId === definition.id,
    );
    const coverAttribute = coverValues[0];
    const cover = parseCover(coverAttribute?.value);
    if (coverValues.length > 1 || cover === undefined) {
        throw new OperationCoverSyncError(
            `Operation ${target.operation} has an ambiguous or invalid image.cover value.`,
        );
    }

    const currentUrl = cover?.url ?? null;
    if (currentUrl !== target.url && currentUrl !== target.previousUrl) {
        throw new OperationCoverSyncError(
            `Cover URL for ${target.operation} changed since the manifest was recorded. Expected ${target.previousUrl ?? '(none)'} and found ${currentUrl ?? '(none)'}.`,
        );
    }

    const label = entity.attributes.find(
        ({ attributeDefinition }) =>
            attributeDefinition.category === 'information' &&
            attributeDefinition.name === 'label',
    )?.value;
    const attributeValue = {
        id: coverAttribute?.id || undefined,
        attributeDefinitionId: definition.id,
        entityId: entity.id,
        entityTypeName,
        order: coverAttribute ? coverAttribute.order : definition.order,
        value: JSON.stringify({
            ...(cover ?? { alt: label || target.operation }),
            url: target.url,
        }),
    };

    return {
        attributeValue,
        result: {
            operation: target.operation,
            entityId: entity.id,
            previousUrl: currentUrl,
            url: target.url,
            checksum: target.checksum,
            action: currentUrl === target.url ? 'unchanged' : 'assign',
        },
    };
}

async function main() {
    const { values } = parseArgs({
        options: {
            apply: { type: 'boolean', default: false },
            operation: { type: 'string', multiple: true },
        },
    });
    const operations = values.operation ?? [];
    if (
        operations.length === 0 ||
        new Set(operations).size !== operations.length
    ) {
        throw new OperationCoverSyncError(
            'Supply one or more unique --operation NAME options.',
        );
    }

    const manifest = await readOperationCoverIllustrations();
    const targets = operations
        .map((operation) => readTarget(operation, manifest))
        .sort((left, right) => left.entityId - right.entityId);
    const verified = await Promise.all(
        targets.map((target) => verifyAsset(target, values.apply)),
    );
    const sideEffects = createAttributeValueMutationSideEffects();
    const results = await storage().transaction(
        async (db) => {
            const assignments = [];
            for (const target of verified) {
                assignments.push(
                    await readAssignment(db, target, values.apply),
                );
            }

            if (values.apply) {
                for (const { attributeValue, result } of assignments) {
                    if (result.action === 'assign') {
                        await upsertAttributeValue(attributeValue, actor, {
                            db,
                            sideEffects,
                        });
                    } else {
                        // Retry cache and search invalidation if a prior run only committed the assignments.
                        sideEffects.entityIds.add(result.entityId);
                        sideEffects.entityTypeNames.add(entityTypeName);
                        sideEffects.searchEntityIds.add(result.entityId);
                    }
                }
            }

            return assignments.map(({ result }) => result);
        },
        values.apply ? undefined : { accessMode: 'read only' },
    );

    console.log(
        JSON.stringify(
            {
                mode: values.apply ? 'apply' : 'dry-run',
                deploymentVerified: values.apply,
                assignments: results,
            },
            null,
            2,
        ),
    );

    if (values.apply) {
        await flushAttributeValueMutationSideEffects(sideEffects);
    }
}

main()
    .catch((error: unknown) => {
        console.error(
            error instanceof OperationCoverSyncError
                ? error.message
                : `Operation cover sync failed (${error instanceof Error ? error.name : 'unknown error'}).`,
        );
        process.exitCode = 1;
    })
    .finally(closeStorage);
