import { createRequire } from 'node:module';
import { Redis } from '@upstash/redis';

type QueryResult<Row> = {
    rows: Row[];
    rowCount: number | null;
};

type PgClient = {
    connect: () => Promise<void>;
    end: () => Promise<void>;
    query: <Row = Record<string, unknown>>(
        query: string,
        values?: readonly unknown[],
    ) => Promise<QueryResult<Row>>;
};

type PgClientConstructor = new (config: {
    connectionString: string;
}) => PgClient;

type Args = {
    execute: boolean;
    sourceEntityTypes: string[];
    definitionIds: number[];
    failOnDraftTargets: boolean;
    requireCacheBust: boolean;
    summaryOnly: boolean;
};

type RefDefinitionRow = {
    id: number;
    entity_type_name: string;
    category: string;
    name: string;
    label: string;
    data_type: string;
    multiple: boolean;
};

type RefValueRow = {
    id: number;
    attribute_definition_id: number;
    source_entity_type: string;
    source_entity_id: number;
    value: string;
    definition_entity_type: string;
    category: string;
    name: string;
    label: string;
    data_type: string;
    multiple: boolean;
};

type TargetEntityRow = {
    id: number;
    entity_type_name: string;
    state: string;
    name: string | null;
};

type TargetLookup = {
    byId: Map<number, TargetEntityRow>;
    byName: Map<string, TargetEntityRow[]>;
};

type ChangeItem = {
    from: string;
    to: string;
    targetEntityId: number;
    targetState: string;
    source: 'id' | 'name';
};

type MigrationChange = {
    attributeValueId: number;
    attributeDefinitionId: number;
    sourceEntityType: string;
    sourceEntityId: number;
    definition: string;
    targetEntityType: string;
    multiple: boolean;
    from: string;
    to: string;
    items: ChangeItem[];
};

type MigrationIssue = {
    attributeValueId?: number;
    attributeDefinitionId?: number;
    sourceEntityType?: string;
    sourceEntityId?: number;
    definition?: string;
    targetEntityType: string;
    value?: string;
    itemIndex?: number;
    reason: string;
    matches?: { id: number; state: string; name: string | null }[];
};

type MigrationPlan = {
    definitions: RefDefinitionRow[];
    values: RefValueRow[];
    changes: MigrationChange[];
    blockers: MigrationIssue[];
    warnings: MigrationIssue[];
    duplicateTargetNames: MigrationIssue[];
    stats: {
        targetEntityTypes: number;
        definitionsScanned: number;
        valuesScanned: number;
        alreadyIdItems: number;
        convertedNameItems: number;
        canonicalizedIdItems: number;
        blockedItems: number;
        updatesPlanned: number;
    };
};

type CacheBustResult =
    | { skipped: true; reason: string }
    | { skipped: false; keys: string[] };

const require = createRequire(import.meta.url);
const { Client } = require('pg') as { Client: PgClientConstructor };

function parseCsv(value: string) {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseArgs(): Args {
    const args = process.argv.slice(2);
    if (args.includes('--help')) {
        console.log(`Usage:
    pnpm --dir packages/storage migrate:entity-refs-to-ids
    pnpm --dir packages/storage migrate:entity-refs-to-ids -- --execute

Options:
    --execute                      Apply updates. Omit for dry-run audit.
    --source-entity-types=a,b      Limit refs owned by these entity types.
    --definition-ids=1,2           Limit specific attribute definition IDs.
    --fail-on-draft-targets        Treat refs to draft target entities as blockers.
    --require-cache-bust           Fail execute if Upstash directory cache cannot be cleared.
    --summary-only                 Print counts and samples, without the full planned change list.
`);
        process.exit(0);
    }

    const sourceEntityTypesArg = args.find((arg) =>
        arg.startsWith('--source-entity-types='),
    );
    const definitionIdsArg = args.find((arg) =>
        arg.startsWith('--definition-ids='),
    );

    return {
        execute: args.includes('--execute'),
        sourceEntityTypes: sourceEntityTypesArg
            ? parseCsv(
                sourceEntityTypesArg.slice('--source-entity-types='.length),
            )
            : [],
        definitionIds: definitionIdsArg
            ? parseCsv(definitionIdsArg.slice('--definition-ids='.length))
                .map((value) => Number.parseInt(value, 10))
                .filter((value) => Number.isInteger(value))
            : [],
        failOnDraftTargets: args.includes('--fail-on-draft-targets'),
        requireCacheBust: args.includes('--require-cache-bust'),
        summaryOnly: args.includes('--summary-only'),
    };
}

function refTargetEntityType(dataType: string) {
    return dataType.slice('ref:'.length);
}

function definitionName(row: Pick<RefValueRow, 'category' | 'name'>) {
    return `${row.category}.${row.name}`;
}

function parseEntityIdLiteral(value: unknown) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
        return value;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmedValue = value.trim();
    if (!/^\d+$/.test(trimmedValue)) {
        return null;
    }

    const parsedValue = Number.parseInt(trimmedValue, 10);
    return Number.isSafeInteger(parsedValue) && parsedValue > 0
        ? parsedValue
        : null;
}

