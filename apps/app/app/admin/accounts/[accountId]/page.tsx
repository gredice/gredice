import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";
import { auth } from "../../../../lib/auth/auth";
import { Field } from "../../../../components/shared/fields/Field";
import { AccountSunflowersCard } from "./AccountSunflowersCard";
import { Typography } from "@signalco/ui-primitives/Typography";
import { AccountGardensCard } from "./AccountGardensCard";
import { AccountUsersCard } from "./AccountUsersCard";
import { AccountTransactionsCard } from "./AccountTransactionsCard";
import { NotificationsTableCard } from "../../../../components/notifications/NotificationsTableCard";
import { RaisedBedsTableCard } from "./RaisedBedsTableCard";

export const dynamic = 'force-dynamic';

export default async function AccountPage({ params }: { params: Promise<{ accountId: string; }> }) {
    const { accountId } = await params;
    await auth(['admin']);

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Stack spacing={2}>
                    <Breadcrumbs items={[
                        { label: 'Računi', href: KnownPages.Accounts },
                        { label: accountId }
                    ]} />
                    <Typography level="h1" semiBold>Račun</Typography>
                </Stack>
                <Stack spacing={2}>
                    <Field name="ID računa" value={accountId} />
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