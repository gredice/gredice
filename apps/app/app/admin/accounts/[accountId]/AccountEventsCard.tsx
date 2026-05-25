import { getAccount, getLatestEvents, knownEventTypes } from '@gredice/storage';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { ArrowLeft, ArrowRight } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import { EventsTable } from '../../../../components/shared/events/EventsTable';
import { KnownPages } from '../../../../src/KnownPages';

interface AccountEventsCardProps {
    accountId: string;
    searchParams?: AccountEventsSearchParams;
}

type AccountEventsSearchParams = Record<string, string | string[] | undefined>;

const ACCOUNT_EVENT_TYPE_LABELS: Record<string, string> = {
    [knownEventTypes.accounts.create]: 'Račun stvoren',
    [knownEventTypes.accounts.assignUser]: 'Korisnik dodan',
    [knownEventTypes.accounts.earnSunflowers]: 'Dodani suncokreti',
    [knownEventTypes.accounts.referral]: 'Preporuka',
    [knownEventTypes.accounts.spendSunflowers]: 'Potrošeni suncokreti',
};

const ACCOUNT_EVENT_TYPES = Object.values(knownEventTypes.accounts);
const ACCOUNT_EVENTS_PAGE_PARAM = 'eventsPage';
const ACCOUNT_EVENTS_PAGE_SIZE = 25;
const ACCOUNT_EVENTS_SECTION_ID = 'account-events';

type AccountEvent = Awaited<ReturnType<typeof getLatestEvents>>[number];

type AccountUserLabels = Map<string, string>;

function getAccountEventsPage(searchParams?: AccountEventsSearchParams) {
    const pageValue =
        typeof searchParams?.[ACCOUNT_EVENTS_PAGE_PARAM] === 'string'
            ? searchParams[ACCOUNT_EVENTS_PAGE_PARAM]
            : undefined;
    const pageNumber = pageValue ? Number(pageValue) : 1;

    return Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
}

function buildAccountEventsPageHref(
    accountId: string,
    page: number,
    searchParams?: AccountEventsSearchParams,
) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(searchParams ?? {})) {
        if (Array.isArray(value)) {
            for (const item of value) {
                params.append(key, item);
            }
            continue;
        }

        if (typeof value === 'string') {
            params.set(key, value);
        }
    }

    if (page > 1) {
        params.set(ACCOUNT_EVENTS_PAGE_PARAM, page.toString());
    } else {
        params.delete(ACCOUNT_EVENTS_PAGE_PARAM);
    }

    const query = params.toString();
    return `${KnownPages.Account(accountId)}${query ? `?${query}` : ''}#${ACCOUNT_EVENTS_SECTION_ID}`;
}

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

export async function AccountEventsCard({
    accountId,
    searchParams,
}: AccountEventsCardProps) {
    const currentPage = getAccountEventsPage(searchParams);
    const offset = (currentPage - 1) * ACCOUNT_EVENTS_PAGE_SIZE;
    const [eventsPage, account] = await Promise.all([
        getLatestEvents(
            ACCOUNT_EVENT_TYPES,
            [accountId],
            offset,
            ACCOUNT_EVENTS_PAGE_SIZE + 1,
        ),
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

    const hasNextPage = eventsPage.length > ACCOUNT_EVENTS_PAGE_SIZE;
    const events = eventsPage.slice(0, ACCOUNT_EVENTS_PAGE_SIZE);
    const hasPagination = currentPage > 1 || hasNextPage;

    return (
        <Card>
            <CardHeader>
                <CardTitle id={ACCOUNT_EVENTS_SECTION_ID}>Događaji</CardTitle>
            </CardHeader>
            <CardOverflow className="mb-0 max-h-96 overflow-auto">
                <EventsTable
                    events={events}
                    renderType={(event) =>
                        ACCOUNT_EVENT_TYPE_LABELS[event.type] ?? event.type
                    }
                    renderDetails={(event) =>
                        renderEventDetails(event, userLabels)
                    }
                    labels={{ details: 'Detalji' }}
                />
            </CardOverflow>
            {hasPagination && (
                <CardContent className="pt-2">
                    <Row
                        spacing={3}
                        className="items-center justify-center flex-wrap"
                    >
                        {currentPage > 1 && (
                            <Chip
                                href={buildAccountEventsPageHref(
                                    accountId,
                                    currentPage - 1,
                                    searchParams,
                                )}
                                startDecorator={
                                    <ArrowLeft className="size-4" />
                                }
                            >
                                Prethodna
                            </Chip>
                        )}
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Stranica {currentPage}
                        </Typography>
                        {hasNextPage && (
                            <Chip
                                href={buildAccountEventsPageHref(
                                    accountId,
                                    currentPage + 1,
                                    searchParams,
                                )}
                                startDecorator={
                                    <ArrowRight className="size-4" />
                                }
                            >
                                Sljedeća
                            </Chip>
                        )}
                    </Row>
                </CardContent>
            )}
        </Card>
    );
}
