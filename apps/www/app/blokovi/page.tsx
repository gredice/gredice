import { entities } from "../../../../packages/game/src/data/entities";
import { KnownPages } from "../../src/KnownPages";
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from "@signalco/ui-primitives/ListItem";

export default function BlocksPage() {
    return (
        <List>
            {(Object.keys(entities) as Array<keyof typeof entities>).map((entityKey) => {
                const entity = entities[entityKey];
                return (
                    <ListItem
                        key={entity.name}
                        label={entity.alias}
                        href={KnownPages.Block(entity.alias)} />
                );
            })}
        </List>
    );
}