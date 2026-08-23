import { mergeRaisedBeds } from '@gredice/storage';
import { Client } from 'pg';
import {
    planRaisedBedSingleBlockMigration,
    type RaisedBedSingleBlockMigrationPlan,
} from '../lib/garden/raisedBedSingleBlockMigration';

// Run the dry run first and execute only in the same maintenance window as the
// matching 1x2 Raised_Bed catalogue update and runtime deployment.

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const summaryOnly = args.includes('--summary');
const gardenIdsArgument = args.find((argument) =>
    argument.startsWith('--garden-ids='),
);
const resolvedPairArguments = args.filter((argument) =>
    argument.startsWith('--resolve-pair='),
);
const separatePairArguments = args.filter((argument) =>
    argument.startsWith('--keep-separate='),
);
for (const argument of args) {
    if (
        argument !== '--' &&
        argument !== '--execute' &&
        argument !== '--summary' &&
        !argument.startsWith('--garden-ids=') &&
        !argument.startsWith('--resolve-pair=') &&
        !argument.startsWith('--keep-separate=')
    ) {
        throw new Error(`Unknown argument: ${argument}`);
    }
}
const gardenIds = gardenIdsArgument
    ? gardenIdsArgument
          .slice('--garden-ids='.length)
          .split(',')
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter(Number.isInteger)
    : [];
const resolvedPairs = resolvedPairArguments.map((argument) => {
    const match = /^--resolve-pair=(\d+):(\d+)$/.exec(argument);
    if (!match?.[1] || !match[2]) {
        throw new Error(
            `Invalid explicit pair resolution: ${argument}. Expected --resolve-pair=<first-id>:<second-id>.`,
        );
    }
    return {
        firstRaisedBedId: Number.parseInt(match[1], 10),
        secondRaisedBedId: Number.parseInt(match[2], 10),
    };
});
const separatePairs = separatePairArguments.map((argument) => {
    const match = /^--keep-separate=(\d+):(\d+)$/.exec(argument);
    if (!match?.[1] || !match[2]) {
        throw new Error(
            `Invalid keep-separate pair: ${argument}. Expected --keep-separate=<first-id>:<second-id>.`,
        );
    }
    return {
        firstRaisedBedId: Number.parseInt(match[1], 10),
        secondRaisedBedId: Number.parseInt(match[2], 10),
    };
});

if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable is not set.');
}

const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

function gardenFilter(alias: string, values: unknown[]) {
    return gardenIds.length > 0
        ? `and ${alias}.garden_id = any($${values.push(gardenIds)}::int[])`
        : '';
}

async function readMigrationInput() {
    const raisedBedValues: unknown[] = [];
    const raisedBedResult = await client.query<{
        block_id: string;
        garden_id: number;
        max_field_position: number | null;
        min_field_position: number | null;
        orientation: 'horizontal' | 'vertical';
        raised_bed_id: number;
        status: string;
    }>(
        `
            select
                rb.block_id,
                rb.garden_id,
                rb.id as raised_bed_id,
                rb.orientation,
                rb.status,
                (
                    select max(field.position_index)
                    from raised_bed_fields field
                    where field.raised_bed_id = rb.id
                ) as max_field_position,
                (
                    select min(field.position_index)
                    from raised_bed_fields field
                    where field.raised_bed_id = rb.id
                ) as min_field_position
            from raised_beds rb
            where rb.is_deleted = false
              and rb.block_id is not null
              and rb.garden_id is not null
              ${gardenFilter('rb', raisedBedValues)}
            order by rb.garden_id, rb.id
        `,
        raisedBedValues,
    );

    const placementValues: unknown[] = [];
    const placementResult = await client.query<{
        block_id: string;
        garden_id: number;
        index: number;
        referenced: boolean;
        rotation: number;
        x: number;
        y: number;
    }>(
        `
            select
                gb.id as block_id,
                gb.garden_id,
                array_position(gs.blocks, gb.id) - 1 as index,
                exists (
                    select 1
                    from raised_beds reference
                    where reference.block_id = gb.id
                      and reference.is_deleted = false
                ) as referenced,
                gb.rotation,
                gs.position_x as x,
                gs.position_y as y
            from garden_blocks gb
            join garden_stacks gs
              on gs.garden_id = gb.garden_id
             and gs.is_deleted = false
             and gb.id = any(gs.blocks)
            where gb.is_deleted = false
              and gb.name = 'Raised_Bed'
              ${gardenFilter('gb', placementValues)}
            order by gb.garden_id, gb.id
        `,
        placementValues,
    );

    const footprintResult = await client.query<{
        span_depth: string | null;
        span_width: string | null;
    }>(
        `
            with raised_bed_entity as (
                select name_value.entity_id
                from attribute_values name_value
                join attribute_definitions name_definition
                  on name_definition.id = name_value.attribute_definition_id
                 and name_definition.is_deleted = false
                join entities entity
                  on entity.id = name_value.entity_id
                 and entity.is_deleted = false
                 and entity.entity_type = 'block'
                where name_value.is_deleted = false
                  and name_definition.entity_type = 'block'
                  and name_definition.category = 'information'
                  and name_definition.name = 'name'
                  and name_value.value = 'Raised_Bed'
                limit 1
            )
            select
                max(value.value) filter (
                    where definition.category = 'attributes'
                      and definition.name = 'spanDepth'
                ) as span_depth,
                max(value.value) filter (
                    where definition.category = 'attributes'
                      and definition.name = 'spanWidth'
                ) as span_width
            from raised_bed_entity entity
            left join attribute_values value
              on value.entity_id = entity.entity_id
             and value.is_deleted = false
            left join attribute_definitions definition
              on definition.id = value.attribute_definition_id
             and definition.is_deleted = false
        `,
    );
    const footprint = footprintResult.rows[0];

    return {
        nativeFootprint:
            footprint?.span_depth === '2' && footprint.span_width === '1',
        placements: placementResult.rows.map((row) => ({
            blockId: row.block_id,
            gardenId: row.garden_id,
            index: row.index,
            referenced: row.referenced,
            rotation: row.rotation,
            x: row.x,
            y: row.y,
        })),
        raisedBeds: raisedBedResult.rows.map((row) => ({
            blockId: row.block_id,
            gardenId: row.garden_id,
            maxFieldPosition: row.max_field_position,
            minFieldPosition: row.min_field_position,
            orientation: row.orientation,
            raisedBedId: row.raised_bed_id,
            status: row.status,
        })),
    };
}

