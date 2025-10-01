'use client';

import type { getAnalyticsTotals } from '@gredice/storage';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { KnownPages } from '../../../src/KnownPages';
import { FactCard } from '../cards/FactCard';
import { DashboardDivider } from './DashboardDivider';
import {
    OperationsDurationCard,
    type OperationsDurationData,
} from './OperationsDurationCard';

type EntityData = {
    entityTypeName: string;
    label: string;
    count: number;
};

export function AdminDashboardClient({
    initialAnalyticsData,
    initialEntitiesData,
    initialPeriod = '7',
    initialOperationsDurationData,
}: {
    initialAnalyticsData: Awaited<ReturnType<typeof getAnalyticsTotals>>;
    initialEntitiesData: EntityData[];
    initialPeriod?: string;
    initialOperationsDurationData: OperationsDurationData;
}) {
    const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Sync with URL parameter changes
    useEffect(() => {
        setSelectedPeriod(initialPeriod);
    }, [initialPeriod]);

    const baseSearchParams = useMemo(() => {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.delete('period');
        return params;
    }, [searchParams]);

    const periodOptions = [
        { value: '1', label: '24h' },
        { value: '7', label: '7 dana' },
        { value: '30', label: '30 dana' },
    ];

    const handlePeriodChange = (value: string) => {
        setSelectedPeriod(value);
        startTransition(() => {
            const params = new URLSearchParams(baseSearchParams.toString());
            params.set('period', value);
            const nextUrl = `${pathname}?${params.toString()}`;
            router.replace(nextUrl);
        });
    };

    const {
        users: usersCount,
        usersBefore: usersBeforeCount,
        accounts: accountsCount,
        accountsBefore: accountsBeforeCount,
        gardens: gardensCount,
        gardensBefore: gardensBeforeCount,
        blocks: blocksCount,
        blocksBefore: blocksBeforeCount,
        events: eventsCount,
        eventsBefore: eventsBeforeCount,
        farms: farmsCount,
        farmsBefore: farmsBeforeCount,
        raisedBeds: raisedBedsCount,
        raisedBedsBefore: raisedBedsBeforeCount,
        transactions: transactionsCount,
        transactionsBefore: transactionsBeforeCount,
        deliveryRequests: deliveryRequestsCount,
        deliveryRequestsBefore: deliveryRequestsBeforeCount,
    } = initialAnalyticsData;

    return (
        <Stack spacing={2}>
            <Stack spacing={1}>
                <Row justifyContent="space-between">
                    <DashboardDivider>Računi i korisnici</DashboardDivider>
                    <SelectItems
                        value={selectedPeriod}
                        onValueChange={(value) =>
                            handlePeriodChange(value || '7')
                        }
                        items={periodOptions}
                        className="w-32"
                        placeholder="Odaberi period"
                        disabled={isPending}
                    />
                </Row>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    <FactCard
                        header="Računi"
                        value={accountsCount}
                        href={KnownPages.Accounts}
                        beforeValue={accountsBeforeCount}
                    />
                    <FactCard
                        header="Korisnici"
                        value={usersCount}
                        href={KnownPages.Users}
                        beforeValue={usersBeforeCount}
                    />
                    <FactCard
                        header="Farme"
                        value={farmsCount}
                        beforeValue={farmsBeforeCount}
                    />
                    <FactCard
                        header="Vrtovi"
                        value={gardensCount}
                        href={KnownPages.Gardens}
                        beforeValue={gardensBeforeCount}
                    />
                    <FactCard
                        header="Blokovi"
                        value={blocksCount}
                        beforeValue={blocksBeforeCount}
                    />
                    <FactCard
                        header="Događaji"
                        value={eventsCount}
                        beforeValue={eventsBeforeCount}
                    />
                    <FactCard
                        header="Gredice"
                        value={raisedBedsCount}
                        href={KnownPages.RaisedBeds}
                        beforeValue={raisedBedsBeforeCount}
                    />
                    <FactCard
                        header="Transakcije"
                        value={transactionsCount}
                        href={KnownPages.Transactions}
                        beforeValue={transactionsBeforeCount}
                    />
                    <FactCard
                        header="Zahtjevi za dostavu"
                        value={deliveryRequestsCount}
                        href={KnownPages.DeliveryRequests}
                        beforeValue={deliveryRequestsBeforeCount}
                    />
                </div>
            </Stack>
            <Stack spacing={1}>
                <DashboardDivider>Radnje</DashboardDivider>
                <OperationsDurationCard data={initialOperationsDurationData} />
            </Stack>
            <Stack spacing={1}>
                <DashboardDivider>Zapisi</DashboardDivider>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {initialEntitiesData.map(
                        ({ label, count, entityTypeName }) => (
                            <FactCard
                                key={entityTypeName}
                                header={label}
                                value={count}
                                href={KnownPages.DirectoryEntityType(
                                    entityTypeName,
                                )}
                            />
                        ),
                    )}
                </div>
            </Stack>
        </Stack>
    );
}
