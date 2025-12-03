import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Delete } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { NotificationsTableCard } from '../../../../components/notifications/NotificationsTableCard';
import { Field } from '../../../../components/shared/fields/Field';
import { FieldSet } from '../../../../components/shared/fields/FieldSet';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { sendDeleteAccountEmail } from '../../../(actions)/accountsActions';
import { getAccountTimeZone } from '../../../(actions)/accountTimeZoneActions';
import { AccountAchievementsCard } from './AccountAchievementsCard';
import { AccountEventsCard } from './AccountEventsCard';
import { AccountGardensCard } from './AccountGardensCard';
import { AccountShoppingCartsCard } from './AccountShoppingCartsCard';
import { AccountSunflowersCard } from './AccountSunflowersCard';
import { AccountTimeZonePicker } from './AccountTimeZonePicker';
import { AccountTransactionsCard } from './AccountTransactionsCard';
import { AccountUsersCard } from './AccountUsersCard';
import { RaisedBedsTableCard } from './RaisedBedsTableCard';

export const dynamic = 'force-dynamic';

export default async function AccountPage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;
    await auth(['admin']);

    const actionBound = sendDeleteAccountEmail.bind(null, accountId);
    const currentTimeZone = await getAccountTimeZone(accountId);

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Stack spacing={2}>
                    <Breadcrumbs
                        items={[
                            { label: 'Računi', href: KnownPages.Accounts },
                            { label: accountId },
                        ]}
                    />
                    <Row justifyContent="space-between">
                        <Typography level="h1" semiBold>
                            Račun
                        </Typography>
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
                    </Row>
                </Stack>
                <Stack spacing={2}>
                    <FieldSet>
                        <Field name="ID računa" value={accountId} />
                    </FieldSet>
                    <AccountTimeZonePicker
                        accountId={accountId}
                        currentTimeZone={currentTimeZone}
                    />
                </Stack>
            </Stack>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AccountUsersCard accountId={accountId} />
                <AccountGardensCard accountId={accountId} />
                <AccountSunflowersCard accountId={accountId} />
                <AccountAchievementsCard accountId={accountId} />
                <AccountTransactionsCard accountId={accountId} />
                <RaisedBedsTableCard accountId={accountId} />
                <AccountEventsCard accountId={accountId} />
                <NotificationsTableCard accountId={accountId} scroll />
                <AccountShoppingCartsCard accountId={accountId} />
            </div>
        </Stack>
    );
}