async function applyPlan(plan: RaisedBedSingleBlockMigrationPlan) {
    if (plan.sourceRaisedBedId !== null) {
        await mergeRaisedBeds(plan.raisedBedId, plan.sourceRaisedBedId);
    }

    await client.query('begin');
    try {
        const raisedBed = await client.query<{
            block_id: string;
            garden_id: number;
        }>(
            `
                select block_id, garden_id
                from raised_beds
                where id = $1 and is_deleted = false
                for update
            `,
            [plan.raisedBedId],
        );
        const currentRaisedBed = raisedBed.rows[0];
        if (
            currentRaisedBed?.block_id !== plan.canonicalBlockId ||
            currentRaisedBed.garden_id !== plan.gardenId
        ) {
            throw new Error('raised-bed ownership changed after planning');
        }

        const expectedBlockIds = [
            plan.canonicalBlockId,
            ...(plan.legacyBlockId ? [plan.legacyBlockId] : []),
        ];
        const blocks = await client.query<{
            id: string;
            is_deleted: boolean;
            name: string;
        }>(
            `
                select id, is_deleted, name
                from garden_blocks
                where garden_id = $1 and id = any($2::text[])
                for update
            `,
            [plan.gardenId, expectedBlockIds],
        );
        if (
            blocks.rows.length !== expectedBlockIds.length ||
            blocks.rows.some(
                (block) => block.is_deleted || block.name !== 'Raised_Bed',
            )
        ) {
            throw new Error('raised-bed blocks changed after planning');
        }

        if (plan.legacyBlockId) {
            const legacyReferences = await client.query<{ count: string }>(
                `
                    select count(*)::text as count
                    from raised_beds
                    where block_id = $1 and is_deleted = false
                `,
                [plan.legacyBlockId],
            );
            if (legacyReferences.rows[0]?.count !== '0') {
                throw new Error('legacy block gained a raised-bed reference');
            }
        }

        const stacks = await client.query<{
            blocks: string[];
            id: number;
            position_x: number;
            position_y: number;
        }>(
            `
                select id, position_x, position_y, blocks
                from garden_stacks
                where garden_id = $1
                  and is_deleted = false
                  and (
                    $2 = any(blocks)
                    or ($3::text is not null and $3 = any(blocks))
                  )
                for update
            `,
            [plan.gardenId, plan.canonicalBlockId, plan.legacyBlockId],
        );
        const canonicalStack = stacks.rows.find((stack) =>
            stack.blocks.includes(plan.canonicalBlockId),
        );
        const legacyStack = stacks.rows.find((stack) =>
            plan.legacyBlockId
                ? stack.blocks.includes(plan.legacyBlockId)
                : false,
        );
        const targetStack = stacks.rows.find(
            (stack) =>
                stack.position_x === plan.anchor.x &&
                stack.position_y === plan.anchor.y,
        );
        if (!canonicalStack || !targetStack) {
            throw new Error('legacy pair placement changed after planning');
        }
        if (
            canonicalStack.blocks.indexOf(plan.canonicalBlockId) !==
                plan.stackIndex ||
            (plan.legacyBlockId &&
                legacyStack?.blocks.indexOf(plan.legacyBlockId) !==
                    plan.stackIndex)
        ) {
            throw new Error('legacy pair stack index changed after planning');
        }

        for (const stack of stacks.rows) {
            const nextBlocks = stack.blocks.filter(
                (blockId) =>
                    blockId !== plan.canonicalBlockId &&
                    (!plan.legacyBlockId || blockId !== plan.legacyBlockId),
            );
            if (stack.id === targetStack.id) {
                nextBlocks.splice(
                    Math.min(plan.stackIndex, nextBlocks.length),
                    0,
                    plan.canonicalBlockId,
                );
            }
            await client.query(
                `
                    update garden_stacks
                    set blocks = $1, updated_at = now()
                    where id = $2
                `,
                [nextBlocks, stack.id],
            );
        }

        await client.query(
            `
                update garden_blocks
                set rotation = $1, updated_at = now()
                where id = $2 and garden_id = $3 and is_deleted = false
            `,
            [plan.rotation, plan.canonicalBlockId, plan.gardenId],
        );
        if (plan.legacyBlockId) {
            await client.query(
                `
                    update garden_blocks
                    set is_deleted = true, updated_at = now()
                    where id = $1 and garden_id = $2 and is_deleted = false
                `,
                [plan.legacyBlockId, plan.gardenId],
            );
        }
        await client.query(
            `
                update raised_beds
                set orientation = $1, updated_at = now()
                where id = $2 and block_id = $3 and is_deleted = false
            `,
            [plan.orientation, plan.raisedBedId, plan.canonicalBlockId],
        );
        await client.query('commit');
    } catch (error) {
        await client.query('rollback');
        throw error;
    }

    const readback = await client.query<{
        canonical_count: string;
        legacy_active: boolean;
        orientation: string;
        position_x: number;
        position_y: number;
        rotation: number;
    }>(
        `
            select
                (
                    select count(*)::text
                    from garden_stacks gs
                    where gs.garden_id = rb.garden_id
                      and gs.is_deleted = false
                      and rb.block_id = any(gs.blocks)
                ) as canonical_count,
                (
                    select not gb.is_deleted
                    from garden_blocks gb
                    where gb.id = $2
                ) as legacy_active,
                rb.orientation,
                gs.position_x,
                gs.position_y,
                gb.rotation
            from raised_beds rb
            join garden_blocks gb on gb.id = rb.block_id
            join garden_stacks gs
              on gs.garden_id = rb.garden_id
             and gs.is_deleted = false
             and rb.block_id = any(gs.blocks)
            where rb.id = $1 and rb.is_deleted = false
        `,
        [plan.raisedBedId, plan.legacyBlockId],
    );
    const row = readback.rows[0];
    if (
        row?.canonical_count !== '1' ||
        (plan.legacyBlockId !== null && row.legacy_active !== false) ||
        row.orientation !== plan.orientation ||
        row.position_x !== plan.anchor.x ||
        row.position_y !== plan.anchor.y ||
        row.rotation !== plan.rotation
    ) {
        throw new Error(
            `readback failed for raised bed ${plan.raisedBedId.toString()}`,
        );
    }
}

