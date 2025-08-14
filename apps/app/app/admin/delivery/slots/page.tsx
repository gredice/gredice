import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Button } from "@signalco/ui-primitives/Button";
import { Row } from "@signalco/ui-primitives/Row";
import { Add, Calendar } from "@signalco/ui-icons";
import { auth } from "../../../../lib/auth/auth";
import { getPickupLocations } from "@gredice/storage";
import { TimeSlotsTable } from "./TimeSlotsTable";
import { CreateTimeSlotModal } from "./CreateTimeSlotModal";
import { BulkGenerateModal } from "./BulkGenerateModal";

export const dynamic = 'force-dynamic';

export default async function AdminTimeSlotsPage() {
    await auth(['admin']);

    const pickupLocations = await getPickupLocations();

    return (
        <Stack spacing={4}>
            <Row justifyContent="space-between">
                <Typography level="h1" className="text-2xl">Upravljanje vremenskim slotovima dostave</Typography>
                <Row spacing={2}>
                    <CreateTimeSlotModal
                        trigger={
                            <Button variant="solid" startDecorator={<Add className="size-4" />}>
                                Kreiraj slot
                            </Button>
                        }
                        locations={pickupLocations}
                    />
                    <BulkGenerateModal
                        trigger={
                            <Button variant="outlined" startDecorator={<Calendar className="size-4" />}>
                                Generiraj u bloku
                            </Button>
                        }
                        locations={pickupLocations}
                    />
                </Row>
            </Row>

            <Card>
                <CardOverflow>
                    <TimeSlotsTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
