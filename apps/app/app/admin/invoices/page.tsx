import { Button } from '@gredice/ui/Button';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Add } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { InvoicesTable } from './InvoicesTable';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
    await auth(['admin']);

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                actions={
                    <Button
                        variant="solid"
                        startDecorator={<Add className="size-5 shrink-0" />}
                        href={KnownPages.CreateInvoice}
                    >
                        Nova ponuda
                    </Button>
                }
            />
            <Card>
                <CardOverflow>
                    <InvoicesTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
