import {
    events,
    getAccounts,
    knownEventTypes,
    storage,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
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
    const amount =
        typeof record.amount === 'number' && Number.isFinite(record.amount)
            ? record.amount
            : 0;
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
    const fromFilter = typeof params.from === 'string' ? params.from : '';
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
                  limit: 2000,
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
        <Stack spacing={2}>
            <Row spacing={1}>
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
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Tip</Table.Head>
                                <Table.Head>Iznos</Table.Head>
                                <Table.Head>Račun</Table.Head>
                                <Table.Head>Korisnici računa</Table.Head>
                                <Table.Head>Razlog</Table.Head>
                                <Table.Head>Datum kreiranja</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {parsedEvents.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={6}>
                                        <NoDataPlaceholder>
                                            Nema suncokreta za odabrane filtere
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {parsedEvents.map((event) => {
                                const accountUsers =
                                    event.account?.accountUsers ?? [];

                                return (
                                    <Table.Row key={event.id}>
                                        <Table.Cell>
                                            {event.amount < 0
                                                ? 'Potrošeno'
                                                : 'Zarađeno'}
                                        </Table.Cell>
                                        <Table.Cell>{event.amount}</Table.Cell>
                                        <Table.Cell>
                                            <Link
                                                href={KnownPages.Account(
                                                    event.aggregateId,
                                                )}
                                            >
                                                {event.aggregateId}
                                            </Link>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Stack spacing={0.5}>
                                                {accountUsers.length === 0 &&
                                                    '-'}
                                                {accountUsers.map(
                                                    (accountUser) => {
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
                                                            >
                                                                {label}
                                                            </Link>
                                                        );
                                                    },
                                                )}
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>{event.reason}</Table.Cell>
                                        <Table.Cell>
                                            <LocalDateTime>
                                                {event.createdAt}
                                            </LocalDateTime>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
