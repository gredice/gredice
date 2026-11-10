'use client';

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
    Graph,
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
import { formatAiCostEur } from '../../../src/ai/aiAnalyticsCost';
import {
    type DashboardQuickActionBadgeCounts,
    type DashboardQuickActionOption,
    getDashboardQuickActionBadge,
} from '../../../src/dashboardQuickActions';
import { KnownPages } from '../../../src/KnownPages';
import { EntityTypeIcon } from '../directories/EntityTypeIcon';
import { ActiveUsersCard } from './ActiveUsersCard';
import type { getAnalyticsData } from './actions';
import type { AnalyticsWeekDay } from './analyticsDateRange';
import { DashboardSection } from './DashboardSection';
import { DashboardStatTile } from './DashboardStatTile';
import { formatDashboardNumber } from './dashboardFormat';
import type { OperationsDurationData } from './OperationsDurationCard';
import { OperationsWeekCard } from './OperationsWeekCard';
import { RecordsOverviewCard } from './RecordsOverviewCard';
import { RegistrationsWeekCard } from './RegistrationsWeekCard';
import type { SunflowersDailyData } from './SunflowersDailyCard';
import { SunflowersWeekCard } from './SunflowersWeekCard';
import type { WeekdayRegistrationData } from './UsersRegistrationWeekdayCard';

type AnalyticsData = Awaited<ReturnType<typeof getAnalyticsData>>;

function getTodayDateValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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
        case KnownPages.DeliveryRequestStatistics:
            return <Graph className="size-4" />;
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
    weekDays,
}: {
    initialAnalyticsData: AnalyticsData['analytics'];
    initialQuickActions: DashboardQuickActionOption[];
    initialQuickActionBadgeCounts: DashboardQuickActionBadgeCounts;
    initialEntitiesData: AnalyticsData['entities'];
    initialPeriod?: string;
    initialOperationsDurationData: OperationsDurationData;
    initialWeekdayRegistrations: WeekdayRegistrationData[];
    initialAiData: AnalyticsData['ai'];
    initialSunflowersData: SunflowersDailyData[];
    initialFrom?: string;
    initialTo?: string;
    weekDays: AnalyticsWeekDay[];
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
    const periodSelect = (
        <SelectItems
            value={selectedPeriod}
            onValueChange={(value) => handlePeriodChange(value || '7')}
            items={periodOptions}
            className="w-32"
            placeholder="Odaberi period"
            disabled={isPending}
        />
    );
    const aiAverageTokensDetail =
        initialAiData.count > 0
            ? `Prosječno ${formatDashboardNumber(Math.round(initialAiData.totalTokens / initialAiData.count))} po analizi`
            : undefined;
    const aiAverageCostDetail =
        initialAiData.count > 0
            ? `Prosječno ${formatAiCostEur(initialAiData.totalCostEur / initialAiData.count)} po analizi`
            : undefined;

    return (
        <Stack spacing={6}>
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
            <DashboardSection
                title="Računi i korisnici"
                actions={periodSelect}
                busy={isPending}
            >
                <Stack spacing={2}>
                    {selectedPeriod === 'custom' ? (
                        <Stack spacing={1}>
                            <Row spacing={2} className="flex-wrap items-end">
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
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                        <DashboardStatTile
                            label="Računi"
                            value={accountsCount}
                            previousValue={accountsBeforeCount}
                            href={KnownPages.Accounts}
                        />
                        <DashboardStatTile
                            label="Korisnici"
                            value={usersCount}
                            previousValue={usersBeforeCount}
                            href={KnownPages.Users}
                        />
                        <div className="col-span-2">
                            <ActiveUsersCard
                                daily={activeUsers.daily}
                                weekly={activeUsers.weekly}
                                monthly={activeUsers.monthly}
                                users={usersCount}
                            />
                        </div>
                    </div>
                </Stack>
            </DashboardSection>
            <DashboardSection title="Vrtovi" busy={isPending}>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <DashboardStatTile
                        label="Farme"
                        value={farmsCount}
                        previousValue={farmsBeforeCount}
                        href={KnownPages.Farms}
                    />
                    <DashboardStatTile
                        label="Vrtovi"
                        value={gardensCount}
                        previousValue={gardensBeforeCount}
                        href={KnownPages.Gardens}
                    />
                    <DashboardStatTile
                        label="Blokovi"
                        value={blocksCount}
                        previousValue={blocksBeforeCount}
                        detail={
                            gardensCount > 0
                                ? `Prosječno ${formatDashboardNumber(blocksCount / gardensCount)} po vrtu`
                                : undefined
                        }
                    />
                    <DashboardStatTile
                        label="Gredice"
                        value={raisedBedsCount}
                        previousValue={raisedBedsBeforeCount}
                        href={KnownPages.RaisedBeds}
                    />
                </div>
            </DashboardSection>
            <div className="grid gap-6 xl:grid-cols-2">
                <DashboardSection title="Ostalo" busy={isPending}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <DashboardStatTile
                            label="Događaji"
                            value={eventsCount}
                            previousValue={eventsBeforeCount}
                        />
                        <DashboardStatTile
                            label="Transakcije"
                            value={transactionsCount}
                            previousValue={transactionsBeforeCount}
                            href={KnownPages.Transactions}
                        />
                        <DashboardStatTile
                            label="Zahtjevi za dostavu"
                            value={deliveryRequestsCount}
                            previousValue={deliveryRequestsBeforeCount}
                            href={KnownPages.DeliveryRequests}
                        />
                    </div>
                </DashboardSection>
                <DashboardSection title="AI" busy={isPending}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <DashboardStatTile
                            label="AI analize"
                            value={initialAiData.count}
                            href={KnownPages.AiAnalytics}
                        />
                        <DashboardStatTile
                            label="Ukupno tokena"
                            value={initialAiData.totalTokens}
                            href={KnownPages.AiAnalytics}
                            detail={aiAverageTokensDetail}
                        />
                        <DashboardStatTile
                            label="Trošak"
                            value={formatAiCostEur(initialAiData.totalCostEur)}
                            href={KnownPages.AiAnalytics}
                            detail={aiAverageCostDetail}
                        />
                    </div>
                </DashboardSection>
            </div>
            <DashboardSection title="Statistika">
                <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
                    <RegistrationsWeekCard
                        weekDays={weekDays}
                        registrations={initialWeekdayRegistrations}
                    />
                    <OperationsWeekCard
                        weekDays={weekDays}
                        data={initialOperationsDurationData}
                    />
                    <SunflowersWeekCard
                        weekDays={weekDays}
                        data={initialSunflowersData}
                    />
                    <RecordsOverviewCard entities={initialEntitiesData} />
                </div>
            </DashboardSection>
        </Stack>
    );
}
