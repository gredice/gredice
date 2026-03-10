import { Client } from 'pg';

const FIELD_EVENT_TYPES = [
    'raisedBedField.create',
    'raisedBedField.delete',
    'raisedBedField.plantPlace',
    'raisedBedField.plantSchedule',
    'raisedBedField.plantUpdate',
    'raisedBedField.plantReplaceSort',
] as const;

const DEFAULT_PHYSICAL_IDS = [
    '1',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '13',
    '14',
    '15',
];
const PHYSICAL_ONE_BED_ID = 5;
const PHYSICAL_ONE_REPAIR_POSITIONS = [9, 10, 11, 12, 13, 14, 15];

type Args = {
    execute: boolean;
    physicalIds: string[];
};

type OrphanField = {
    physicalId: string;
    raisedBedId: number;
    fieldId: number;
    positionIndex: number;
    createdAt: string;
};

type PhysicalOneField = {
    fieldId: number;
    currentPositionIndex: number;
    plantSortId: string;
};

type PhysicalOneCartItem = {
    cartItemId: number;
    targetPositionIndex: number;
    plantSortId: string;
};

type PositionRepairMapping = {
    fieldId: number;
    fromPositionIndex: number;
    toPositionIndex: number;
    plantSortId: string;
};

function parseArgs(): Args {
    const args = process.argv.slice(2);
    const execute = args.includes('--execute');
    const physicalIdsArg = args.find((arg) =>
        arg.startsWith('--physical-ids='),
    );

    return {
        execute,
        physicalIds: physicalIdsArg
            ? physicalIdsArg
                  .slice('--physical-ids='.length)
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean)
            : DEFAULT_PHYSICAL_IDS,
    };
}

async function getOrphanFields(
    client: Client,
    physicalIds: string[],
): Promise<OrphanField[]> {
    const result = await client.query<{
        physical_id: string;
        raised_bed_id: number;
        field_id: number;
        position_index: number;
        created_at: Date;
    }>(
        `
            with event_counts as (
                select
                    split_part(aggregate_id, '|', 1)::int as raised_bed_id,
                    split_part(aggregate_id, '|', 2)::int as position_index,
                    count(*) filter (
                        where type in (
                            'raisedBedField.create',
                            'raisedBedField.delete',
                            'raisedBedField.plantPlace',
                            'raisedBedField.plantSchedule',
                            'raisedBedField.plantUpdate',
                            'raisedBedField.plantReplaceSort'
                        )
                    ) as event_count
                from events
                where aggregate_id like '%|%'
                group by 1, 2
            )
            select
                rb.physical_id,
                f.raised_bed_id,
                f.id as field_id,
                f.position_index,
                f.created_at
            from raised_bed_fields f
            join raised_beds rb on rb.id = f.raised_bed_id
            left join event_counts ec
                on ec.raised_bed_id = f.raised_bed_id
               and ec.position_index = f.position_index
            where rb.is_deleted = false
              and f.is_deleted = false
              and rb.physical_id = any($1::text[])
              and coalesce(ec.event_count, 0) = 0
            order by rb.physical_id::int, f.position_index, f.id
        `,
        [physicalIds],
    );

    return result.rows.map((row) => ({
        physicalId: row.physical_id,
        raisedBedId: row.raised_bed_id,
        fieldId: row.field_id,
        positionIndex: row.position_index,
        createdAt: row.created_at.toISOString(),
    }));
}

