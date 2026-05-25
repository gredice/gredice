import { getAccountReferralDetails } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import { Delete } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import Link from 'next/link';
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
import { AccountAchievementsCard } from './AccountAchievementsCard';
import { AccountEventsCard } from './AccountEventsCard';
import { AccountGardensCard } from './AccountGardensCard';
import { AccountInventoryCard } from './AccountInventoryCard';
import { AccountShoppingCartsCard } from './AccountShoppingCartsCard';
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
    const [currentTimeZone, referralDetails] = await Promise.all([
        getAccountTimeZone(accountId),
        getAccountReferralDetails(accountId, {
            includeUsedReferralSource: true,
        }),
    ]);
    const usedReferralCodeValue =
        referralDetails.usedReferralCode &&
        referralDetails.usedReferralSourceAccountId ? (
            <Link
                href={KnownPages.Account(
                    referralDetails.usedReferralSourceAccountId,
                )}
                title={`Izvorni račun: ${referralDetails.usedReferralSourceAccountId}`}
            >
                {referralDetails.usedReferralCode}
            </Link>
        ) : (
            referralDetails.usedReferralCode
        );
    const propertyItems: EntityDetailsPropertyListItem[] = [
        { id: 'account-id', label: 'ID računa', value: accountId, mono: true },
        {
            id: 'own-referral-code',
            label: 'Vlastiti kod preporuke',
            value: referralDetails.myCode,
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
                        <AccountGardensCard accountId={accountId} />
                        <AccountSunflowersCard accountId={accountId} />
                        <AccountAchievementsCard accountId={accountId} />
                        <AccountTransactionsCard accountId={accountId} />
                        <RaisedBedsTableCard accountId={accountId} scroll />
                        <AccountEventsCard
                            accountId={accountId}
                            searchParams={resolvedSearchParams}
                        />
                        <NotificationsTableCard accountId={accountId} scroll />
                        <AccountInventoryCard accountId={accountId} />
                        <AccountShoppingCartsCard accountId={accountId} />
                    </div>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
