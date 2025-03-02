import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactElement } from "react";

export function ListCollapsable({items, value}: {items: {value: string, label: string, icon: ReactElement, href: string}[], value: string}) {
    const router = useRouter();
    return (
        <>
            <SelectItems
                value={value}
                items={items}
                className="w-full md:hidden"
                onValueChange={(newValue) => router.push(items.find(i => i.value === newValue)?.href ?? '#')} />
            <List className="hidden md:block">
                {items.map((item) => {
                    return (
                        <Link
                            key={item.value}
                            href={item.href}>
                            <ListItem
                                nodeId={item.value}
                                selected={item.label === value}
                                onSelected={() => { }}
                                label={item.label}
                                startDecorator={item.icon} />
                        </Link>
                    );
                })}
            </List>
        </>
    );
}