import { Chip } from '@gredice/ui/Chip';
import {
    getDeliveryRequestStatusColor,
    getDeliveryRequestStatusLabel,
} from '../deliveryRequestUtils';

export function DeliveryRequestStatusChip({ status }: { status: string }) {
    return (
        <Chip color={getDeliveryRequestStatusColor(status)} className="w-fit">
            {getDeliveryRequestStatusLabel(status)}
        </Chip>
    );
}