function parseRefItems(value: string, multiple: boolean) {
    if (!multiple) {
        return { items: [value], isJsonArray: false };
    }

    try {
        const parsedValue: unknown = JSON.parse(value);
        if (Array.isArray(parsedValue)) {
            return { items: parsedValue, isJsonArray: true };
        }
    } catch {
        return { items: [value], isJsonArray: false };
    }

    return { items: [value], isJsonArray: false };
}

function summarizeTarget(entity: TargetEntityRow) {
    return {
        id: entity.id,
        state: entity.state,
        name: entity.name,
    };
}

async function getRefDefinitions(client: PgClient, args: Args) {
    const result = await client.query<RefDefinitionRow>(`
        select
            id,
            entity_type as entity_type_name,
            category,
            name,
            label,
            data_type,
            multiple
        from attribute_definitions
        where is_deleted = false
          and data_type like 'ref:%'
        order by entity_type asc, category asc, name asc, id asc
    `);

    return result.rows.filter((definition) => {
        if (
            args.sourceEntityTypes.length > 0 &&
            !args.sourceEntityTypes.includes(definition.entity_type_name)
        ) {
            return false;
        }

        if (
            args.definitionIds.length > 0 &&
            !args.definitionIds.includes(definition.id)
        ) {
            return false;
        }

        return true;
    });
}

async function getRefValues(client: PgClient, args: Args) {
    const result = await client.query<RefValueRow>(`
        select
            av.id,
            av.attribute_definition_id,
            av.entity_type as source_entity_type,
            av.entity_id as source_entity_id,
            av.value,
            ad.entity_type as definition_entity_type,
            ad.category,
            ad.name,
            ad.label,
            ad.data_type,
            ad.multiple
                from attribute_values av
                join entities e
                    on e.id = av.entity_id
                 and e.entity_type = av.entity_type
                join attribute_definitions ad
                    on ad.id = av.attribute_definition_id
                where av.is_deleted = false
                    and e.is_deleted = false
                    and ad.is_deleted = false
                    and ad.data_type like 'ref:%'
                    and av.value is not null
                    and btrim(av.value) <> ''
        order by ad.entity_type asc, ad.category asc, ad.name asc, av.entity_id asc, av.id asc
    `);

    return result.rows.filter((value) => {
        if (
            args.sourceEntityTypes.length > 0 &&
            !args.sourceEntityTypes.includes(value.definition_entity_type)
        ) {
            return false;
        }

        if (
            args.definitionIds.length > 0 &&
            !args.definitionIds.includes(value.attribute_definition_id)
        ) {
            return false;
        }

        return true;
    });
}

