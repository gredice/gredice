import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Button } from "@signalco/ui-primitives/Button";
import { Popper } from "@signalco/ui-primitives/Popper";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Divider } from "@signalco/ui-primitives/Divider";
import { HudCard } from "./components/HudCard";
import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { NoSunflowersPlaceholder } from "../shared-ui/NoSunflowersPlaceholder";
import { useSunflowers } from "../hooks/useSunflowers";

function SunflowersCard() {
    const [, setProfileModalOpen] = useSearchParam('pregled');
    const sunflowers = useSunflowers();

    return (
        <Stack>
            <Row className="bg-background px-4 py-2" justifyContent="space-between">
                <Typography level="body3" bold>Suncokreti</Typography>
            </Row>
            <Divider />
            <Stack className="p-4" spacing={2}>
                {!sunflowers.data.activity.length && <NoSunflowersPlaceholder />}
            </Stack>
            <Divider />
            <Stack>
                <Button variant="plain" size="sm" fullWidth className="rounded-t-none" onClick={() => setProfileModalOpen('suncokreti')}>
                    Prikaži sve aktivnosti
                </Button>
            </Stack>
        </Stack>
    );
}

function SunflowersAmount() {
    const sunflowerCount = 0;

    return (
        <Popper
            className="overflow-hidden"
            side="bottom"
            sideOffset={12}
            trigger={(
                <Button
                    variant="plain"
                    startDecorator={<Typography className="text-base md:text-xl">🌻</Typography>}
                    className="rounded-full px-2 md:min-w-20 justify-between pr-4" size="sm">
                    <Typography level="body2" className="text-base">{sunflowerCount}</Typography>
                </Button>
            )}>
            <SunflowersCard />
        </Popper>
    );
}

export function SunflowersHud() {
    return (
        <HudCard position="floating" open className="right-2 top-2">
            <SunflowersAmount />
        </HudCard>
    );
}