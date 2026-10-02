import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as schema from '../../src/schema';
import { gardenPackIntegritySql } from '../../src/schema/gardenPackIntegrity';

export { gardenPackIntegritySql, schema };

/** Disposable database DDL derived from current source; never apply to a service database. */
export async function getGardenPackTestDdl() {
    const statements = await generateMigration(
        generateDrizzleJson({}),
        generateDrizzleJson(schema),
    );
    const priority = (statement: string) =>
        statement.startsWith('CREATE TYPE')
            ? 0
            : statement.startsWith('CREATE TABLE')
              ? 1
              : /CREATE (UNIQUE )?INDEX/.test(statement)
                ? 2
                : 3;
    return statements.sort((left, right) => priority(left) - priority(right));
}
