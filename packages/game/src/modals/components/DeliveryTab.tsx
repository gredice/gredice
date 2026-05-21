import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { DeliveryAddressesSection } from '../../shared-ui/delivery/DeliveryAddressesSection';
import { DeliveryRequestsSection } from '../../shared-ui/delivery/DeliveryRequestsSection';

export function DeliveryTab() {
    return (
        <Stack spacing={8}>
            <Typography level="h4" className="hidden md:block">
                🚚 Dostava
            </Typography>
            <Stack
                spacing={4}
                className="overflow-y-auto max-h-[calc(100dvh-200px)]"
            >
                <Stack spacing={4}>
                    <DeliveryAddressesSection />
                </Stack>
                <Stack spacing={4}>
                    <DeliveryRequestsSection />
                </Stack>
            </Stack>
        </Stack>
    );
}
