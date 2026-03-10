import { Client } from 'pg';

const RAISED_BED_FIELDS_PER_BLOCK = 9;
const MERGE_WINDOW_MS = 1500;
const MERGE_POST_WINDOW_MS = 250;
const FIELD_EVENT_TYPES = [
    'raisedBedField.create',
    'raisedBedField.delete',
    'raisedBedField.plantPlace',
    'raisedBedField.plantSchedule',
    'raisedBedField.plantUpdate',
    'raisedBedField.plantReplaceSort',
] as const;

type MergeSource = {
    id: number;
    updatedAt: Date;
};

type MovedFieldRow = {
    id: number;
    raisedBedId: number;
    positionIndex: number;
    updatedAt: Date;
};

type MovedCartItemRow = {
    id: number;
    raisedBedId: number;
    positionIndex: number;
    entityTypeName: string;
    entityId: string;
    isDeleted: boolean;
};

type RepairPlan = {
    sourceBedId: number;
    targetBedId: number;
    mergedAt: string;
    fieldCount: number;
    cartItemCount: number;
    cartItemShift: number;
    currentFieldStart: number | null;
    expectedFieldStart: number;
    fieldDelta: number;
    fieldPositions: number[];
    cartItemPositions: number[];
    warnings: string[];
};

function parseArgs() {
    const args = process.argv.slice(2);
    const execute = args.includes('--execute');
    const sourceBedIdsArg = args.find((arg) =>
        arg.startsWith('--source-bed-ids='),
    );
    const sourceBedIds = sourceBedIdsArg
        ? sourceBedIdsArg
              .slice('--source-bed-ids='.length)
              .split(',')
              .map((value) => Number.parseInt(value.trim(), 10))
              .filter((value) => Number.isInteger(value))
        : [];

    return {
        execute,
        sourceBedIds,
    };
}

function uniqueSorted(values: number[]) {
    return Array.from(new Set(values)).sort((left, right) => left - right);
}

function expectedBlockStart(currentStart: number) {
    if (currentStart <= 0) {
        return 0;
    }

    return (
        (Math.floor((currentStart - 1) / RAISED_BED_FIELDS_PER_BLOCK) + 1) *
        RAISED_BED_FIELDS_PER_BLOCK
    );
}

async function getMergeSources(
    client: Client,
    sourceBedIds: number[],
): Promise<MergeSource[]> {
    if (sourceBedIds.length > 0) {
        const result = await client.query<{
            id: number;
            updated_at: Date;
        }>(
            `
                select id, updated_at
                from raised_beds
                where id = any($1::int[])
                  and is_deleted = true
                  and garden_id is null
                  and account_id is null
                  and block_id is null
                order by updated_at asc, id asc
            `,
            [sourceBedIds],
        );

        return result.rows.map((row) => ({
            id: row.id,
            updatedAt: new Date(row.updated_at),
        }));
    }

    const result = await client.query<{
        id: number;
        updated_at: Date;
    }>(`
        select id, updated_at
        from raised_beds
        where is_deleted = true
          and garden_id is null
          and account_id is null
          and block_id is null
        order by updated_at asc, id asc
    `);

    return result.rows.map((row) => ({
        id: row.id,
        updatedAt: new Date(row.updated_at),
    }));
}

async function getMovedFields(
    client: Client,
    source: MergeSource,
): Promise<MovedFieldRow[]> {
    const windowStart = new Date(source.updatedAt.getTime() - MERGE_WINDOW_MS);
    const windowEnd = new Date(
        source.updatedAt.getTime() + MERGE_POST_WINDOW_MS,
    );

    const result = await client.query<{
        id: number;
        raised_bed_id: number;
        position_index: number;
        updated_at: Date;
    }>(
        `
            select id, raised_bed_id, position_index, updated_at
            from raised_bed_fields
            where updated_at >= $1
              and updated_at <= $2
              and raised_bed_id <> $3
              and position_index is not null
            order by raised_bed_id asc, position_index asc, id asc
        `,
        [windowStart, windowEnd, source.id],
    );

    return result.rows.map((row) => ({
        id: row.id,
        raisedBedId: row.raised_bed_id,
        positionIndex: row.position_index,
        updatedAt: new Date(row.updated_at),
    }));
}