async function getPhysicalOneRepairMappings(
    client: Client,
): Promise<PositionRepairMapping[]> {
    const fieldsResult = await client.query<{
        field_id: number;
        current_position_index: number;
        plant_sort_id: string;
    }>(
        `
            select
                f.id as field_id,
                f.position_index as current_position_index,
                e.data->>'plantSortId' as plant_sort_id
            from raised_bed_fields f
            join events e
              on e.aggregate_id =
                 f.raised_bed_id::text || '|' || f.position_index::text
             and e.type = 'raisedBedField.plantPlace'
            where f.raised_bed_id = $1
              and f.is_deleted = false
              and f.position_index = any($2::int[])
            order by f.position_index asc, e.created_at asc, e.id asc
        `,
        [PHYSICAL_ONE_BED_ID, PHYSICAL_ONE_REPAIR_POSITIONS],
    );

    const fields = fieldsResult.rows.map((row) => ({
        fieldId: row.field_id,
        currentPositionIndex: row.current_position_index,
        plantSortId: row.plant_sort_id,
    })) satisfies PhysicalOneField[];

    if (fields.length !== 7) {
        throw new Error(
            `Unexpected physical 1 repair shape: ${fields.length} fields.`,
        );
    }

    const cartItemsResult = await client.query<{
        cart_item_id: number;
        target_position_index: number;
        plant_sort_id: string;
    }>(
        `
            select
                id as cart_item_id,
                position_index as target_position_index,
                entity_id as plant_sort_id
            from shopping_cart_items
            where raised_bed_id = $1
              and entity_type_name = 'plantSort'
              and status = 'paid'
              and is_deleted = false
              and entity_id = any($2::text[])
            order by position_index asc, created_at asc, id asc
        `,
        [PHYSICAL_ONE_BED_ID, fields.map((field) => field.plantSortId)],
    );

    const cartItems = cartItemsResult.rows.map((row) => ({
        cartItemId: row.cart_item_id,
        targetPositionIndex: row.target_position_index,
        plantSortId: row.plant_sort_id,
    })) satisfies PhysicalOneCartItem[];

    if (cartItems.length !== 7) {
        throw new Error(
            `Unexpected physical 1 paid cart shape: ${cartItems.length} cart items.`,
        );
    }

    const cartBySortId = new Map<string, PhysicalOneCartItem>();
    for (const item of cartItems) {
        if (cartBySortId.has(item.plantSortId)) {
            throw new Error(
                `Physical 1 repair is ambiguous for plant sort ${item.plantSortId}.`,
            );
        }
        cartBySortId.set(item.plantSortId, item);
    }

    return fields.map((field) => {
        const cartItem = cartBySortId.get(field.plantSortId);
        if (!cartItem) {
            throw new Error(
                `No paid cart item found for physical 1 plant sort ${field.plantSortId}.`,
            );
        }

        return {
            fieldId: field.fieldId,
            fromPositionIndex: field.currentPositionIndex,
            toPositionIndex: cartItem.targetPositionIndex,
            plantSortId: field.plantSortId,
        };
    });
}

async function deleteOrphanFields(client: Client, orphanFields: OrphanField[]) {
    const fieldIds = orphanFields.map((field) => field.fieldId);
    if (fieldIds.length === 0) {
        return;
    }

    await client.query(
        `
            update raised_bed_fields
            set is_deleted = true
            where id = any($1::int[])
        `,
        [fieldIds],
    );
}

async function repairPhysicalOne(
    client: Client,
    mappings: PositionRepairMapping[],
) {
    if (mappings.length === 0) {
        return;
    }

    const cases = mappings
        .map(
            (_mapping, index) =>
                `when $${index * 2 + 1}::int then $${index * 2 + 2}::int`,
        )
        .join(' ');
    const caseParams = mappings.flatMap((mapping) => [
        mapping.fieldId,
        mapping.toPositionIndex,
    ]);
    const fieldIds = mappings.map((mapping) => mapping.fieldId);

    await client.query(
        `
            update raised_bed_fields
            set position_index = case id ${cases} end
            where id = any($${caseParams.length + 1}::int[])
        `,
        [...caseParams, fieldIds],
    );

    const sortedMappings = [...mappings].sort(
        (left, right) => right.fromPositionIndex - left.fromPositionIndex,
    );

    for (const mapping of sortedMappings) {
        await client.query(
            `
                update events
                set aggregate_id = $1
                where aggregate_id = $2
                  and type = any($3::text[])
            `,
            [
                `${PHYSICAL_ONE_BED_ID}|${mapping.toPositionIndex}`,
                `${PHYSICAL_ONE_BED_ID}|${mapping.fromPositionIndex}`,
                FIELD_EVENT_TYPES,
            ],
        );
    }
}

function printSummary(
    orphanFields: OrphanField[],
    physicalOneMappings: PositionRepairMapping[],
) {
    console.log(
        JSON.stringify(
            {
                orphanFields,
                physicalOneMappings,
            },
            null,
            2,
        ),
    );
}

const { execute, physicalIds } = parseArgs();

if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable is not set.');
}

const client = new Client({ connectionString: process.env.POSTGRES_URL });

await client.connect();

try {
    if (execute) {
        await client.query('begin');
    }

    const [orphanFields, physicalOneMappings] = await Promise.all([
        getOrphanFields(client, physicalIds),
        physicalIds.includes('1')
            ? getPhysicalOneRepairMappings(client)
            : Promise.resolve([]),
    ]);

    printSummary(orphanFields, physicalOneMappings);

    if (execute) {
        await deleteOrphanFields(client, orphanFields);
        await repairPhysicalOne(client, physicalOneMappings);
        await client.query('commit');
        console.log(
            `Deleted ${orphanFields.length} orphan fields and repaired ${physicalOneMappings.length} physical 1 positions.`,
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
