import Link from "next/link";
import { entities } from "../../../../packages/game/src/data/entities";
import { KnownPages } from "../../src/KnownPages";

export default function BlocksPage() {
    return (
        <div>
            {(Object.keys(entities) as Array<keyof typeof entities>).map((entityKey) => {
                const entity = entities[entityKey];
                return (
                    <Link key={entity.alias} href={KnownPages.Block(entity.alias)}>
                        {entity.alias}
                    </Link>
                );
            })}
        </div>
    );
}