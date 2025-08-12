import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { auth } from "../../../../lib/auth/auth";
import { getPickupLocations } from "@gredice/storage";
import { TimeSlotsTable } from "./TimeSlotsTable";
import { CreateTimeSlotForm } from "./CreateTimeSlotForm";
import { BulkGenerateForm } from "./BulkGenerateForm";

export const dynamic = 'force-dynamic';

export default async function AdminTimeSlotsPage() {
    await auth(['admin']);

    const pickupLocations = await getPickupLocations();

    return (
        <Stack spacing={4}>
            <Typography level="h1" className="text-2xl" semiBold>Upravljanje vremenskim slotovima dostave</Typography>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CreateTimeSlotForm locations={pickupLocations} />
                <BulkGenerateForm locations={pickupLocations} />
            </div>

            <Card>
                <CardOverflow>
                    <TimeSlotsTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
