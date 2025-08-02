import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";
import { auth } from "../../../../lib/auth/auth";
import { Field } from "../../../../components/shared/fields/Field";
import { AccountSunflowersCard } from "./AccountSunflowersCard";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { AccountGardensCard } from "./AccountGardensCard";
import { AccountUsersCard } from "./AccountUsersCard";
import { AccountTransactionsCard } from "./AccountTransactionsCard";
import { NotificationsTableCard } from "../../../../components/notifications/NotificationsTableCard";
import { RaisedBedsTableCard } from "./RaisedBedsTableCard";
import { Button } from "@signalco/ui-primitives/Button";
import { sendDeleteAccountEmail } from "../../../(actions)/accountsActions";
import { Delete } from "@signalco/ui-icons";
import { Row } from "@signalco/ui-primitives/Row";
import { FieldSet } from "../../../../components/shared/fields/FieldSet";

export const dynamic = 'force-dynamic';

export default async function AccountPage({ params }: { params: Promise<{ accountId: string; }> }) {
    const { accountId } = await params;
    await auth(['admin']);

    const actionBound = sendDeleteAccountEmail.bind(null, accountId);

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Stack spacing={2}>
                    <Breadcrumbs items={[
                        { label: 'Računi', href: KnownPages.Accounts },
                        { label: accountId }
                    ]} />
                    <Row justifyContent="space-between">
                        <Typography level="h1" semiBold>Račun</Typography>
                        <ModalConfirm
                            title="Potvrda brisanja računa"
                            header="Jeste li sigurni da želite izbrisati račun?"
                            expectedConfirm="Da"
                            onConfirm={actionBound}
                            trigger={(
                                <Button startDecorator={<Delete className="size-5 shrink-0" />}>
                                    Brisanje računa
                                </Button>
                            )} />
                    </Row>
                </Stack>
                <Stack spacing={2}>
                    <FieldSet>
                        <Field name="ID računa" value={accountId} />
                    </FieldSet>
                </Stack>
            </Stack>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AccountUsersCard accountId={accountId} />
                <AccountGardensCard accountId={accountId} />
                <AccountSunflowersCard accountId={accountId} />
                <AccountTransactionsCard accountId={accountId} />
                <RaisedBedsTableCard accountId={accountId} />
                <NotificationsTableCard accountId={accountId} />
            </div>
        </Stack>
    );
}