import { mergeRaisedBeds } from '@gredice/storage';
import { Client } from 'pg';
import { synchronizeGardenStacksAndRaisedBeds } from '../lib/garden/gardenStacksSyncService';

type Args = {
    execute: boolean;
    gardenIds: number[];
};

type GardenMergeStats = {
    gardenId: number;
    maxDegree: number;
    pairCount: number;
    participatingBeds: number;
};

type MergeSnapshot = {
    ambiguous: GardenMergeStats[];
    safe: GardenMergeStats[];
};

type SafeMergePair = {
    gardenId: number;
    sourceRaisedBedId: number;
    targetRaisedBedId: number;
};

function parseArgs(): Args {
    const args = process.argv.slice(2);
    const execute = args.includes('--execute');
    const gardenIdsArg = args.find((arg) => arg.startsWith('--garden-ids='));

    return {
        execute,
        gardenIds: gardenIdsArg
            ? gardenIdsArg
                  .slice('--garden-ids='.length)
                  .split(',')
                  .map((value) => Number.parseInt(value.trim(), 10))
                  .filter((value) => Number.isInteger(value))
            : [],
    };
}

function sumPairCount(gardens: GardenMergeStats[]) {
    return gardens.reduce((total, garden) => total + garden.pairCount, 0);
}

async function getMergeSnapshot(
    client: Client,
    gardenIds: number[],
): Promise<MergeSnapshot> {
    const params: unknown[] = [];
    const gardenFilter =
        gardenIds.length > 0
            ? `and rb.garden_id = any($${params.push(gardenIds)}::int[])`
            : '';

    const result = await client.query<{
        garden_id: number;
        max_degree: number;
        pair_count: string;
        participating_beds: string;
    }>(
        `
            with active_raised_beds as (
                select id, garden_id, block_id
                from raised_beds rb
                where rb.is_deleted = false
                  and rb.status = 'new'
                  and rb.block_id is not null
                  ${gardenFilter}
            ),
            block_positions as (
                select
                    rb.id,
                    rb.garden_id,
                    rb.block_id,
                    gs.position_x,
                    gs.position_y,
                    array_position(gs.blocks, rb.block_id) as idx
                from active_raised_beds rb
                join garden_stacks gs
                  on gs.garden_id = rb.garden_id
                 and gs.is_deleted = false
                 and rb.block_id = any(gs.blocks)
            ),
            edges as (
                select distinct
                    least(a.id, b.id) as left_id,
                    greatest(a.id, b.id) as right_id,
                    a.garden_id
                from block_positions a
                join block_positions b
                  on a.garden_id = b.garden_id
                 and a.id < b.id
                 and a.idx = b.idx
                 and (
                    (
                        a.position_x = b.position_x
                        and abs(a.position_y - b.position_y) = 1
                    ) or (
                        a.position_y = b.position_y
                        and abs(a.position_x - b.position_x) = 1
                    )
                 )
            ),
            degrees as (
                select garden_id, raised_bed_id, count(*)::int as degree
                from (
                    select garden_id, left_id as raised_bed_id
                    from edges
                    union all
                    select garden_id, right_id as raised_bed_id
                    from edges
                ) edge_members
                group by garden_id, raised_bed_id
            ),
            garden_stats as (
                select
                    d.garden_id,
                    max(d.degree)::int as max_degree,
                    count(*)::int as participating_beds,
                    pc.pair_count
                from degrees d
                join (
                    select garden_id, count(*)::int as pair_count
                    from edges
                    group by garden_id
                ) pc on pc.garden_id = d.garden_id
                group by d.garden_id, pc.pair_count
            )
            select
                garden_id,
                max_degree,
                pair_count::text,
                participating_beds::text
            from garden_stats
            order by garden_id
        `,
        params,
    );

    const rows = result.rows.map((row) => ({
        gardenId: row.garden_id,
        maxDegree: row.max_degree,
        pairCount: Number.parseInt(row.pair_count, 10),
        participatingBeds: Number.parseInt(row.participating_beds, 10),
    })) satisfies GardenMergeStats[];

    return {
        safe: rows.filter((row) => row.maxDegree === 1),
        ambiguous: rows.filter((row) => row.maxDegree > 1),
    };
}