async function getTargetEntities(client: PgClient, targetEntityType: string) {
    const result = await client.query<TargetEntityRow>(
        `
            select
                e.id,
                e.entity_type as entity_type_name,
                e.state,
                name_value.value as name
            from entities e
            left join lateral (
                select av.value
                from attribute_values av
                join attribute_definitions ad
                  on ad.id = av.attribute_definition_id
                where av.entity_id = e.id
                  and av.entity_type = e.entity_type
                  and av.is_deleted = false
                  and ad.is_deleted = false
                  and ad.category = 'information'
                  and ad.name = 'name'
                order by av.id asc
                limit 1
            ) name_value on true
            where e.entity_type = $1
              and e.is_deleted = false
            order by e.id asc
        `,
        [targetEntityType],
    );

    return result.rows;
}

async function buildTargetLookups(
    client: PgClient,
    targetEntityTypes: string[],
) {
    const lookups = new Map<string, TargetLookup>();
    const duplicateTargetNames: MigrationIssue[] = [];

    for (const targetEntityType of targetEntityTypes) {
        const targetEntities = await getTargetEntities(
            client,
            targetEntityType,
        );
        const byId = new Map(
            targetEntities.map((entity) => [entity.id, entity]),
        );
        const byName = new Map<string, TargetEntityRow[]>();

        for (const entity of targetEntities) {
            if (!entity.name) {
                continue;
            }

            byName.set(entity.name, [
                ...(byName.get(entity.name) ?? []),
                entity,
            ]);
        }

        for (const [name, matches] of byName.entries()) {
            if (matches.length <= 1) {
                continue;
            }

            duplicateTargetNames.push({
                targetEntityType,
                value: name,
                reason: 'Duplicate target entity name; legacy name refs to this value are ambiguous.',
                matches: matches.map(summarizeTarget),
            });
        }

        lookups.set(targetEntityType, { byId, byName });
    }

    return { lookups, duplicateTargetNames };
}

function normalizeRefItem(
    row: RefValueRow,
    targetEntityType: string,
    lookup: TargetLookup,
    item: unknown,
    itemIndex: number,
    args: Args,
) {
    const baseIssue = {
        attributeValueId: row.id,
        attributeDefinitionId: row.attribute_definition_id,
        sourceEntityType: row.source_entity_type,
        sourceEntityId: row.source_entity_id,
        definition: definitionName(row),
        targetEntityType,
        itemIndex,
    };

    const parsedId = parseEntityIdLiteral(item);
    if (typeof parsedId === 'number') {
        const targetEntity = lookup.byId.get(parsedId);
        if (!targetEntity) {
            return {
                blocker: {
                    ...baseIssue,
                    value: String(item),
                    reason: 'ID value does not point to a non-deleted target entity of the expected type.',
                } satisfies MigrationIssue,
            };
        }

        const warning =
            targetEntity.state !== 'published'
                ? ({
                    ...baseIssue,
                    value: String(item),
                    reason: `Target entity is ${targetEntity.state}; formatted directory data only expands published refs.`,
                    matches: [summarizeTarget(targetEntity)],
                } satisfies MigrationIssue)
                : undefined;

        return {
            item: {
                from: String(item),
                to: String(parsedId),
                targetEntityId: parsedId,
                targetState: targetEntity.state,
                source: 'id',
            } satisfies ChangeItem,
            warning,
            blocker: args.failOnDraftTargets && warning ? warning : undefined,
        };
    }

    if (typeof item !== 'string') {
        return {
            blocker: {
                ...baseIssue,
                value: JSON.stringify(item),
                reason: 'Unsupported ref item value; expected entity ID string or legacy entity name string.',
            } satisfies MigrationIssue,
        };
    }

    const matches = lookup.byName.get(item) ?? [];
    if (matches.length === 0) {
        return {
            blocker: {
                ...baseIssue,
                value: item,
                reason: 'Legacy name value does not match any non-deleted target entity information.name.',
            } satisfies MigrationIssue,
        };
    }

    if (matches.length > 1) {
        return {
            blocker: {
                ...baseIssue,
                value: item,
                reason: 'Legacy name value matches multiple target entities.',
                matches: matches.map(summarizeTarget),
            } satisfies MigrationIssue,
        };
    }

    const targetEntity = matches[0];
    const warning =
        targetEntity.state !== 'published'
            ? ({
                ...baseIssue,
                value: item,
                reason: `Target entity is ${targetEntity.state}; formatted directory data only expands published refs.`,
                matches: [summarizeTarget(targetEntity)],
            } satisfies MigrationIssue)
            : undefined;

    return {
        item: {
            from: item,
            to: String(targetEntity.id),
            targetEntityId: targetEntity.id,
            targetState: targetEntity.state,
            source: 'name',
        } satisfies ChangeItem,
        warning,
        blocker: args.failOnDraftTargets && warning ? warning : undefined,
    };
}

