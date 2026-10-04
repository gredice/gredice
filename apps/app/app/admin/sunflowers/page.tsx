import {
    events,
    getAccounts,
    knownEventTypes,
    storage,
} from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { and, desc, gte, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { getDateFromTimeFilter } from '../../../lib/utils/timeFilters';
import { KnownPages } from '../../../src/KnownPages';
import { SunflowersFilters } from './SunflowersFilters';

export const dynamic = 'force-dynamic';

function parseSunflowerData(data: unknown) {
    if (!data || typeof data !== 'object') {
        return { amount: 0, reason: '-' };
    }

    const record = data as Record<string, unknown>;
    const amountValue = record.amount;
    let amount = 0;
    if (typeof amountValue === 'number' && Number.isFinite(amountValue)) {
        amount = amountValue;
    } else if (typeof amountValue === 'string') {
        const parsedAmount = Number.parseFloat(amountValue);
        if (!Number.isNaN(parsedAmount)) {
            amount = parsedAmount;
        }
    }
    const reason = typeof record.reason === 'string' ? record.reason : '-';

    return { amount, reason };
}

export default async function SunflowersPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);

    const params = await searchParams;
    const fromFilter =
        typeof params.from === 'string' ? params.from : 'last-30-days';
    const fromDate = getDateFromTimeFilter(fromFilter);
    const userIdFilter = typeof params.userId === 'string' ? params.userId : '';
    const accountIdFilter =
        typeof params.accountId === 'string' ? params.accountId : '';

    const accounts = await getAccounts();
    const accountById = new Map(
        accounts.map((account) => [account.id, account]),
    );

    const allUserOptions = Array.from(
        new Map(
            accounts
                .flatMap((account) =>
                    account.accountUsers.map((accountUser) => {
                        const user = accountUser.user;
                        const label =
                            user.displayName?.trim() ||
                            user.userName ||
                            user.id;
                        return [user.id, label] as const;
                    }),
                )
                .sort((a, b) => a[1].localeCompare(b[1])),
        ).entries(),
    ).map(([id, label]) => ({ id, label }));

    const filteredAccountIds = accounts
        .filter((account) => {
            if (accountIdFilter && account.id !== accountIdFilter) {
                return false;
            }

            if (userIdFilter) {
                return account.accountUsers.some(
                    (accountUser) => accountUser.userId === userIdFilter,
                );
            }

            return true;
        })
        .map((account) => account.id);

    const whereConditions = [
        inArray(events.aggregateId, filteredAccountIds),
        inArray(events.type, [
            knownEventTypes.accounts.earnSunflowers,
            knownEventTypes.accounts.spendSunflowers,
        ]),
        fromDate ? gte(events.createdAt, fromDate) : undefined,
    ];

    const sunflowerEvents =
        filteredAccountIds.length === 0
            ? []
            : await storage().query.events.findMany({
                  where: and(...whereConditions),
                  orderBy: [desc(events.createdAt)],
              });

    const parsedEvents = sunflowerEvents.map((event) => {
        const isSpent = event.type === knownEventTypes.accounts.spendSunflowers;
        const parsedData = parseSunflowerData(event.data);
        const account = accountById.get(event.aggregateId);

        return {
            ...event,
            reason: parsedData.reason,
            amount: isSpent ? -Math.abs(parsedData.amount) : parsedData.amount,
            account,
        };
    });

    const totalEarned = parsedEvents
        .filter((event) => event.amount > 0)
        .reduce((sum, event) => sum + event.amount, 0);
    const totalSpent = parsedEvents
        .filter((event) => event.amount < 0)
        .reduce((sum, event) => sum + Math.abs(event.amount), 0);

    const accountFilterOptions = accounts
        .filter((account) => {
            if (!userIdFilter) {
                return true;
            }

            return account.accountUsers.some(
                (accountUser) => accountUser.userId === userIdFilter,
            );
        })
        .map((account) => ({
            id: account.id,
            label: account.id,
        }));

    return (
        <Stack spacing={4}>
            <Row spacing={2}>
                <Chip color="primary">{parsedEvents.length}</Chip>
                <Chip color="success">+{totalEarned}</Chip>
                <Chip color="error">-{totalSpent}</Chip>
            </Row>

            <SunflowersFilters
                users={allUserOptions}
                accounts={accountFilterOptions}
            />

            <Card>
                <CardOverflow>
                    {parsedEvents.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>
                                Nema suncokreta za odabrane filtere
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {parsedEvents.map((event) => {
                                const accountUsers =
                                    event.account?.accountUsers ?? [];
                                const isSpent = event.amount < 0;
                                const eventTypeLabel = isSpent
                                    ? 'Potrošeno'
                                    : 'Zarađeno';

                                return (
                                    <li
                                        key={event.id}
                                        className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                    >
                                        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <Stack
                                                spacing={2}
                                                className="min-w-0 flex-1"
                                            >
                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                    <Chip
                                                        color={
                                                            isSpent
                                                                ? 'error'
                                                                : 'success'
                                                        }
                                                        size="sm"
                                                        variant="soft"
                                                    >
                                                        {eventTypeLabel}
                                                    </Chip>
                                                    <Chip
                                                        color="neutral"
                                                        size="sm"
                                                        variant="outlined"
                                                    >
                                                        Iznos: {event.amount}
                                                    </Chip>
                                                    <Link
                                                        href={KnownPages.Account(
                                                            event.aggregateId,
                                                        )}
                                                        className="min-w-0 break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
                                                    >
                                                        {event.aggregateId}
                                                    </Link>
                                                </div>

                                                <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                                                    <Stack
                                                        spacing={1}
                                                        className="min-w-0"
                                                    >
                                                        <Typography
                                                            level="body3"
                                                            semiBold
                                                            className="text-muted-foreground"
                                                        >
                                                            Korisnici računa
                                                        </Typography>
                                                        {accountUsers.length ===
                                                        0 ? (
                                                            <Typography level="body2">
                                                                -
                                                            </Typography>
                                                        ) : (
                                                            <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
                                                                {accountUsers.map(
                                                                    (
                                                                        accountUser,
                                                                    ) => {
                                                                        const user =
                                                                            accountUser.user;
                                                                        const label =
                                                                            user.displayName?.trim() ||
                                                                            user.userName ||
                                                                            user.id;
                                                                        return (
                                                                            <Link
                                                                                href={KnownPages.User(
                                                                                    user.id,
                                                                                )}
                                                                                key={`${event.id}-${user.id}`}
                                                                                className="min-w-0 break-words text-sm text-primary underline-offset-4 hover:underline [overflow-wrap:anywhere]"
                                                                            >
                                                                                {
                                                                                    label
                                                                                }
                                                                            </Link>
                                                                        );
                                                                    },
                                                                )}
                                                            </div>
                                                        )}
                                                    </Stack>

                                                    <Stack
                                                        spacing={1}
                                                        className="min-w-0"
                                                    >
                                                        <Typography
                                                            level="body3"
                                                            semiBold
                                                            className="text-muted-foreground"
                                                        >
                                                            Razlog
                                                        </Typography>
                                                        <Typography
                                                            level="body2"
                                                            className="min-w-0 whitespace-pre-wrap break-words"
                                                        >
                                                            {event.reason}
                                                        </Typography>
                                                    </Stack>
                                                </div>
                                            </Stack>

                                            <Stack
                                                spacing={1}
                                                className="min-w-0 lg:items-end lg:text-right"
                                            >
                                                <Typography
                                                    level="body3"
                                                    semiBold
                                                    className="text-muted-foreground"
                                                >
                                                    Datum kreiranja
                                                </Typography>
                                                <Typography
                                                    level="body2"
                                                    className="whitespace-nowrap"
                                                >
                                                    <LocalDateTime>
                                                        {event.createdAt}
                                                    </LocalDateTime>
                                                </Typography>
                                            </Stack>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardOverflow>
            </Card>
        </Stack>
    );
}
