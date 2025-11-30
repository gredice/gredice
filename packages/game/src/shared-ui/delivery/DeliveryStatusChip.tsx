import { Approved, Close, Info, Timer } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';

function getStatusColor(state: string) {
    switch (state) {
        case 'pending':
            return 'warning';
        case 'scheduled':
        case 'confirmed':
            return 'info';
        case 'preparing':
            return 'info';
        case 'ready':
            return 'info';
        case 'fulfilled':
            return 'success';
        case 'cancelled':
            return 'error';
        default:
            return 'neutral';
    }
}

function getStatusLabel(state: string) {
    switch (state) {
        case 'pending':
            return 'Na čekanju';
        case 'scheduled':
            return 'Zakazano';
        case 'confirmed':
            return 'Zakazano';
        case 'preparing':
            return 'Priprema';
        case 'ready':
            return 'Spremno';
        case 'fulfilled':
            return 'Izvršeno';
        case 'cancelled':
            return 'Otkazano';
        default:
            return state;
    }
}

function getStatusIcon(state: string) {
    switch (state) {
        case 'pending':
            return <Timer className="size-4" />;
        case 'scheduled':
        case 'confirmed':
            return <Approved className="size-4" />;
        case 'preparing':
            return <Info className="size-4" />;
        case 'ready':
        case 'fulfilled':
            return <Approved className="size-4" />;
        case 'cancelled':
            return <Close className="size-4" />;
        default:
            return <Timer className="size-4" />;
    }
}

export function DeliveryStatusChip({ state }: { state: string }) {
    return (
        <Chip
            color={getStatusColor(state)}
            startDecorator={getStatusIcon(state)}
        >
            {getStatusLabel(state)}
        </Chip>
    );
}
