import { Stack } from '@signalco/ui-primitives/Stack';
import { EmailsList } from './EmailsList';

export default function InboxPage() {
    return (
        <Stack spacing={2}>
            <EmailsList />
        </Stack>
    );
}
