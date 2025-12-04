import { Navigate } from '@signalco/ui-icons';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';

const apis = [
    { label: '/api/auth', href: '/docs/auth' },
    { label: '/api/accounts', href: '/docs/accounts' },
    { label: '/api/users', href: '/docs/users' },
    { label: '/api/directories', href: '/docs/directories' },
    { label: '/api/data', href: '/docs/data' },
    { label: '/api/gardens', href: '/docs/gardens' },
    { label: '/api/feedback', href: '/docs/feedback' },
    { label: '/api/occasions', href: '/docs/occasions' },
    { label: '/api/shopping-cart', href: '/docs/shopping-cart' },
    { label: '/api/checkout', href: '/docs/checkout' },
    { label: '/api/delivery', href: '/docs/delivery' },
    { label: '/api/notifications', href: '/docs/notifications' },
];

export default function Home() {
    return (
        <Stack spacing={1} className="p-4">
            <Typography level="body2">API Reference</Typography>
            <Card>
                <CardOverflow>
                    <List variant="outlined">
                        {apis.map(({ label, href }) => (
                            <ListItem
                                key={label}
                                variant="outlined"
                                label={label}
                                href={href}
                                endDecorator={<Navigate />}
                            />
                        ))}
                    </List>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
