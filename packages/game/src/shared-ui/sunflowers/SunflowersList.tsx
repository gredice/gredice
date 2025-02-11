import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";
import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { useCurrentAccount } from "../../hooks/useCurrentAccount";
import { NoSunflowersPlaceholder } from "./NoSunflowersPlaceholder";

function sunflowerReasonToDescription(reason: string) {
    switch (reason) {
        case 'registration':
            return 'Nagrada za registraciju 🎉';
        default:
            return 'Nepoznato';
    }
}

export function SunflowersList() {
    const { data: account } = useCurrentAccount();
    const history = account?.sunflowers.history;
    if (!history?.length) {
        return <NoSunflowersPlaceholder />;
    }

    return (
        <List>
            {history.map((event) => (
                <ListItem
                    key={event.id}
                    label={(
                        <Row spacing={1} justifyContent="space-between">
                            <Stack>
                                <Typography level="body2">{sunflowerReasonToDescription(event.reason)}</Typography>
                                <Typography level="body3">{new Date(event.createdAt).toLocaleDateString('hr-HR', { day: "numeric", month: 'long', year: 'numeric' })}</Typography>
                            </Stack>
                            <Typography color={event.amount > 0 ? 'success' : 'danger'}>{event.amount > 0 ? `+${event.amount}` : event.amount}</Typography>
                        </Row>
                    )} />
            ))}
        </List>
    )
}