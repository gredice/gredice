import { getAccount, getEvents, knownEventTypes } from '@gredice/storage';
import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import type { ReactNode } from 'react';
import { EventsTable } from '../../../../components/shared/events/EventsTable';

interface AccountEventsCardProps {
    accountId: string;
}

const ACCOUNT_EVENT_TYPE_LABELS: Record<string, string> = {
    [knownEventTypes.accounts.create]: 'Račun stvoren',
    [knownEventTypes.accounts.assignUser]: 'Korisnik dodan',
    [knownEventTypes.accounts.earnSunflowers]: 'Dodani suncokreti',
    [knownEventTypes.accounts.spendSunflowers]: 'Potrošeni suncokreti',
};

const ACCOUNT_EVENT_TYPES = Object.values(knownEventTypes.accounts);

type AccountEvent = Awaited<ReturnType<typeof getEvents>>[number];

type AccountUserLabels = Map<string, string>;

function renderEventDetails(
    event: AccountEvent,
    userLabels: AccountUserLabels,
): ReactNode {
    const data =
        event.data && typeof event.data === 'object'
            ? (event.data as Record<string, unknown>)
            : null;

    if (event.type === knownEventTypes.accounts.assignUser) {
        const userId =
            typeof data?.userId === 'string' ? data.userId : undefined;
        if (!userId) {
            return null;
        }

        const userLabel = userLabels.get(userId) ?? userId;
        return <span key="user">Korisnik: {userLabel}</span>;
    }

    if (
        event.type === knownEventTypes.accounts.earnSunflowers ||
        event.type === knownEventTypes.accounts.spendSunflowers
    ) {
        const amountValue = data?.amount;
        const amount =
            typeof amountValue === 'number'
                ? amountValue
                : typeof amountValue === 'string'
                  ? Number.parseFloat(amountValue)
                  : undefined;
        const reason =
            typeof data?.reason === 'string' ? data.reason : undefined;

        const details: ReactNode[] = [];
        if (typeof amount === 'number' && !Number.isNaN(amount)) {
            details.push(<span key="amount">Iznos: {amount}</span>);
        }
        if (reason) {
            details.push(<span key="reason">Razlog: {reason}</span>);
        }

        if (details.length > 0) {
            return (
                <Stack spacing={0.5} className="text-sm">
                    {details}
                </Stack>
            );
        }

        return null;
    }

    return null;
}

export async function AccountEventsCard({ accountId }: AccountEventsCardProps) {
    const [events, account] = await Promise.all([
        getEvents(ACCOUNT_EVENT_TYPES, [accountId], 0, 10000),
        getAccount(accountId),
    ]);

    const userLabels: AccountUserLabels = new Map();
    for (const accountUser of account?.accountUsers ?? []) {
        if (!accountUser.user) {
            continue;
        }
        const { id, userName, email } = accountUser.user;
        userLabels.set(id, userName ?? email ?? id);
    }

    const sortedEvents = [...events].sort(
        (first, second) =>
            second.createdAt.getTime() - first.createdAt.getTime(),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Događaji</CardTitle>
            </CardHeader>
            <CardOverflow className="overflow-auto">
                <EventsTable
                    events={sortedEvents}
                    renderType={(event) =>
                        ACCOUNT_EVENT_TYPE_LABELS[event.type] ?? event.type
                    }
                    renderDetails={(event) =>
                        renderEventDetails(event, userLabels)
                    }
                    labels={{ details: 'Detalji' }}
                />
            </CardOverflow>
        </Card>
    );
}
