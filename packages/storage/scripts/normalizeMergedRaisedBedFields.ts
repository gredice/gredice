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

type Args = {
    execute: boolean;
    targetBedIds: number[];
};

type MergeSource = {
    id: number;
    updatedAt: Date;
};

type MovedFieldRow = {
    id: number;
    raisedBedId: number;
    positionIndex: number;
};

type MovedCartItemRow = {
    raisedBedId: number;
};

type MergedTarget = {
    targetBedId: number;
    physicalId: string;
};

type FieldRow = {
    id: number;
    positionIndex: number;
    createdAt: Date;
};

type FieldMove = {
    fieldId: number;
    fromPositionIndex: number;
    toPositionIndex: number;
};

type DuplicateMapping = {
    canonicalFieldId: number;
    duplicateFieldIds: number[];
};

type BlockPlan = {
    label: 'target' | 'source';
    beforePositions: number[];
    moves: FieldMove[];
    insertPositions: number[];
    duplicateMappings: DuplicateMapping[];
    warnings: string[];
};

type BedPlan = {
    targetBedId: number;
    physicalId: string;
    beforePositions: number[];
    afterPositions: number[];
    targetBlock: BlockPlan;
    sourceBlock: BlockPlan;
    warnings: string[];
};

function parseArgs(): Args {
    const args = process.argv.slice(2);
    const execute = args.includes('--execute');
    const targetBedIdsArg = args.find((arg) =>
        arg.startsWith('--target-bed-ids='),
    );

    return {
        execute,
        targetBedIds: targetBedIdsArg
            ? targetBedIdsArg
                  .slice('--target-bed-ids='.length)
                  .split(',')
                  .map((value) => Number.parseInt(value.trim(), 10))
                  .filter((value) => Number.isInteger(value))
            : [],
    };
}

