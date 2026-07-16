import { CustomerDashboard } from '../components/CustomerDashboard';
import type {
    CustomerDeliveryDashboard,
    CustomerDeliveryDashboardRequest,
    CustomerDeliveryRequestSummary,
    CustomerPickupRequestSummary,
} from '../lib/deliveryDashboardTypes';

const delivery: CustomerDeliveryRequestSummary = {
    mode: 'delivery',
    requestId: 'customer-delivery-4135',
    status: 'ready',
    statusLabel: 'Vozač stiže',
    requestNotes: 'Pozvoni na portafon.',
    slotStartAt: '2026-07-16T08:00:00.000Z',
    slotEndAt: '2026-07-16T10:00:00.000Z',
    estimatedArrivalAt: '2026-07-16T09:00:00.000Z',
    estimatedTravelSeconds: 900,
    estimatedDistanceMeters: 5_000,
    reroutePending: false,
    deliveredAt: null,
    harvest: {
        plantName: 'Rajčica za dostavu',
        operationName: 'Berba',
        raisedBedName: 'Gredica 4',
        fieldName: 'Polje 2',
        tracePath: '/trag/customer-delivery-4135',
    },
    receipt: null,
    recovery: null,
    tracking: {
        status: 'live',
        lastAcceptedAt: '2026-07-16T08:45:00.000Z',
        mapAvailable: true,
    },
    mapPath: '/api/map/customer-mixed-run-4135',
};

const readyPickup: CustomerPickupRequestSummary = {
    mode: 'pickup',
    requestId: 'customer-pickup-ready-4135',
    status: 'ready',
    statusLabel: 'Spremno za preuzimanje',
    requestNotes: 'Donijet ću svoju košaru.',
    slotStartAt: '2026-07-16T12:00:00.000Z',
    slotEndAt: '2026-07-16T14:00:00.000Z',
    harvest: {
        plantName:
            'Vrlo dugačka sorta salate za provjeru prikaza na uskom zaslonu',
        operationName: 'Berba',
        raisedBedName: 'Gredica 8',
        fieldName: 'Polje 1',
        tracePath: '/trag/customer-pickup-ready-4135',
    },
    location: {
        name: 'Gredice HQ',
        address: 'Vrtna 1, 10000 Zagreb, HR',
        instructions:
            'Urod je spreman. Preuzmi ga na ovoj lokaciji tijekom odabranog termina.',
    },
    pickedUpAt: null,
};

const fulfilledPickup: CustomerPickupRequestSummary = {
    ...readyPickup,
    requestId: 'customer-pickup-fulfilled-4135',
    status: 'fulfilled',
    statusLabel: 'Preuzeto',
    requestNotes: null,
    harvest: {
        ...readyPickup.harvest,
        plantName: 'Mrkva za osobno preuzimanje',
        tracePath: null,
    },
    location: {
        name: 'Gredice HQ',
        address: 'Vrtna 1, 10000 Zagreb, HR',
        instructions: 'Preuzimanje uroda je evidentirano.',
    },
    pickedUpAt: '2026-07-16T13:15:00.000Z',
};

function dashboard({
    role,
    deliveries,
}: {
    role: 'user' | 'farmer';
    deliveries: CustomerDeliveryDashboardRequest[];
}): CustomerDeliveryDashboard {
    return {
        kind: 'customer',
        user: {
            id: `customer-${role}-4135`,
            displayName: role === 'farmer' ? 'Farmer Fran' : 'Korisnik Korina',
            role,
        },
        deliveries,
        refreshedAt: '2026-07-16T09:00:00.000Z',
    };
}

export function MixedCustomerDashboardStory() {
    return (
        <CustomerDashboard
            dashboard={dashboard({
                role: 'user',
                deliveries: [delivery, readyPickup],
            })}
        />
    );
}

export function PickupFarmerDashboardStory() {
    return (
        <CustomerDashboard
            dashboard={dashboard({
                role: 'farmer',
                deliveries: [readyPickup, fulfilledPickup],
            })}
        />
    );
}

export function DeliveryUserDashboardStory() {
    return (
        <CustomerDashboard
            dashboard={dashboard({
                role: 'user',
                deliveries: [delivery],
            })}
        />
    );
}

export function EmptyCustomerDashboardStory() {
    return (
        <CustomerDashboard
            dashboard={dashboard({ role: 'user', deliveries: [] })}
        />
    );
}
