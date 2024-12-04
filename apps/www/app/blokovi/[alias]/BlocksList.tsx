'use client';

import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { useParams } from "next/navigation";
import { orderBy } from "@signalco/js";
import { BlockData } from "../@types/BlockData";
import { BlockImage } from "../../../components/blocks/BlockImage";

export function BlocksList({ blockData }: { blockData: BlockData[] }) {
    const params = useParams<{ alias: string }>();
    const { alias } = params;
    const entitiesArray = orderBy(blockData, (a, b) => a.information.label.localeCompare(b.information.label));
    return (
        <List>
            {entitiesArray.map((entity) => {
                return (
                    <Link
                        key={entity.information.name}
                        href={KnownPages.Block(entity.information.label)}>
                        <ListItem
                            nodeId={entity.information.name}
                            selected={entity.information.label === alias}
                            onSelected={() => { }}
                            label={entity.information.label}
                            startDecorator={(
                                <BlockImage
                                    blockName={entity.information.name}
                                    width={32}
                                    height={32}
                                />
                            )} />
                    </Link>
                );
            })}
        </List>
    );
}