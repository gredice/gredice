'use client';

import { Chip } from '@signalco/ui-primitives/Chip';
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

const occasions = [
    {
        href: '/legalno/natjecaji/adventski-kalendar-2025' satisfies Route,
        label: 'Adventski kalendar 2025',
        endDate: new Date('2025-12-25T23:59:59'),
    },
];

export function OccasionsFilesMenu() {
    const pathname = usePathname();
    const now = new Date();

    return (
        <List variant="outlined" className="bg-card">
            {occasions.map((occasion) => {
                const isExpired = now > occasion.endDate;
                return (
                    <ListItem
                        key={occasion.href}
                        selected={(pathname as Route) === occasion.href}
                        href={occasion.href}
                        label={occasion.label}
                        variant="outlined"
                        endDecorator={
                            <Chip color={isExpired ? 'neutral' : 'success'}>
                                {isExpired ? 'Završeno' : 'U tijeku'}
                            </Chip>
                        }
                    />
                );
            })}
        </List>
    );
}
