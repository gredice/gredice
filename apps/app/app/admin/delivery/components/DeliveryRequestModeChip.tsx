import { Chip } from '@gredice/ui/Chip';
import { getDeliveryRequestModeLabel } from '../deliveryRequestUtils';

export function DeliveryRequestModeChip({
    mode,
}: {
    mode: string | null | undefined;
}) {
    return (
        <Chip color="primary">
            {getDeliveryRequestModeLabel(mode)}
        </Chip>
    );
}
