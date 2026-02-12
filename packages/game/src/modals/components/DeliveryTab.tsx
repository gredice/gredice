import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { DeliveryAddressesSection } from '../../shared-ui/delivery/DeliveryAddressesSection';
import { DeliveryRequestsSection } from '../../shared-ui/delivery/DeliveryRequestsSection';

export function DeliveryTab() {
    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">
                🚚 Dostava
            </Typography>
            <Stack
                spacing={2}
                className="overflow-y-auto max-h-[calc(100dvh-200px)]"
            >
                <Stack spacing={2}>
                    <DeliveryAddressesSection />
                </Stack>
                <Stack spacing={2}>
                    <DeliveryRequestsSection />
                </Stack>
            </Stack>
        </Stack>
    );
}