function buildChangeForValue(
    row: RefValueRow,
    lookup: TargetLookup,
    args: Args,
) {
    const targetEntityType = refTargetEntityType(row.data_type);
    const parsedValue = parseRefItems(row.value, row.multiple);
    const items: ChangeItem[] = [];
    const blockers: MigrationIssue[] = [];
    const warnings: MigrationIssue[] = [];

    parsedValue.items.forEach((item, index) => {
        const normalized = normalizeRefItem(
            row,
            targetEntityType,
            lookup,
            item,
            index,
            args,
        );

        if (normalized.blocker) {
            blockers.push(normalized.blocker);
        }
        if (normalized.warning) {
            warnings.push(normalized.warning);
        }
        if (normalized.item) {
            items.push(normalized.item);
        }
    });

    if (blockers.length > 0) {
        return { blockers, warnings };
    }

    const nextValue = parsedValue.isJsonArray
        ? JSON.stringify(items.map((item) => item.to))
        : items[0]?.to;

    if (!nextValue || nextValue === row.value) {
        return { blockers, warnings, items };
    }

    return {
        blockers,
        warnings,
        change: {
            attributeValueId: row.id,
            attributeDefinitionId: row.attribute_definition_id,
            sourceEntityType: row.source_entity_type,
            sourceEntityId: row.source_entity_id,
            definition: definitionName(row),
            targetEntityType,
            multiple: row.multiple,
            from: row.value,
            to: nextValue,
            items,
        } satisfies MigrationChange,
        items,
    };
}

async function buildMigrationPlan(
    client: PgClient,
    args: Args,
): Promise<MigrationPlan> {
    const definitions = await getRefDefinitions(client, args);
    const targetEntityTypes = Array.from(
        new Set(
            definitions.map((definition) =>
                refTargetEntityType(definition.data_type),
            ),
        ),
    ).sort((left, right) => left.localeCompare(right));
    const [{ lookups, duplicateTargetNames }, values] = await Promise.all([
        buildTargetLookups(client, targetEntityTypes),
        getRefValues(client, args),
    ]);
    const changes: MigrationChange[] = [];
    const blockers: MigrationIssue[] = [];
    const warnings: MigrationIssue[] = [];
    let alreadyIdItems = 0;
    let convertedNameItems = 0;
    let canonicalizedIdItems = 0;
    let blockedItems = 0;

    for (const row of values) {
        const targetEntityType = refTargetEntityType(row.data_type);
        const lookup = lookups.get(targetEntityType);
        if (!lookup) {
            blockers.push({
                attributeValueId: row.id,
                attributeDefinitionId: row.attribute_definition_id,
                sourceEntityType: row.source_entity_type,
                sourceEntityId: row.source_entity_id,
                definition: definitionName(row),
                targetEntityType,
                value: row.value,
                reason: 'No target entity lookup was available for this ref type.',
            });
            continue;
        }

        const result = buildChangeForValue(row, lookup, args);
        blockers.push(...result.blockers);
        warnings.push(...result.warnings);

        for (const item of result.items ?? []) {
            if (item.source === 'name') {
                convertedNameItems += 1;
            } else if (item.from !== item.to) {
                canonicalizedIdItems += 1;
            } else {
                alreadyIdItems += 1;
            }
        }

        blockedItems += result.blockers.length;

        if (result.change) {
            changes.push(result.change);
        }
    }

    return {
        definitions,
        values,
        changes,
        blockers,
        warnings,
        duplicateTargetNames,
        stats: {
            targetEntityTypes: targetEntityTypes.length,
            definitionsScanned: definitions.length,
            valuesScanned: values.length,
            alreadyIdItems,
            convertedNameItems,
            canonicalizedIdItems,
            blockedItems,
            updatesPlanned: changes.length,
        },
    };
}

