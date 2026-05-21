import { Stack } from '@gredice/ui/Stack';
import { NotificationsTableCard } from '../../../../components/notifications/NotificationsTableCard';
import { auth } from '../../../../lib/auth/auth';
import { NotificationComposerClient } from './NotificationComposerClient';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
    await auth(['admin']);

    return (
        <Stack spacing={4}>
            <NotificationComposerClient />
            <NotificationsTableCard showAccountLabels limit={50} />
        </Stack>
    );
}