async function getMovedCartItems(
    client: Client,
    source: MergeSource,
): Promise<MovedCartItemRow[]> {
    const windowStart = new Date(source.updatedAt.getTime() - MERGE_WINDOW_MS);
    const windowEnd = new Date(
        source.updatedAt.getTime() + MERGE_POST_WINDOW_MS,
    );

    const result = await client.query<{
        id: number;
        raised_bed_id: number;
        position_index: number;
        entity_type_name: string;
        entity_id: string;
        is_deleted: boolean;
    }>(
        `
            select
                id,
                raised_bed_id,
                position_index,
                entity_type_name,
                entity_id,
                is_deleted
            from shopping_cart_items
            where updated_at >= $1
              and updated_at <= $2
              and raised_bed_id <> $3
              and position_index is not null
            order by raised_bed_id asc, position_index asc, id asc
        `,
        [windowStart, windowEnd, source.id],
    );

    return result.rows.map((row) => ({
        id: row.id,
        raisedBedId: row.raised_bed_id,
        positionIndex: row.position_index,
        entityTypeName: row.entity_type_name,
        entityId: row.entity_id,
        isDeleted: row.is_deleted,
    }));
}

function chooseTargetBedId(
    movedFields: MovedFieldRow[],
    movedCartItems: MovedCartItemRow[],
) {
    const counts = new Map<number, number>();

    for (const row of movedFields) {
        counts.set(row.raisedBedId, (counts.get(row.raisedBedId) ?? 0) + 1000);
    }

    for (const row of movedCartItems) {
        counts.set(row.raisedBedId, (counts.get(row.raisedBedId) ?? 0) + 1);
    }

    if (counts.size === 0) {
        return null;
    }

    return (
        Array.from(counts.entries()).sort((left, right) => {
            if (right[1] !== left[1]) {
                return right[1] - left[1];
            }

            return left[0] - right[0];
        })[0]?.[0] ?? null
    );
}

async function buildRepairPlan(
    client: Client,
    source: MergeSource,
): Promise<RepairPlan | null> {
    const movedFields = await getMovedFields(client, source);
    const movedCartItems = await getMovedCartItems(client, source);
    const targetBedId = chooseTargetBedId(movedFields, movedCartItems);

    if (!targetBedId) {
        return null;
    }

    const targetFields = movedFields.filter(
        (field) => field.raisedBedId === targetBedId,
    );
    const targetCartItems = movedCartItems.filter(
        (item) => item.raisedBedId === targetBedId,
    );
    const warnings: string[] = [];

    const distinctFieldTargets = uniqueSorted(
        movedFields.map((field) => field.raisedBedId),
    );
    const distinctCartTargets = uniqueSorted(
        movedCartItems.map((item) => item.raisedBedId),
    );

    if (distinctFieldTargets.length > 1) {
        warnings.push(
            `Multiple target beds detected from fields: ${distinctFieldTargets.join(', ')}`,
        );
    }

    if (distinctCartTargets.length > 1) {
        warnings.push(
            `Multiple target beds detected from cart items: ${distinctCartTargets.join(', ')}`,
        );
    }

    if (targetFields.length === 0) {
        warnings.push(
            'No moved field rows detected; cart-only repair skipped.',
        );

        return {
            sourceBedId: source.id,
            targetBedId,
            mergedAt: source.updatedAt.toISOString(),
            fieldCount: 0,
            cartItemCount: targetCartItems.length,
            cartItemShift: 0,
            currentFieldStart: null,
            expectedFieldStart: 0,
            fieldDelta: 0,
            fieldPositions: [],
            cartItemPositions: uniqueSorted(
                targetCartItems.map((item) => item.positionIndex),
            ),
            warnings,
        };
    }

    const currentFieldStart = Math.min(
        ...targetFields.map((field) => field.positionIndex),
    );
    const expectedFieldStart = expectedBlockStart(currentFieldStart);
    const fieldDelta = expectedFieldStart - currentFieldStart;
    const cartItemPositions = uniqueSorted(
        targetCartItems.map((item) => item.positionIndex),
    );
    const cartItemShift =
        expectedFieldStart > 0 &&
        cartItemPositions.some((position) => position < expectedFieldStart)
            ? expectedFieldStart
            : 0;

    return {
        sourceBedId: source.id,
        targetBedId,
        mergedAt: source.updatedAt.toISOString(),
        fieldCount: targetFields.length,
        cartItemCount: targetCartItems.length,
        cartItemShift,
        currentFieldStart,
        expectedFieldStart,
        fieldDelta,
        fieldPositions: uniqueSorted(
            targetFields.map((field) => field.positionIndex),
        ),
        cartItemPositions,
        warnings,
    };
}