try {
    const input = await readMigrationInput();
    const plan = planRaisedBedSingleBlockMigration({
        ...input,
        resolvedPairs,
        separatePairs,
    });
    console.log(
        JSON.stringify(
            {
                mode: execute ? 'execute' : 'dry-run',
                nativeFootprint: input.nativeFootprint,
                resolvedPairs,
                separatePairs,
                alreadySingleCount: plan.alreadySingle.length,
                collapsedPairCount: plan.plans.filter(
                    (candidate) => candidate.legacyBlockId !== null,
                ).length,
                mergedRaisedBedPairCount: plan.plans.filter(
                    (candidate) => candidate.sourceRaisedBedId !== null,
                ).length,
                normalizationCount: plan.plans.filter(
                    (candidate) => candidate.legacyBlockId === null,
                ).length,
                planCount: plan.plans.length,
                plans: summaryOnly ? undefined : plan.plans,
                unplacedCount: plan.unplaced.length,
                unplacedRaisedBedIds: summaryOnly ? undefined : plan.unplaced,
                unsafe: plan.unsafe,
            },
            null,
            2,
        ),
    );

    if (!execute) {
        console.log(
            'Dry run only. Re-run with --execute after reviewing every plan.',
        );
    } else if (plan.unsafe.length > 0) {
        throw new Error(
            'Refusing to execute while unsafe raised-bed configurations remain.',
        );
    } else {
        for (const [index, migration] of plan.plans.entries()) {
            await applyPlan(migration);
            console.log(
                `Converted raised bed ${migration.raisedBedId.toString()} (${(index + 1).toString()}/${plan.plans.length.toString()})`,
            );
        }
    }

    if (plan.unsafe.length > 0) {
        process.exitCode = 1;
    }
} finally {
    await client.end();
}
