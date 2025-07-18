import { Stack } from "@signalco/ui-primitives/Stack";
import { auth } from "../../../lib/auth/auth";
import { RaisedBedsTableCard } from "../accounts/[accountId]/RaisedBedsTableCard";
import { Typography } from "@signalco/ui-primitives/Typography";

export const dynamic = 'force-dynamic';

export default async function RaisedBedsPage() {
    await auth(['admin']);
    return (
        <Stack spacing={2}>
            <Typography level="h1" className="text-2xl" semiBold>Gredice</Typography>
            <RaisedBedsTableCard />
        </Stack>
    );
};