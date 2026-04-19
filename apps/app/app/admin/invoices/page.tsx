import { Add } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { InvoicesTable } from './InvoicesTable';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
    await auth(['admin']);

    return (
        <Stack spacing={2}>
            <Row spacing={1} justifyContent="space-between">
                <Button
                    variant="solid"
                    startDecorator={<Add className="size-5 shrink-0" />}
                    href={KnownPages.CreateInvoice}
                >
                    Nova ponuda
                </Button>
            </Row>
            <Card>
                <CardOverflow>
                    <InvoicesTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
