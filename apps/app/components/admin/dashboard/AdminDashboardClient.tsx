'use client';

import type { getAnalyticsTotals } from '@gredice/storage';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Calendar } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { KnownPages } from '../../../src/KnownPages';
import { FactCard } from '../cards/FactCard';
import { DashboardDivider } from './DashboardDivider';
import {
    OperationsDurationCard,
    type OperationsDurationData,
} from './OperationsDurationCard';
import {
    UsersRegistrationWeekdayCard,
    type WeekdayRegistrationData,
} from './UsersRegistrationWeekdayCard';

type EntityData = {
    entityTypeName: string;
    label: string;
    count: number;
};

function getTodayDateValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

type AiData = {
    count: number;
    totalTokens: number;
};

export function AdminDashboardClient({
    initialAnalyticsData,
    initialEntitiesData,
    initialPeriod = '7',
    initialOperationsDurationData,
    initialWeekdayRegistrations,
    initialAiData,
    initialFrom,
    initialTo,
}: {
    initialAnalyticsData: Awaited<ReturnType<typeof getAnalyticsTotals>>;
    initialEntitiesData: EntityData[];
    initialPeriod?: string;
    initialOperationsDurationData: OperationsDurationData;
    initialWeekdayRegistrations: WeekdayRegistrationData[];
    initialAiData: AiData;
    initialFrom?: string;
    initialTo?: string;
}) {
    const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
    const [customFrom, setCustomFrom] = useState(initialFrom ?? '');
    const [customTo, setCustomTo] = useState(initialTo ?? '');
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        setSelectedPeriod(initialPeriod);
        setCustomFrom(initialFrom ?? '');
        setCustomTo(initialTo ?? '');
    }, [initialFrom, initialPeriod, initialTo]);

    const baseSearchParams = useMemo(() => {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.delete('period');
        params.delete('from');
        params.delete('to');
        return params;
    }, [searchParams]);

    const periodOptions = [
        { value: '1', label: '24h' },
        { value: '7', label: '7 dana' },
        { value: '30', label: '30 dana' },
        { value: 'custom', label: 'Custom' },
    ];

    const handlePeriodChange = (value: string) => {
        setSelectedPeriod(value);

        if (value === 'custom') {
            const today = getTodayDateValue();
            const nextFrom = customFrom || today;
            const nextTo = customTo || today;
            setCustomFrom(nextFrom);
            setCustomTo(nextTo);
            startTransition(() => {
                const params = new URLSearchParams(baseSearchParams);
                params.set('period', 'custom');
                params.set('from', nextFrom);
                params.set('to', nextTo);
                const nextUrl = `${pathname}?${params.toString()}`;
                router.replace(nextUrl);
            });
            return;
        }

        startTransition(() => {
            const params = new URLSearchParams(baseSearchParams);
            params.set('period', value);
            const nextUrl = `${pathname}?${params.toString()}`;
            router.replace(nextUrl);
        });
    };

    const isCustomRangeInvalid =
        selectedPeriod === 'custom' &&
        !!customFrom &&
        !!customTo &&
        customFrom > customTo;

    const handleCustomRangeApply = () => {
        if (!customFrom || !customTo || isCustomRangeInvalid) {
            return;
        }

        startTransition(() => {
            const params = new URLSearchParams(baseSearchParams);
            params.set('period', 'custom');
            params.set('from', customFrom);
            params.set('to', customTo);
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
        activeUsers,
    } = initialAnalyticsData;

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Button
                    variant="outlined"
                    className="rounded-full"
                    size="sm"
                    startDecorator={<Calendar className="size-4 shrink-0" />}
                    href={KnownPages.Schedule}
                >
                    Raspored
                </Button>
                <Button
                    variant="outlined"
                    size="sm"
                    className="rounded-full"
                    startDecorator={
                        <RaisedBedIcon
                            className="size-4 shrink-0"
                            physicalId={null}
                        />
                    }
                    href={KnownPages.RaisedBeds}
                >
                    Gredice
                </Button>
            </Row>
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
                {selectedPeriod === 'custom' ? (
                    <Stack spacing={0.5}>
                        <Row spacing={1} className="items-end">
                            <Input
                                type="date"
                                value={customFrom}
                                onChange={(event) =>
                                    setCustomFrom(event.target.value)
                                }
                                label="Od"
                                className="max-w-48"
                                disabled={isPending}
                            />
                            <Input
                                type="date"
                                value={customTo}
                                onChange={(event) =>
                                    setCustomTo(event.target.value)
                                }
                                label="Do"
                                className="max-w-48"
                                disabled={isPending}
                            />
                            <Button
                                size="sm"
                                onClick={handleCustomRangeApply}
                                disabled={
                                    !customFrom ||
                                    !customTo ||
                                    isCustomRangeInvalid ||
                                    isPending
                                }
                            >
                                Primijeni
                            </Button>
                        </Row>
                        {isCustomRangeInvalid ? (
                            <Typography
                                level="body3"
                                className="text-destructive"
                            >
                                Datum početka mora biti prije datuma kraja.
                            </Typography>
                        ) : null}
                    </Stack>
                ) : null}
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
                    <FactCard header="DAU" value={activeUsers.daily} />
                    <FactCard header="WAU" value={activeUsers.weekly} />
                    <FactCard header="MAU" value={activeUsers.monthly} />
                </div>
                <DashboardDivider>Vrtovi</DashboardDivider>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    <FactCard
                        header="Farme"
                        value={farmsCount}
                        href={KnownPages.Farms}
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
                        header="Gredice"
                        value={raisedBedsCount}
                        href={KnownPages.RaisedBeds}
                        beforeValue={raisedBedsBeforeCount}
                    />
                </div>
                <DashboardDivider>Ostalo</DashboardDivider>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    <FactCard
                        header="Događaji"
                        value={eventsCount}
                        beforeValue={eventsBeforeCount}
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
                <DashboardDivider>AI</DashboardDivider>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    <FactCard
                        header="AI analize"
                        value={initialAiData.count}
                        href={KnownPages.AiAnalytics}
                    />
                    <FactCard
                        header="Ukupno tokena"
                        value={initialAiData.totalTokens.toLocaleString(
                            'hr-HR',
                        )}
                        href={KnownPages.AiAnalytics}
                    />
                </div>
            </Stack>
            <Stack spacing={1}>
                <DashboardDivider>Registracije</DashboardDivider>
                <div className="w-full lg:max-w-2xl">
                    <UsersRegistrationWeekdayCard
                        data={initialWeekdayRegistrations}
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
