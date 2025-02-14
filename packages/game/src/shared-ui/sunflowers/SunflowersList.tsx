import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";
import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { useCurrentAccount } from "../../hooks/useCurrentAccount";
import { NoSunflowersPlaceholder } from "./NoSunflowersPlaceholder";
import { Circle } from "lucide-react";
import { BlockImage } from "../BlockImage";

function sunflowerReasonToDescription(reason: string) {
    if (reason === 'registration') {
        return { icon: <span className="text-4xl size-10">🎉</span>, label: 'Nagrada za registraciju' };
    }

    if (reason.startsWith('block')) {
        return { icon: <BlockImage blockName={reason.split(':')[1]} className="size-10" />, label: 'Postavljanje bloka' };
    }
    if (reason === 'gift') {
        return { icon: <span className="text-4xl size-10">🎁</span>, label: 'Poklon' };
    }

    console.warn('Unknown sunflower reason:', reason);
    return { icon: <Circle className="size-10" />, label: 'Nepoznato' };
}

export function SunflowersList() {
    const { data: account } = useCurrentAccount();
    const history = account?.sunflowers.history;
    if (!history?.length) {
        return <NoSunflowersPlaceholder />;
    }

    return (
        <List>
            {history.map((event) => {
                const description = sunflowerReasonToDescription(event.reason);
                return (
                    <ListItem
                        key={event.id}
                        label={(
                            <Row spacing={1} justifyContent="space-between">
                                <Row spacing={2}>
                                    {description.icon}
                                    <Stack>
                                        <Typography level="body2">{description.label}</Typography>
                                        <Typography level="body3">{new Date(event.createdAt).toLocaleDateString('hr-HR', { day: "numeric", month: 'long', year: 'numeric' })}</Typography>
                                    </Stack>
                                </Row>
                                <Typography color={event.amount > 0 ? 'success' : 'danger'}>{event.amount > 0 ? `+${event.amount}` : event.amount}</Typography>
                            </Row>
                        )} />
                );
            })}
        </List>
    )
}