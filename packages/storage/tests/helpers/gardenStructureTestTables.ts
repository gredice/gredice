import { sql } from 'drizzle-orm';
import { storage } from '../../src/storage';

let setupPromise: Promise<void> | null = null;

/**
 * Temporary test-only DDL while the coordinated garden-structure migration is
 * intentionally generated outside this implementation slice. The 8 MiB JSONB
 * constraints deliberately mirror the schema's defensive persistence ceiling;
 * repository canonicalization owns the much smaller 192 KiB product limit.
 */
export function ensureGardenStructureTestTables() {
    setupPromise ??= (async () => {
        const statements = [
            `
            create table if not exists garden_structures (
                id text primary key,
                garden_id integer not null references gardens(id),
                anchor_x integer not null,
                anchor_y integer not null,
                rotation integer not null default 0,
                revision integer not null default 1,
                template_key text not null,
                kit_key text not null,
                kit_version text not null,
                pricing_version integer not null default 1,
                sunflower_price_per_cell integer not null default 50,
                refundable_sunflower_principal integer not null default 0,
                document jsonb not null,
                created_at timestamp not null default now(),
                updated_at timestamp not null default now(),
                is_deleted boolean not null default false,
                constraint garden_structures_garden_id_id_uq unique (garden_id, id),
                constraint garden_structures_id_length_check check (char_length(id) between 1 and 96),
                constraint garden_structures_rotation_check check (rotation between 0 and 3),
                constraint garden_structures_revision_check check (revision > 0),
                constraint garden_structures_template_key_check check (template_key in ('barn', 'house', 'greenhouse', 'blank')),
                constraint garden_structures_kit_key_length_check check (char_length(kit_key) between 1 and 96),
                constraint garden_structures_kit_version_length_check check (char_length(kit_version) between 1 and 96),
                constraint garden_structures_pricing_version_check check (pricing_version > 0),
                constraint garden_structures_unit_price_check check (sunflower_price_per_cell >= 0),
                constraint garden_structures_refundable_principal_check check (refundable_sunflower_principal >= 0),
                constraint garden_structures_document_shape_check check (jsonb_typeof(document) = 'object' and document->>'schemaVersion' = '1' and coalesce(jsonb_typeof(document->'footprint'->'cells'), '') = 'array'),
                constraint garden_structures_document_size_check check (octet_length(document::text) <= 8388608),
                constraint garden_structures_principal_bound_check check (refundable_sunflower_principal <= jsonb_array_length(document->'footprint'->'cells') * sunflower_price_per_cell),
                constraint garden_structures_deleted_principal_check check (is_deleted = false or refundable_sunflower_principal = 0)
            )
            `,
            `create index if not exists garden_structures_active_garden_id_idx
                on garden_structures (garden_id, id) where is_deleted = false`,
            `create index if not exists garden_structures_is_deleted_idx
                on garden_structures (is_deleted)`,
            `
            create table if not exists garden_structure_operations (
                garden_id integer not null references gardens(id),
                operation_id text not null,
                structure_id text not null,
                kind text not null,
                payload_hash text not null,
                response jsonb not null,
                result_revision integer not null,
                created_at timestamp not null default now(),
                constraint garden_structure_operations_garden_operation_pk primary key (garden_id, operation_id),
                constraint garden_structure_operations_garden_structure_fk foreign key (garden_id, structure_id) references garden_structures(garden_id, id),
                constraint garden_structure_operations_operation_id_length_check check (char_length(operation_id) between 1 and 96),
                constraint garden_structure_operations_kind_check check (kind in ('create', 'replace', 'resize', 'placement', 'delete')),
                constraint garden_structure_operations_payload_hash_check check (payload_hash ~ '^[0-9a-f]{64}$'),
                constraint garden_structure_operations_response_shape_check check (jsonb_typeof(response) = 'object'),
                constraint garden_structure_operations_response_size_check check (octet_length(response::text) <= 8388608),
                constraint garden_structure_operations_result_revision_check check (result_revision > 0)
            )
            `,
            `create index if not exists garden_structure_operations_structure_id_idx
                on garden_structure_operations (structure_id)`,
        ];
        for (const statement of statements) {
            await storage().execute(sql.raw(statement));
        }
    })();
    return setupPromise;
}
