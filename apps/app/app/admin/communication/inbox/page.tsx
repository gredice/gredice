import { Stack } from '@gredice/ui/Stack';
import { EmailsList } from './EmailsList';

export default function InboxPage() {
    return (
        <Stack spacing={4}>
            <EmailsList />
        </Stack>
    );
}