function expectedPositions(offset: number) {
    return Array.from(
        { length: RAISED_BED_FIELDS_PER_BLOCK },
        (_, index) => offset + index,
    );
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

async function getMergeSources(client: Client): Promise<MergeSource[]> {
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
    }>(
        `
            select id, raised_bed_id, position_index
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
        raised_bed_id: number;
    }>(
        `
            select raised_bed_id
            from shopping_cart_items
            where updated_at >= $1
              and updated_at <= $2
              and raised_bed_id <> $3
              and position_index is not null
            order by raised_bed_id asc, id asc
        `,
        [windowStart, windowEnd, source.id],
    );

    return result.rows.map((row) => ({
        raisedBedId: row.raised_bed_id,
    }));
}

async function getMergedTargets(
    client: Client,
    explicitTargetBedIds: number[],
): Promise<MergedTarget[]> {
    if (explicitTargetBedIds.length > 0) {
        const result = await client.query<{
            id: number;
            physical_id: string;
        }>(
            `
                select id, physical_id
                from raised_beds
                where id = any($1::int[])
                  and is_deleted = false
                  and physical_id is not null
                order by physical_id::int, id
            `,
            [explicitTargetBedIds],
        );

        return result.rows.map((row) => ({
            targetBedId: row.id,
            physicalId: row.physical_id,
        }));
    }

    const mergeSources = await getMergeSources(client);
    const targets = new Map<number, MergedTarget>();

    for (const source of mergeSources) {
        const movedFields = await getMovedFields(client, source);
        const movedCartItems = await getMovedCartItems(client, source);
        const targetBedId = chooseTargetBedId(movedFields, movedCartItems);
        if (!targetBedId || targets.has(targetBedId)) {
            continue;
        }

        const targetResult = await client.query<{
            id: number;
            physical_id: string;
        }>(
            `
                select id, physical_id
                from raised_beds
                where id = $1
                  and is_deleted = false
                  and physical_id is not null
            `,
            [targetBedId],
        );
        const target = targetResult.rows[0];
        if (!target) {
            continue;
        }

        targets.set(targetBedId, {
            targetBedId: target.id,
            physicalId: target.physical_id,
        });
    }

    return [...targets.values()].sort((left, right) => {
        const physicalComparison =
            Number(left.physicalId) - Number(right.physicalId);
        if (physicalComparison !== 0) {
            return physicalComparison;
        }

        return left.targetBedId - right.targetBedId;
    });
}

async function getBedFields(client: Client, targetBedId: number) {
    const result = await client.query<{
        id: number;
        position_index: number;
        created_at: Date;
    }>(
        `
            select id, position_index, created_at
            from raised_bed_fields
            where raised_bed_id = $1
              and is_deleted = false
            order by position_index asc, created_at asc, id asc
        `,
        [targetBedId],
    );

    return result.rows.map((row) => ({
        id: row.id,
        positionIndex: row.position_index,
        createdAt: new Date(row.created_at),
    })) satisfies FieldRow[];
}

async function getOperationCounts(client: Client, fieldIds: number[]) {
    if (fieldIds.length === 0) {
        return new Map<number, number>();
    }

    const result = await client.query<{
        raised_bed_field_id: number;
        count: string;
    }>(
        `
            select raised_bed_field_id, count(*)::text as count
            from operations
            where is_deleted = false
              and raised_bed_field_id = any($1::int[])
            group by raised_bed_field_id
        `,
        [fieldIds],
    );

    return new Map(
        result.rows.map((row) => [
            row.raised_bed_field_id,
            Number.parseInt(row.count, 10),
        ]),
    );
}

function sortRowsByPriority(
    rows: FieldRow[],
    operationCounts: Map<number, number>,
) {
    return [...rows].sort((left, right) => {
        const leftOperationCount = operationCounts.get(left.id) ?? 0;
        const rightOperationCount = operationCounts.get(right.id) ?? 0;
        if (rightOperationCount !== leftOperationCount) {
            return rightOperationCount - leftOperationCount;
        }

        const createdAtDelta =
            left.createdAt.getTime() - right.createdAt.getTime();
        if (createdAtDelta !== 0) {
            return createdAtDelta;
        }

        return left.id - right.id;
    });
}

function buildBlockPlan(
    label: 'target' | 'source',
    rows: FieldRow[],
    operationCounts: Map<number, number>,
    startPosition: number,
) {
    const plannedPositions = expectedPositions(startPosition);
    const rowsByPosition = new Map<number, FieldRow[]>();
    const outsideRows: FieldRow[] = [];

    for (const row of rows) {
        if (plannedPositions.includes(row.positionIndex)) {
            const rowsAtPosition = rowsByPosition.get(row.positionIndex);
            if (rowsAtPosition) {
                rowsAtPosition.push(row);
            } else {
                rowsByPosition.set(row.positionIndex, [row]);
            }
            continue;
        }

        outsideRows.push(row);
    }

    const duplicateMappings: DuplicateMapping[] = [];
    const missingPositions: number[] = [];

    for (const position of plannedPositions) {
        const rowsAtPosition = rowsByPosition.get(position);
        if (!rowsAtPosition || rowsAtPosition.length === 0) {
            missingPositions.push(position);
            continue;
        }

        const prioritizedRows = sortRowsByPriority(
            rowsAtPosition,
            operationCounts,
        );
        const canonicalRow = prioritizedRows.shift();
        if (!canonicalRow || prioritizedRows.length === 0) {
            continue;
        }

        duplicateMappings.push({
            canonicalFieldId: canonicalRow.id,
            duplicateFieldIds: prioritizedRows.map((row) => row.id),
        });
    }

    const moves: FieldMove[] = [];
    const sortedOutsideRows = outsideRows.sort((left, right) => {
        if (left.positionIndex !== right.positionIndex) {
            return left.positionIndex - right.positionIndex;
        }

        return sortRowsByPriority([left, right], operationCounts)[0]?.id ===
            left.id
            ? -1
            : 1;
    });

    for (let index = 0; index < missingPositions.length; index += 1) {
        const row = sortedOutsideRows[index];
        if (!row) {
            break;
        }

        moves.push({
            fieldId: row.id,
            fromPositionIndex: row.positionIndex,
            toPositionIndex: missingPositions[index] ?? row.positionIndex,
        });
    }

    const remainingOutsideRows = sortedOutsideRows.slice(
        missingPositions.length,
    );
    const warnings =
        remainingOutsideRows.length > 0
            ? [
                  `${label} block still has ${remainingOutsideRows.length} rows outside ${startPosition}-${startPosition + RAISED_BED_FIELDS_PER_BLOCK - 1}`,
              ]
            : [];

    return {
        label,
        beforePositions: rows
            .map((row) => row.positionIndex)
            .sort((a, b) => a - b),
        moves,
        insertPositions: missingPositions.slice(moves.length),
        duplicateMappings,
        warnings,
    } satisfies BlockPlan;
}

async function applyDuplicateMappings(
    client: Client,
    duplicateMappings: DuplicateMapping[],
) {
    for (const duplicateMapping of duplicateMappings) {
        if (duplicateMapping.duplicateFieldIds.length === 0) {
            continue;
        }

        await client.query(
            `
                update operations
                set raised_bed_field_id = $1
                where raised_bed_field_id = any($2::int[])
            `,
            [
                duplicateMapping.canonicalFieldId,
                duplicateMapping.duplicateFieldIds,
            ],
        );

        await client.query(
            `
                update raised_bed_fields
                set is_deleted = true,
                    updated_at = now()
                where id = any($1::int[])
            `,
            [duplicateMapping.duplicateFieldIds],
        );
    }
}

async function applyMoves(
    client: Client,
    targetBedId: number,
    moves: FieldMove[],
) {
    for (const move of moves) {
        if (move.fromPositionIndex === move.toPositionIndex) {
            continue;
        }

        await client.query(
            `
                update raised_bed_fields
                set position_index = $1,
                    updated_at = now()
                where id = $2
            `,
            [move.toPositionIndex, move.fieldId],
        );

        await client.query(
            `
                update events
                set aggregate_id = $1
                where aggregate_id = $2
                  and type = any($3::text[])
            `,
            [
                `${targetBedId}|${move.toPositionIndex}`,
                `${targetBedId}|${move.fromPositionIndex}`,
                FIELD_EVENT_TYPES,
            ],
        );
    }
}

async function applyInsertions(
    client: Client,
    targetBedId: number,
    positions: number[],
) {
    if (positions.length === 0) {
        return;
    }

    await client.query(
        `
            insert into raised_bed_fields (
                raised_bed_id,
                position_index,
                created_at,
                updated_at
            )
            select $1, position_index, now(), now()
            from unnest($2::int[]) as position_index
        `,
        [targetBedId, positions],
    );
}

async function repairOperationsOnDeletedFields(
    client: Client,
    targetBedId: number,
) {
    const activeFieldsResult = await client.query<{
        id: number;
        position_index: number;
    }>(
        `
            select id, position_index
            from raised_bed_fields
            where raised_bed_id = $1
              and is_deleted = false
        `,
        [targetBedId],
    );

    const activeFieldIdByPosition = new Map(
        activeFieldsResult.rows.map((row) => [row.position_index, row.id]),
    );

    const deletedFieldOperationsResult = await client.query<{
        operation_id: number;
        position_index: number;
    }>(
        `
            select
                o.id as operation_id,
                rbf.position_index
            from operations o
            join raised_bed_fields rbf on rbf.id = o.raised_bed_field_id
            where o.is_deleted = false
              and o.raised_bed_id = $1
              and rbf.is_deleted = true
        `,
        [targetBedId],
    );

    let reassignedCount = 0;
    let clearedCount = 0;

    for (const row of deletedFieldOperationsResult.rows) {
        const nextRaisedBedFieldId =
            activeFieldIdByPosition.get(row.position_index) ?? null;

        await client.query(
            `
                update operations
                set raised_bed_field_id = $1
                where id = $2
            `,
            [nextRaisedBedFieldId, row.operation_id],
        );

        if (nextRaisedBedFieldId) {
            reassignedCount += 1;
        } else {
            clearedCount += 1;
        }
    }

    return {
        reassignedCount,
        clearedCount,
    };
}

async function buildBedPlan(
    client: Client,
    mergedTarget: MergedTarget,
): Promise<BedPlan> {
    const fields = await getBedFields(client, mergedTarget.targetBedId);
    const operationCounts = await getOperationCounts(
        client,
        fields.map((field) => field.id),
    );
    const targetRows = fields.filter((field) => field.positionIndex < 9);
    const sourceRows = fields.filter((field) => field.positionIndex >= 9);
    const targetBlock = buildBlockPlan(
        'target',
        targetRows,
        operationCounts,
        0,
    );
    const sourceBlock = buildBlockPlan(
        'source',
        sourceRows,
        operationCounts,
        9,
    );

    return {
        targetBedId: mergedTarget.targetBedId,
        physicalId: mergedTarget.physicalId,
        beforePositions: fields
            .map((field) => field.positionIndex)
            .sort((a, b) => a - b),
        afterPositions: expectedPositions(0).concat(expectedPositions(9)),
        targetBlock,
        sourceBlock,
        warnings: [...targetBlock.warnings, ...sourceBlock.warnings],
    };
}

async function applyBedPlan(client: Client, plan: BedPlan) {
    await applyDuplicateMappings(client, plan.targetBlock.duplicateMappings);
    await applyDuplicateMappings(client, plan.sourceBlock.duplicateMappings);
    await applyMoves(client, plan.targetBedId, plan.targetBlock.moves);
    await applyMoves(client, plan.targetBedId, plan.sourceBlock.moves);
    await applyInsertions(
        client,
        plan.targetBedId,
        plan.targetBlock.insertPositions,
    );
    await applyInsertions(
        client,
        plan.targetBedId,
        plan.sourceBlock.insertPositions,
    );
}

function printPlans(plans: BedPlan[]) {
    console.log(
        JSON.stringify(
            plans.map((plan) => ({
                targetBedId: plan.targetBedId,
                physicalId: plan.physicalId,
                beforePositions: plan.beforePositions,
                afterPositions: plan.afterPositions,
                targetMoves: plan.targetBlock.moves,
                sourceMoves: plan.sourceBlock.moves,
                targetInsertPositions: plan.targetBlock.insertPositions,
                sourceInsertPositions: plan.sourceBlock.insertPositions,
                targetDuplicateDeletes:
                    plan.targetBlock.duplicateMappings.flatMap(
                        (mapping) => mapping.duplicateFieldIds,
                    ),
                sourceDuplicateDeletes:
                    plan.sourceBlock.duplicateMappings.flatMap(
                        (mapping) => mapping.duplicateFieldIds,
                    ),
                warnings: plan.warnings,
            })),
            null,
            2,
        ),
    );
}

const { execute, targetBedIds } = parseArgs();

if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable is not set.');
}

const client = new Client({ connectionString: process.env.POSTGRES_URL });

await client.connect();

try {
    const mergedTargets = await getMergedTargets(client, targetBedIds);
    const plans: BedPlan[] = [];
    for (const mergedTarget of mergedTargets) {
        plans.push(await buildBedPlan(client, mergedTarget));
    }

    printPlans(plans);

    const warnings = plans.flatMap((plan) =>
        plan.warnings.map((warning) => `${plan.targetBedId}: ${warning}`),
    );

    if (warnings.length > 0) {
        throw new Error(`Unsafe normalization plan:\n${warnings.join('\n')}`);
    }

    if (execute) {
        await client.query('begin');
        let repairedOperationCount = 0;
        let clearedOperationCount = 0;
        for (const plan of plans) {
            await applyBedPlan(client, plan);
            const operationRepair = await repairOperationsOnDeletedFields(
                client,
                plan.targetBedId,
            );
            repairedOperationCount += operationRepair.reassignedCount;
            clearedOperationCount += operationRepair.clearedCount;
        }
        await client.query('commit');
        console.log(`Normalized ${plans.length} merged raised beds.`);
        console.log(
            `Repaired ${repairedOperationCount} operation field links and cleared ${clearedOperationCount} ambiguous links.`,
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
