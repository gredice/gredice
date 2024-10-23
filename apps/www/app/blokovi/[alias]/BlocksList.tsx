'use client';

import { entities } from "../../../../../packages/game/src/data/entities";
import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { KnownPages } from "../../../src/KnownPages";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { orderBy } from "@signalco/js";

export function BlocksList() {
    const params = useParams<{ alias: string }>();
    const { alias } = params;
    const entitiesArray = orderBy(Object.keys(entities) as Array<keyof typeof entities>, (a, b) => entities[a].alias.localeCompare(entities[b].alias));
    return (
        <List>
            {entitiesArray.map((entityKey) => {
                const entity = entities[entityKey];
                return (
                    <Link
                        key={entity.name}
                        href={KnownPages.Block(entity.alias)}>
                        <ListItem
                            nodeId={entity.name}
                            selected={entity.alias === alias}
                            onSelected={() => { }}
                            label={entity.alias}
                            startDecorator={(
                                <Image
                                    src={`/assets/blocks/${entity.name}.png`}
                                    width={32}
                                    height={32}
                                    alt={entity.alias}
                                />
                            )} />
                    </Link>
                );
            })}
        </List>
    );
}