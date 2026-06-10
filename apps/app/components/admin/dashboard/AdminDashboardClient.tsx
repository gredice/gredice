'use client';

import type { getAnalyticsTotals } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Input } from '@gredice/ui/Input';
import {
    AI,
    Bank,
    Calendar,
    Cloud,
    Euro,
    Fence,
    File,
    Hammer,
    Inbox,
    Lightning,
    Mail,
    Map as MapIcon,
    Megaphone,
    Settings,
    ShoppingCart,
    SmileHappy,
    Sprout,
    Success,
    Tally3,
    Truck,
    User,
} from '@gredice/ui/icons';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { formatAiCostUsd } from '../../../src/ai/aiAnalyticsCost';
import {
    type DashboardQuickActionBadgeCounts,
    type DashboardQuickActionOption,
    getDashboardQuickActionBadge,
} from '../../../src/dashboardQuickActions';
import { KnownPages } from '../../../src/KnownPages';
import { FactCard } from '../cards/FactCard';
import { EntityTypeIcon } from '../directories/EntityTypeIcon';
import { DashboardDivider } from './DashboardDivider';
import {
    OperationsDurationCard,
    type OperationsDurationData,
} from './OperationsDurationCard';
import {
    SunflowersDailyCard,
    type SunflowersDailyData,
} from './SunflowersDailyCard';
import {
    UsersRegistrationWeekdayCard,
    type WeekdayRegistrationData,
} from './UsersRegistrationWeekdayCard';

type EntityData = {
    entityTypeName: string;
    label: string;
    count: number;
    incompleteDraftCount: number;
    incompletePublishedCount: number;
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
    totalCostUsd: number;
};

function quickActionIcon(quickAction: { href: string; icon?: string | null }) {
    if (quickAction.icon) {
        return <EntityTypeIcon icon={quickAction.icon} className="size-4" />;
    }

    switch (quickAction.href) {
        case KnownPages.Accounts:
            return <Bank className="size-4" />;
        case KnownPages.Achievements:
        case KnownPages.Sunflowers:
            return <Success className="size-4" />;
        case KnownPages.AiAnalytics:
            return <AI className="size-4" />;
        case KnownPages.Approvals:
        case KnownPages.CommunicationInbox:
            return <Inbox className="size-4" />;
        case KnownPages.Automations:
            return <Lightning className="size-4" />;
        case KnownPages.CommunicationEmails:
            return <Mail className="size-4" />;
        case KnownPages.DeliveryRequests:
        case KnownPages.DeliverySlots:
            return <Truck className="size-4" />;
        case KnownPages.FarmerPayouts:
        case KnownPages.FarmerPrices:
        case KnownPages.Transactions:
            return <Euro className="size-4" />;
        case KnownPages.Farms:
            return <MapIcon className="size-4" />;
        case KnownPages.Gardens:
            return <Fence className="size-4" />;
        case KnownPages.Inventory:
        case KnownPages.SowingStatistics:
            return <Tally3 className="size-4" />;
        case KnownPages.Notifications:
        case KnownPages.SocialPublishing:
            return <Megaphone className="size-4" />;
        case KnownPages.Occasions:
        case KnownPages.Schedule:
            return <Calendar className="size-4" />;
        case KnownPages.RaisedBeds:
            return <RaisedBedIcon className="size-4" physicalId={null} />;
        case KnownPages.Greenhouse:
            return <Sprout className="size-4" />;
        case KnownPages.Operations:
            return <Hammer className="size-4" />;
        case KnownPages.Settings:
            return <Settings className="size-4" />;
        case KnownPages.ShoppingCarts:
            return <ShoppingCart className="size-4" />;
        case KnownPages.Users:
            return <User className="size-4" />;
        case KnownPages.Weather:
            return <Cloud className="size-4" />;
        case KnownPages.Feedback:
            return <SmileHappy className="size-4" />;
        default:
            return <File className="size-4" />;
    }
}

