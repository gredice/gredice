import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Button } from "@signalco/ui-primitives/Button";
import { Popper } from "@signalco/ui-primitives/Popper";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Divider } from "@signalco/ui-primitives/Divider";
import { HudCard } from "./components/HudCard";
import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { useCurrentAccount } from "../hooks/useCurrentAccount";
import { SunflowersList } from "../shared-ui/sunflowers/SunflowersList";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Navigate, Info } from "@signalco/ui-icons";
import { KnownPages } from "../knownPages";
import Image from "next/image";

function SunflowersCard() {
    const [, setProfileModalOpen] = useSearchParam('pregled');

    return (
        <Stack>
            <Row className="bg-background px-4 py-1" justifyContent="space-between">
                <Typography level="body2" bold>Suncokreti</Typography>
                <Popper
                    className="min-w-80 border-tertiary border-b-4"
                    trigger={(
                        <IconButton
                            title="Što su suncokreti?"
                            variant="plain">
                            <Info className="size-4 shrink-0" />
                        </IconButton>
                    )}>
                    <Row className="p-4" spacing={2}>
                        <Image
                            src="https://cdn.gredice.com/sunflower-large.svg"
                            alt="Suncokret"
                            width={80}
                            height={80}
                            className="size-20" />
                        <Stack spacing={2}>
                            <Typography level="body2">Suncokreti su vrsta bodova na tvom Gredice racunu koje dobiva za razne radnje i pomocu kojih mozes uciniti svoj vrt sto lijepsim i zdravijim.</Typography>
                            <Button variant="solid" size="sm" href={KnownPages.GrediceSunflowers} target="_blank" endDecorator={(<Navigate className="size-5" />)}>
                                Saznaj više
                            </Button>
                        </Stack>
                    </Row>
                </Popper>
            </Row>
            <Divider />
            <SunflowersList limit={5} />
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
    const { data: account, isPending } = useCurrentAccount();
    const sunflowerCount = account?.sunflowers.amount;

    if (isPending) {
        return null;
    }

    return (
        <Popper
            className="overflow-hidden border-tertiary border-b-4"
            side="bottom"
            sideOffset={12}
            trigger={(
                <Button
                    variant="plain"
                    title="Suncokreti"
                    startDecorator={(
                        <img src="https://cdn.gredice.com/sunflower-large.svg"
                            alt="Suncokret"
                            className="size-6" />
                    )}
                    className="rounded-full px-2 md:min-w-20 justify-between pr-4">
                    <Typography level="body2" className="text-base pl-0.5">{sunflowerCount}</Typography>
                </Button>
            )}>
            <SunflowersCard />
        </Popper>
    );
}

export function SunflowersHud() {
    return (
        <HudCard position="floating" open className="static">
            <SunflowersAmount />
        </HudCard>
    );
}