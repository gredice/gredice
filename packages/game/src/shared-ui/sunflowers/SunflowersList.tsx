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

export function SunflowersList({ limit }: { limit?: number }) {
    const { data: account } = useCurrentAccount();
    const history = account?.sunflowers.history;
    if (!history?.length) {
        return (
            <div className="px-2 py-4">
                <NoSunflowersPlaceholder />
            </div>
        );
    }

    // Group similar items on a daily basis
    const historyGrouped = history.reduce((acc, event) => {
        const eventDate = new Date(event.createdAt).toLocaleDateString();
        const key = `${eventDate}-${event.reason}-${event.amount}`;

        if (!acc.has(key)) {
            acc.set(key, {
                ...event,
                totalAmount: event.amount,
                count: 1
            });
        } else {
            const existingEvent = acc.get(key);
            if (!existingEvent) {
                return acc;
            }
            existingEvent.totalAmount += event.amount;
            existingEvent.count += 1;
        }

        return acc;
    }, new Map<string, (typeof history)[0] & { count: number, totalAmount: number }>());
    const historyGroupedArray = Array.from(historyGrouped.values());
    const actualLimit = limit ?? historyGroupedArray.length;

    return (
        <List>
            {historyGroupedArray.slice(0, actualLimit).map((event) => {
                const description = sunflowerReasonToDescription(event.reason);
                return (
                    <ListItem
                        key={event.id}
                        label={(
                            <Row spacing={1} justifyContent="space-between">
                                <Row spacing={2}>
                                    {description.icon}
                                    <Stack>
                                        <Row spacing={1}>
                                            <Typography level="body2">{description.label}</Typography>
                                            <Typography secondary>{event.count > 1 ? `x${event.count}` : ''}</Typography>
                                        </Row>
                                        <Typography level="body3">{new Date(event.createdAt).toLocaleDateString('hr-HR', { day: "numeric", month: 'long', year: 'numeric' })}</Typography>
                                    </Stack>
                                </Row>
                                <Typography color={event.totalAmount > 0 ? 'success' : 'danger'}>{event.totalAmount > 0 ? `+${event.totalAmount}` : event.totalAmount}</Typography>
                            </Row>
                        )} />
                );
            })}
        </List>
    )
}