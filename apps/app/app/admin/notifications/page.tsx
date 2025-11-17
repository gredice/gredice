import { getAccounts, getNotifications } from '@gredice/storage';
import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { auth } from '../../../lib/auth/auth';
import { NewsNotificationForm } from './NewsNotificationForm';
import { NotificationsTable } from './NotificationsTable';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
    await auth(['admin']);

    const [accounts, notifications] = await Promise.all([
        getAccounts(),
        getNotifications(0, 200),
    ]);

    const accountOptions = accounts.map((account) => {
        const users =
            account.accountUsers
                ?.map((accountUser) => accountUser.user?.userName)
                .filter(Boolean) ?? [];

        return {
            id: account.id,
            label: users[0] ?? account.id,
            description: users.join(', ') || account.id,
        };
    });

    const accountLabels = accountOptions.reduce<Record<string, string>>(
        (lookup, account) => {
            lookup[account.id] = account.description;
            return lookup;
        },
        {},
    );

    return (
        <Stack spacing={2}>
            <Typography level="h1" className="text-2xl" semiBold>
                Obavijesti
            </Typography>

            <Card>
                <CardHeader>
                    <CardTitle>Pošalji novost</CardTitle>
                </CardHeader>
                <CardOverflow>
                    <NewsNotificationForm accounts={accountOptions} />
                </CardOverflow>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Popis obavijesti</CardTitle>
                </CardHeader>
                <CardOverflow>
                    <NotificationsTable
                        notifications={notifications}
                        accountLabels={accountLabels}
                    />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
