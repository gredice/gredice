import {
    getAccount,
    getEventsByAggregateIds,
    knownEventTypes,
} from '@gredice/storage';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import type { ReactNode } from 'react';
import { EventsTable } from '../../../../components/shared/events/EventsTable';

interface AccountEventsCardProps {
    accountId: string;
}

const ACCOUNT_EVENT_TYPE_LABELS: Record<string, string> = {
    [knownEventTypes.accounts.create]: 'Račun stvoren',
    [knownEventTypes.accounts.assignUser]: 'Korisnik dodan',
    [knownEventTypes.accounts.earnSunflowers]: 'Dodani suncokreti',
    [knownEventTypes.accounts.referral]: 'Preporuka',
    [knownEventTypes.accounts.spendSunflowers]: 'Potrošeni suncokreti',
};

type AccountEvent = Awaited<ReturnType<typeof getEventsByAggregateIds>>[number];

type AccountUserLabels = Map<string, string>;

function renderJsonDetails(data: Record<string, unknown>) {
    return (
        <pre className="text-xs whitespace-pre-wrap font-mono">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
}

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
                <Stack spacing={1} className="text-sm">
                    {details}
                </Stack>
            );
        }

        return null;
    }

    if (event.type === knownEventTypes.accounts.referral) {
        const action =
            typeof data?.action === 'string' ? data.action : undefined;
        const code = typeof data?.code === 'string' ? data.code : undefined;
        const ownerAccountId =
            typeof data?.ownerAccountId === 'string'
                ? data.ownerAccountId
                : undefined;
        const referredAccountId =
            typeof data?.referredAccountId === 'string'
                ? data.referredAccountId
                : undefined;
        const source =
            typeof data?.source === 'string' ? data.source : undefined;
        const amount =
            typeof data?.amount === 'number' ? data.amount : undefined;
        const rewarded =
            typeof data?.rewarded === 'boolean' ? data.rewarded : undefined;

        const details: ReactNode[] = [];
        if (action === 'code_set') {
            details.push(<span key="action">Akcija: postavljen kod</span>);
        } else if (action === 'used_code') {
            details.push(<span key="action">Akcija: iskorišten kod</span>);
        } else if (action === 'used_code_cleared') {
            details.push(<span key="action">Akcija: očišćen kod</span>);
        } else if (action === 'referred_account') {
            details.push(<span key="action">Akcija: preporučen račun</span>);
        } else if (action === 'reward_granted') {
            details.push(<span key="action">Akcija: dodijeljena nagrada</span>);
        } else if (action) {
            details.push(<span key="action">Akcija: {action}</span>);
        }
        if (code) {
            details.push(<span key="code">Kod: {code}</span>);
        }
        if (ownerAccountId) {
            details.push(
                <span key="ownerAccount">
                    Račun preporučitelja: {ownerAccountId}
                </span>,
            );
        }
        if (referredAccountId) {
            details.push(
                <span key="referredAccount">
                    Preporučeni račun: {referredAccountId}
                </span>,
            );
        }
        if (typeof rewarded === 'boolean') {
            details.push(
                <span key="rewarded">
                    Nagrada: {rewarded ? 'dodijeljena' : 'na čekanju'}
                </span>,
            );
        }
        if (typeof amount === 'number') {
            details.push(<span key="amount">Iznos: {amount}</span>);
        }
        if (source) {
            details.push(<span key="source">Izvor: {source}</span>);
        }

        if (details.length > 0) {
            return (
                <Stack spacing={1} className="text-sm">
                    {details}
                </Stack>
            );
        }
    }

    if (data) {
        return renderJsonDetails(data);
    }

    return null;
}

export async function AccountEventsCard({ accountId }: AccountEventsCardProps) {
    const [events, account] = await Promise.all([
        getEventsByAggregateIds([accountId], 0, 10000),
        getAccount(accountId),
    ]);

    const userLabels: AccountUserLabels = new Map();
    for (const accountUser of account?.accountUsers ?? []) {
        if (!accountUser.user) {
            continue;
        }
        const { id, displayName, userName } = accountUser.user;
        userLabels.set(id, displayName ?? userName ?? id);
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
