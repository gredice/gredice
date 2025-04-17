import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { EmailsList } from "./EmailsList";
import { Row } from "@signalco/ui-primitives/Row";

export default function InboxPage() {
    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>{"Sandučić"}</Typography>
            </Row>
            <EmailsList />
        </Stack>
    )
}