async function applyChanges(client: PgClient, changes: MigrationChange[]) {
    if (changes.length === 0) {
        return;
    }

    await client.query(
        `select pg_advisory_xact_lock(hashtext('migrate-directory-ref-values-to-ids'))`,
    );

    for (const change of changes) {
        await client.query(
            `
                update attribute_values
                set value = $1,
                    updated_at = now()
                where id = $2
                  and value is distinct from $1
            `,
            [change.to, change.attributeValueId],
        );
    }
}

async function bustDirectoryCaches(
    changes: MigrationChange[],
): Promise<CacheBustResult> {
    const url = process.env.PLANTS_SILO_KV_REST_API_URL;
    const token = process.env.PLANTS_SILO_KV_REST_API_TOKEN;
    if (!url || !token) {
        return {
            skipped: true,
            reason: 'PLANTS_SILO_KV_REST_API_URL or PLANTS_SILO_KV_REST_API_TOKEN is not set.',
        };
    }

    const keys = new Set<string>();
    for (const change of changes) {
        keys.add(`entityTypeName:${change.sourceEntityType}`);
        keys.add(`entity:${change.sourceEntityId}`);
    }

    if (keys.size === 0) {
        return { skipped: false, keys: [] };
    }

    const redis = new Redis({ url, token });
    const cacheKeys = Array.from(keys).sort((left, right) =>
        left.localeCompare(right),
    );
    await Promise.all(cacheKeys.map((key) => redis.del(key)));
    return { skipped: false, keys: cacheKeys };
}

function printReport(
    args: Args,
    plan: MigrationPlan,
    cacheBust?: CacheBustResult,
) {
    const fullReport = {
        mode: args.execute ? 'execute' : 'dry-run',
        filters: {
            sourceEntityTypes: args.sourceEntityTypes,
            definitionIds: args.definitionIds,
            failOnDraftTargets: args.failOnDraftTargets,
            requireCacheBust: args.requireCacheBust,
            summaryOnly: args.summaryOnly,
        },
        stats: plan.stats,
        duplicateTargetNames: plan.duplicateTargetNames,
        blockers: plan.blockers,
        warnings: plan.warnings,
        changes: plan.changes,
        cacheBust,
    };

    const summaryReport = {
        mode: fullReport.mode,
        filters: fullReport.filters,
        stats: fullReport.stats,
        counts: {
            duplicateTargetNames: plan.duplicateTargetNames.length,
            blockers: plan.blockers.length,
            warnings: plan.warnings.length,
            changes: plan.changes.length,
        },
        samples: {
            duplicateTargetNames: plan.duplicateTargetNames.slice(0, 10),
            blockers: plan.blockers.slice(0, 10),
            warnings: plan.warnings.slice(0, 10),
            changes: plan.changes.slice(0, 10),
        },
        cacheBust,
    };

    console.log(
        JSON.stringify(args.summaryOnly ? summaryReport : fullReport, null, 2),
    );
}

const args = parseArgs();

if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable is not set.');
}

const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

try {
    const plan = await buildMigrationPlan(client, args);

    if (plan.blockers.length > 0) {
        printReport(args, plan);
        process.exitCode = 1;
    } else if (!args.execute) {
        printReport(args, plan);
    } else {
        await client.query('begin');
        try {
            await applyChanges(client, plan.changes);
            await client.query('commit');
        } catch (error) {
            await client.query('rollback');
            throw error;
        }

        const cacheBust = await bustDirectoryCaches(plan.changes);
        if (cacheBust.skipped && args.requireCacheBust) {
            printReport(args, plan, cacheBust);
            throw new Error(cacheBust.reason);
        }

        printReport(args, plan, cacheBust);
    }
} finally {
    await client.end();
}
