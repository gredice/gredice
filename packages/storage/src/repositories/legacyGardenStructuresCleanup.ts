import { sql } from 'drizzle-orm';
import { storage } from '../storage';

/**
 * Clears rows from the removed garden building tables while they still exist.
 *
 * `garden_structures` and `garden_structure_operations` reference gardens
 * through non-cascading foreign keys, so garden deletion must remove their
 * rows first. Migration 0093 drops both tables; this cleanup checks for each
 * table at run time so it is safe before and after that migration is applied,
 * which lets the code deploy first and the drop run afterwards. Remove this
 * helper once every environment has applied migration 0093.
 */
export async function deleteLegacyGardenStructureRows(gardenId: number) {
    if (!Number.isSafeInteger(gardenId)) {
        throw new Error('Garden id must be an integer.');
    }

    const id = sql.raw(gardenId.toString());
    await storage().execute(sql`
        do $legacy_garden_structures$
        begin
            if to_regclass('public.garden_structure_operations') is not null then
                delete from public.garden_structure_operations
                where garden_id = ${id};
            end if;
            if to_regclass('public.garden_structures') is not null then
                delete from public.garden_structures where garden_id = ${id};
            end if;
        end
        $legacy_garden_structures$;
    `);
}
