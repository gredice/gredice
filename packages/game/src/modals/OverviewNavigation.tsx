import { List } from '@gredice/ui/List';
import { ListItem } from '@gredice/ui/ListItem';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Typography } from '@gredice/ui/Typography';
import { Fragment } from 'react';
import { overviewNavGroups, overviewNavItems } from './overviewNavigationItems';

const selectItems = overviewNavItems.map(({ icon, label, value }) => ({
    icon,
    label,
    value,
}));

export function OverviewNavigation({
    value,
    onValueChange,
}: {
    value?: string;
    onValueChange: (value: string) => void;
}) {
    return (
        <>
            <SelectItems
                className="md:hidden bg-card rounded-lg"
                placeholder="Odaberi odjeljak"
                value={value}
                onValueChange={onValueChange}
                items={selectItems}
            />
            <List
                className="md:pr-6 hidden md:flex"
                aria-label="Odjeljci profila"
            >
                {overviewNavGroups.map((group) => (
                    <Fragment key={group.label}>
                        <Typography
                            level="body3"
                            uppercase
                            bold
                            className="py-4"
                        >
                            {group.label}
                        </Typography>
                        {group.items.map((item) =>
                            item.href ? (
                                <ListItem
                                    key={item.nodeId}
                                    href={item.href}
                                    label={item.label}
                                    startDecorator={item.icon}
                                />
                            ) : (
                                <ListItem
                                    key={item.nodeId}
                                    nodeId={item.nodeId}
                                    label={item.label}
                                    startDecorator={item.icon}
                                    selected={value === item.value}
                                    onSelected={() => onValueChange(item.value)}
                                />
                            ),
                        )}
                    </Fragment>
                ))}
            </List>
        </>
    );
}