async function applyRepairPlan(
    client: Client,
    source: MergeSource,
    plan: RepairPlan,
) {
    if (plan.fieldCount > 0 && plan.fieldDelta !== 0) {
        const movedFields = (await getMovedFields(client, source)).filter(
            (field) => field.raisedBedId === plan.targetBedId,
        );
        const fieldIds = movedFields.map((field) => field.id);

        if (fieldIds.length > 0) {
            await client.query(
                `
                    update raised_bed_fields
                    set position_index = position_index + $1
                    where id = any($2::int[])
                `,
                [plan.fieldDelta, fieldIds],
            );
        }

        const eventPositions =
            plan.fieldDelta > 0
                ? [...plan.fieldPositions].sort((left, right) => right - left)
                : [...plan.fieldPositions].sort((left, right) => left - right);

        for (const fromPosition of eventPositions) {
            const toPosition = fromPosition + plan.fieldDelta;
            await client.query(
                `
                    update events
                    set aggregate_id = $1
                    where aggregate_id = $2
                      and type = any($3::text[])
                `,
                [
                    `${plan.targetBedId.toString()}|${toPosition.toString()}`,
                    `${plan.targetBedId.toString()}|${fromPosition.toString()}`,
                    FIELD_EVENT_TYPES,
                ],
            );
        }
    }

    if (plan.cartItemCount > 0 && plan.cartItemShift !== 0) {
        const movedCartItems = (await getMovedCartItems(client, source)).filter(
            (item) => item.raisedBedId === plan.targetBedId,
        );
        const cartItemIds = movedCartItems.map((item) => item.id);

        if (cartItemIds.length > 0) {
            await client.query(
                `
                    update shopping_cart_items
                    set position_index = position_index + $1
                    where id = any($2::int[])
                `,
                [plan.cartItemShift, cartItemIds],
            );
        }
    }
}

function printPlans(plans: RepairPlan[]) {
    const summary = plans.map((plan) => ({
        sourceBedId: plan.sourceBedId,
        targetBedId: plan.targetBedId,
        mergedAt: plan.mergedAt,
        fieldCount: plan.fieldCount,
        cartItemCount: plan.cartItemCount,
        cartItemShift: plan.cartItemShift,
        currentFieldStart: plan.currentFieldStart,
        expectedFieldStart: plan.expectedFieldStart,
        fieldDelta: plan.fieldDelta,
        fieldPositions: plan.fieldPositions.join(','),
        cartItemPositions: plan.cartItemPositions.join(','),
        warnings: plan.warnings.join(' | '),
    }));

    console.log(JSON.stringify(summary, null, 2));
}

const { execute, sourceBedIds } = parseArgs();

if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable is not set.');
}

const client = new Client({ connectionString: process.env.POSTGRES_URL });

await client.connect();

try {
    if (execute) {
        await client.query('begin');
    }

    const mergeSources = await getMergeSources(client, sourceBedIds);
    const plans: RepairPlan[] = [];

    for (const source of mergeSources) {
        const plan = await buildRepairPlan(client, source);
        if (!plan) {
            continue;
        }

        plans.push(plan);

        if (
            execute &&
            plan.warnings.length === 0 &&
            (plan.fieldDelta !== 0 || plan.cartItemShift !== 0)
        ) {
            await applyRepairPlan(client, source, plan);
        }
    }

    printPlans(plans);

    if (execute) {
        await client.query('commit');
        console.log(
            `Applied ${plans.filter((plan) => plan.warnings.length === 0).length} repair plans.`,
        );
    }
} catch (error) {
    if (execute) {
        await client.query('rollback');
    }

    throw error;
} finally {
    await client.end();
}
