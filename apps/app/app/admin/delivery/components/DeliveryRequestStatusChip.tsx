import type { ChipProps } from '@gredice/ui/Chip';
import { Chip } from '@gredice/ui/Chip';
import {
    getDeliveryRequestStatusColor,
    getDeliveryRequestStatusLabel,
} from '../deliveryRequestUtils';

type DeliveryRequestStatusChipProps = Omit<ChipProps, 'children' | 'color'> & {
    status: string;
};

export function DeliveryRequestStatusChip({
    status,
    ...chipProps
}: DeliveryRequestStatusChipProps) {
    return (
        <Chip color={getDeliveryRequestStatusColor(status)} {...chipProps}>
            {getDeliveryRequestStatusLabel(status)}
        </Chip>
    );
}
