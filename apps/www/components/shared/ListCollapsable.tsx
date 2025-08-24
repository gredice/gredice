import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';

type ListCollapsableProps = {
    items: {
        value: string;
        label: string;
        icon: ReactElement;
        href: Route;
    }[];
    value: string;
};

export function ListCollapsable({ items, value }: ListCollapsableProps) {
    const router = useRouter();
    function handleValueChange(newValue: string) {
        const selectedItem = items.find((i) => i.value === newValue);
        if (selectedItem) {
            router.push(selectedItem.href);
        }
    }

    return (
        <>
            <SelectItems
                value={value}
                items={items}
                className="w-full md:hidden"
                onValueChange={handleValueChange}
            />
            <List className="hidden md:block">
                {items.map((item) => {
                    return (
                        <ListItem
                            key={item.value}
                            selected={item.label === value}
                            href={item.href}
                            label={item.label}
                            startDecorator={item.icon}
                        />
                    );
                })}
            </List>
        </>
    );
}