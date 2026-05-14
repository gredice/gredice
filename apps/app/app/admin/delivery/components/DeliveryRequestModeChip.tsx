import { Chip } from '@signalco/ui-primitives/Chip';
import { getDeliveryRequestModeLabel } from '../deliveryRequestUtils';

export function DeliveryRequestModeChip({
    mode,
}: {
    mode: string | null | undefined;
}) {
    return (
        <Chip color="primary" className="w-fit">
            {getDeliveryRequestModeLabel(mode)}
        </Chip>
    );
}