async function getSafeMergePairs(
    client: Client,
    gardenIds: number[],
): Promise<SafeMergePair[]> {
    const params: unknown[] = [];
    const gardenFilter =
        gardenIds.length > 0
            ? `and rb.garden_id = any($${params.push(gardenIds)}::int[])`
            : '';

    const result = await client.query<{
        garden_id: number;
        source_raised_bed_id: number;
        target_raised_bed_id: number;
    }>(
        `
            with active_raised_beds as (
                select id, garden_id, block_id
                from raised_beds rb
                where rb.is_deleted = false
                  and rb.status = 'new'
                  and rb.block_id is not null
                  ${gardenFilter}
            ),
            block_positions as (
                select
                    rb.id,
                    rb.garden_id,
                    rb.block_id,
                    gs.position_x,
                    gs.position_y,
                    array_position(gs.blocks, rb.block_id) as idx
                from active_raised_beds rb
                join garden_stacks gs
                  on gs.garden_id = rb.garden_id
                 and gs.is_deleted = false
                 and rb.block_id = any(gs.blocks)
            ),
            edges as (
                select distinct
                    a.garden_id,
                    a.id as left_raised_bed_id,
                    b.id as right_raised_bed_id,
                    a.block_id as left_block_id,
                    b.block_id as right_block_id
                from block_positions a
                join block_positions b
                  on a.garden_id = b.garden_id
                 and a.id < b.id
                 and a.idx = b.idx
                 and (
                    (
                        a.position_x = b.position_x
                        and abs(a.position_y - b.position_y) = 1
                    ) or (
                        a.position_y = b.position_y
                        and abs(a.position_x - b.position_x) = 1
                    )
                 )
            ),
            degrees as (
                select garden_id, raised_bed_id, count(*)::int as degree
                from (
                    select garden_id, left_raised_bed_id as raised_bed_id
                    from edges
                    union all
                    select garden_id, right_raised_bed_id as raised_bed_id
                    from edges
                ) edge_members
                group by garden_id, raised_bed_id
            ),
            safe_gardens as (
                select garden_id
                from degrees
                group by garden_id
                having max(degree) = 1
            )
            select
                e.garden_id,
                case
                    when e.left_block_id <= e.right_block_id
                        then e.left_raised_bed_id
                    else e.right_raised_bed_id
                end as target_raised_bed_id,
                case
                    when e.left_block_id <= e.right_block_id
                        then e.right_raised_bed_id
                    else e.left_raised_bed_id
                end as source_raised_bed_id
            from edges e
            join safe_gardens sg on sg.garden_id = e.garden_id
            order by e.garden_id, target_raised_bed_id, source_raised_bed_id
        `,
        params,
    );

    return result.rows.map((row) => ({
        gardenId: row.garden_id,
        sourceRaisedBedId: row.source_raised_bed_id,
        targetRaisedBedId: row.target_raised_bed_id,
    }));
}

function printSummary(label: string, snapshot: MergeSnapshot) {
    console.log(
        JSON.stringify(
            {
                label,
                ambiguousGardenCount: snapshot.ambiguous.length,
                ambiguousGardens: snapshot.ambiguous,
                safeGardenCount: snapshot.safe.length,
                safeGardenIds: snapshot.safe.map((garden) => garden.gardenId),
                safePairCount: sumPairCount(snapshot.safe),
                totalPairCount:
                    sumPairCount(snapshot.safe) +
                    sumPairCount(snapshot.ambiguous),
            },
            null,
            2,
        ),
    );
}

const { execute, gardenIds } = parseArgs();

if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable is not set.');
}

const client = new Client({
    connectionString: process.env.POSTGRES_URL,
});

await client.connect();

try {
    const before = await getMergeSnapshot(client, gardenIds);
    printSummary('before', before);

    if (!execute) {
        console.log(
            'Dry run only. Re-run with --execute to merge the safe raised-bed pairs.',
        );
        if (before.ambiguous.length > 0) {
            console.log(
                'Ambiguous gardens were not selected for automatic merge.',
            );
        }
        process.exit(0);
    }

    const failures: Array<{ error: string; gardenId: number }> = [];
    const synchronizedGardenIds = new Set<number>();
    const safeMergePairs = await getSafeMergePairs(client, gardenIds);

    for (const [index, mergePair] of safeMergePairs.entries()) {
        try {
            await mergeRaisedBeds(
                mergePair.targetRaisedBedId,
                mergePair.sourceRaisedBedId,
            );
            console.log(
                `Merged pair ${mergePair.targetRaisedBedId} <- ${mergePair.sourceRaisedBedId} in garden ${mergePair.gardenId} (${index + 1}/${safeMergePairs.length})`,
            );
            synchronizedGardenIds.add(mergePair.gardenId);
        } catch (error) {
            failures.push({
                gardenId: mergePair.gardenId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    for (const gardenId of synchronizedGardenIds) {
        try {
            await synchronizeGardenStacksAndRaisedBeds(gardenId);
        } catch (error) {
            failures.push({
                gardenId,
                error: `Post-merge sync failed: ${error instanceof Error ? error.message : String(error)}`,
            });
        }
    }

    const after = await getMergeSnapshot(client, gardenIds);
    printSummary('after', after);

    if (failures.length > 0) {
        console.log(JSON.stringify({ failures }, null, 2));
        process.exitCode = 1;
    }
} finally {
    await client.end();
}
