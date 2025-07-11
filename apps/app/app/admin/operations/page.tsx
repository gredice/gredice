import { Stack } from "@signalco/ui-primitives/Stack";
import { auth } from "../../../lib/auth/auth";
import { Typography } from "@signalco/ui-primitives/Typography";
import { OperationsTable } from "../../../components/operations/OperationsTable";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";

export const dynamic = 'force-dynamic';

export default async function OperationsPage() {
    await auth(['admin']);

    return (
        <Stack spacing={2}>
            <Typography level="h1" className="text-2xl" semiBold>Radnje</Typography>
            <Card>
                <CardOverflow>
                    <OperationsTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}