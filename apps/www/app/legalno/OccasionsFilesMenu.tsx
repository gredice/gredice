'use client';

import type { OccasionData } from '@gredice/client';
import { slugify } from '@gredice/js/slug';
import { Chip } from '@signalco/ui-primitives/Chip';
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

type OccasionsFilesMenuProps = {
    occasions: OccasionData[];
};

export function OccasionsFilesMenu({ occasions }: OccasionsFilesMenuProps) {
    const pathname = usePathname();
    const now = new Date();

    return (
        <List variant="outlined" className="bg-card">
            {occasions.map((occasion) => {
                const endDate = occasion.information.endDate
                    ? new Date(occasion.information.endDate)
                    : null;
                const startDate = new Date(occasion.information.startDate);
                const isExpired = endDate ? now > endDate : false;
                const hasStarted = now >= startDate;
                const href =
                    `/legalno/natjecaji/${slugify(occasion.information.name)}` as Route;

                return (
                    <ListItem
                        key={occasion.id}
                        selected={(pathname as Route) === href}
                        href={href}
                        label={occasion.information.name}
                        variant="outlined"
                        endDecorator={
                            <Chip
                                color={
                                    isExpired
                                        ? 'neutral'
                                        : hasStarted
                                          ? 'success'
                                          : 'warning'
                                }
                            >
                                {isExpired
                                    ? 'Završeno'
                                    : hasStarted
                                      ? 'U tijeku'
                                      : 'Uskoro'}
                            </Chip>
                        }
                    />
                );
            })}
        </List>
    );
}
