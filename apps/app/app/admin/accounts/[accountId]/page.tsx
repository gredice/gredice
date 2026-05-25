import { getAccountGardens, getAccountReferralState } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Delete } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import Link from 'next/link';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../../../../components/admin/cards/tableCardLayout';
import {
    EntityDetailsPanelCard,
    EntityDetailsPropertiesLayout,
    EntityDetailsPropertiesPanel,
    EntityDetailsPropertiesProvider,
    EntityDetailsPropertiesToggle,
    EntityDetailsPropertyList,
    type EntityDetailsPropertyListItem,
} from '../../../../components/admin/details';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../components/admin/navigation/AdminPageTitle';
import { NotificationsTableCard } from '../../../../components/notifications/NotificationsTableCard';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { sendDeleteAccountEmail } from '../../../(actions)/accountsActions';
import { getAccountTimeZone } from '../../../(actions)/accountTimeZoneActions';
import { GardensTable } from '../../gardens/GardensTable';
import { ShoppingCartsTable } from '../../shopping-carts/ShoppingCartsTable';
import { AccountAchievementsCard } from './AccountAchievementsCard';
import { AccountEventsCard } from './AccountEventsCard';
import { AccountInventoryCard } from './AccountInventoryCard';
import { AccountReferralsCard } from './AccountReferralsCard';
import { AccountSunflowersCard } from './AccountSunflowersCard';
import { AccountTimeZonePicker } from './AccountTimeZonePicker';
import { AccountTransactionsCard } from './AccountTransactionsCard';
import { AccountUsersCard } from './AccountUsersCard';
import { RaisedBedsTableCard } from './RaisedBedsTableCard';

export const dynamic = 'force-dynamic';

type AccountPageSearchParams = Record<string, string | string[] | undefined>;

export default async function AccountPage({
    params,
    searchParams,
}: {
    params: Promise<{ accountId: string }>;
    searchParams: Promise<AccountPageSearchParams>;
}) {
    const [{ accountId }, resolvedSearchParams] = await Promise.all([
        params,
        searchParams,
    ]);
    await auth(['admin']);

    const actionBound = sendDeleteAccountEmail.bind(null, accountId);
    const [currentTimeZone, gardens, referralState] = await Promise.all([
        getAccountTimeZone(accountId),
        getAccountGardens(accountId),
        getAccountReferralState(accountId),
    ]);
    const usedReferralCodeValue =
        referralState.usedReferralCode &&
        referralState.usedReferralOwnerAccountId ? (
            <Link
                href={KnownPages.Account(
                    referralState.usedReferralOwnerAccountId,
                )}
                title={`Izvorni račun: ${referralState.usedReferralOwnerAccountId}`}
            >
                {referralState.usedReferralCode}
            </Link>
        ) : (
            referralState.usedReferralCode
        );
    const propertyItems: EntityDetailsPropertyListItem[] = [
        { id: 'account-id', label: 'ID računa', value: accountId, mono: true },
        {
            id: 'own-referral-code',
            label: 'Vlastiti kod preporuke',
            value: referralState.myCode,
            mono: true,
        },
        {
            id: 'used-referral-code',
            label: 'Korišteni kod preporuke',
            value: usedReferralCodeValue,
            mono: true,
        },
        {
            id: 'time-zone',
            label: 'Vremenska zona',
            value: (
                <AccountTimeZonePicker
                    accountId={accountId}
                    currentTimeZone={currentTimeZone}
                />
            ),
        },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList items={propertyItems} />
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={8}>
                <AdminPageTitle title={`Račun ${accountId}`} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.Accounts,
                                },
                                { label: accountId },
                            ]}
                        />
                    }
                    actions={
                        <Row className="items-center" spacing={2}>
                            <ModalConfirm
                                title="Potvrda brisanja računa"
                                header="Jeste li sigurni da želite izbrisati račun?"
                                expectedConfirm="Da"
                                onConfirm={actionBound}
                                trigger={
                                    <Button
                                        startDecorator={
                                            <Delete className="size-5 shrink-0" />
                                        }
                                    >
                                        Brisanje računa
                                    </Button>
                                }
                            />
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading="Račun"
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <AccountUsersCard accountId={accountId} />
                        <Card className={scrollableTableCardClassName}>
                            <CardHeader>
                                <CardTitle>Vrtovi</CardTitle>
                            </CardHeader>
                            <CardOverflow
                                className={scrollableTableCardOverflowClassName}
                            >
                                <GardensTable
                                    gardens={gardens}
                                    showAccountColumn={false}
                                    showCreatedTime
                                    emptyLabel="Nema povezanih vrtova"
                                />
                            </CardOverflow>
                        </Card>
                        <AccountSunflowersCard accountId={accountId} />
                        <AccountReferralsCard accountId={accountId} />
                        <AccountAchievementsCard accountId={accountId} />
                        <AccountTransactionsCard accountId={accountId} />
                        <RaisedBedsTableCard accountId={accountId} scroll />
                        <AccountEventsCard
                            accountId={accountId}
                            searchParams={resolvedSearchParams}
                        />
                        <NotificationsTableCard
                            accountId={accountId}
                            showAccountColumn={false}
                            scroll
                        />
                        <AccountInventoryCard accountId={accountId} />
                        <Card className={scrollableTableCardClassName}>
                            <CardHeader>
                                <CardTitle>Košarice</CardTitle>
                            </CardHeader>
                            <CardOverflow
                                className={scrollableTableCardOverflowClassName}
                            >
                                <ShoppingCartsTable
                                    accountId={accountId}
                                    showIdColumn={false}
                                />
                            </CardOverflow>
                        </Card>
                    </div>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
