import { Stack } from '@signalco/ui-primitives/Stack';
import { NotificationsTableCard } from '../../../../components/notifications/NotificationsTableCard';
import { auth } from '../../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
    await auth(['admin']);

    return (
        <Stack spacing={2}>
            <NotificationsTableCard showAccountLabels limit={50} />
        </Stack>
    );
}