export function AdminDashboardClient({
    initialAnalyticsData,
    initialEntitiesData,
    initialQuickActions,
    initialQuickActionBadgeCounts,
    initialPeriod = '7',
    initialOperationsDurationData,
    initialWeekdayRegistrations,
    initialAiData,
    initialSunflowersData,
    initialFrom,
    initialTo,
}: {
    initialAnalyticsData: Awaited<ReturnType<typeof getAnalyticsTotals>>;
    initialQuickActions: DashboardQuickActionOption[];
    initialQuickActionBadgeCounts: DashboardQuickActionBadgeCounts;
    initialEntitiesData: EntityData[];
    initialPeriod?: string;
    initialOperationsDurationData: OperationsDurationData;
    initialWeekdayRegistrations: WeekdayRegistrationData[];
    initialAiData: AiData;
    initialSunflowersData: SunflowersDailyData[];
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
        <Stack spacing={4}>
            <Row spacing={2} className="flex-wrap">
                {initialQuickActions.map((quickAction) => {
                    const badge = getDashboardQuickActionBadge(
                        quickAction,
                        initialQuickActionBadgeCounts,
                    );

                    return (
                        <Chip
                            key={quickAction.id}
                            href={quickAction.href}
                            startDecorator={quickActionIcon(quickAction)}
                        >
                            {quickAction.label}
                            {badge != null && badge > 0 ? (
                                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                                    {badge}
                                </span>
                            ) : null}
                        </Chip>
                    );
                })}
            </Row>
            <Stack spacing={2}>
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
                    <Stack spacing={1}>
                        <Row spacing={2} className="items-end">
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
            <Stack spacing={2}>
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
                    <FactCard
                        header="Trošak"
                        value={formatAiCostUsd(initialAiData.totalCostUsd)}
                        href={KnownPages.AiAnalytics}
                    />
                </div>
            </Stack>
            <Stack spacing={2}>
                <DashboardDivider>Registracije</DashboardDivider>
                <div className="w-full lg:max-w-2xl">
                    <UsersRegistrationWeekdayCard
                        data={initialWeekdayRegistrations}
                    />
                </div>
            </Stack>
            <Stack spacing={2}>
                <DashboardDivider>Radnje</DashboardDivider>
                <div className="w-full lg:max-w-2xl">
                    <OperationsDurationCard
                        data={initialOperationsDurationData}
                    />
                </div>
            </Stack>
            <Stack spacing={2}>
                <DashboardDivider>Zapisi</DashboardDivider>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {initialEntitiesData.map(
                        ({
                            label,
                            count,
                            entityTypeName,
                            incompleteDraftCount,
                            incompletePublishedCount,
                        }) => (
                            <FactCard
                                key={entityTypeName}
                                header={label}
                                value={
                                    <Stack spacing={1}>
                                        <Typography>{count}</Typography>
                                        <Button
                                            variant="plain"
                                            size="sm"
                                            className="justify-start px-0 h-auto min-h-0"
                                            href={`${KnownPages.DirectoryEntityType(entityTypeName)}?completion=incomplete&state=draft`}
                                        >
                                            Draft nepotpuni:{' '}
                                            {incompleteDraftCount}
                                        </Button>
                                        <Button
                                            variant="plain"
                                            size="sm"
                                            className="justify-start px-0 h-auto min-h-0"
                                            href={`${KnownPages.DirectoryEntityType(entityTypeName)}?completion=incomplete&state=published`}
                                        >
                                            Objavljeno nepotpuni:{' '}
                                            {incompletePublishedCount}
                                        </Button>
                                    </Stack>
                                }
                                href={KnownPages.DirectoryEntityType(
                                    entityTypeName,
                                )}
                            />
                        ),
                    )}
                </div>
            </Stack>
            <Stack spacing={2}>
                <DashboardDivider>Suncokreti</DashboardDivider>
                <SunflowersDailyCard data={initialSunflowersData} />
            </Stack>
        </Stack>
    );
}
