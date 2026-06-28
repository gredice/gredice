import type { ChipProps } from '@gredice/ui/Chip';
import { Chip } from '@gredice/ui/Chip';
import { getDeliveryRequestModeLabel } from '../deliveryRequestUtils';

type DeliveryRequestModeChipProps = Omit<ChipProps, 'children' | 'color'> & {
    mode: string | null | undefined;
};

export function DeliveryRequestModeChip({
    mode,
    ...chipProps
}: DeliveryRequestModeChipProps) {
    return (
        <Chip color="primary" {...chipProps}>
            {getDeliveryRequestModeLabel(mode)}
        </Chip>
    );
}
