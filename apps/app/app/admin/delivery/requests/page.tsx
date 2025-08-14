import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { auth } from "../../../../lib/auth/auth";
import { DeliveryRequestsTable } from "./DeliveryRequestsTable";
import { DeliveryRequestsFilters } from "./DeliveryRequestsFilters";

export const dynamic = 'force-dynamic';

export default async function AdminDeliveryRequestsPage() {
    await auth(['admin']);

    return (
        <Stack spacing={2}>
            <Typography level="h1" className="text-2xl" semiBold>Upravljanje zahtjevima za dostavu</Typography>
            <DeliveryRequestsFilters />
            <Card>
                <CardOverflow>
                    <DeliveryRequestsTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
