import { Avatar } from "@signalco/ui-primitives/Avatar";
import { HudCard } from "./components/HudCard";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { CheckCheck, Inbox } from 'lucide-react';
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Button } from "@signalco/ui-primitives/Button";
import { HTMLAttributes } from "react";
import { Popper } from "@signalco/ui-primitives/Popper";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Divider } from "@signalco/ui-primitives/Divider";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";

function SunflowersCard() {
    return (
        <Stack>
            <Row className="bg-background px-4 py-2" justifyContent="space-between">
                <Typography level="body3" bold>Suncokreti</Typography>
            </Row>
            <Divider />
            <Stack className="p-4">
                <Typography level="body2">Nema novih suncokreta</Typography>
            </Stack>
        </Stack>
    );
}

function NotificationsCard() {
    return (
        <Stack>
            <Row className="bg-background px-4 py-2" justifyContent="space-between">
                <Typography level="body3" bold>Obavijesti</Typography>
                <IconButton variant="plain" size="sm" title="Označi sve kao pročitane">
                    <CheckCheck />
                </IconButton>
            </Row>
            <Divider />
            <Stack className="p-4">
                <Typography level="body2">Nema novih obavjesti</Typography>
            </Stack>
        </Stack>
    );
}

export default function SunflowerIcon(props: HTMLAttributes<SVGElement>) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            {/* Petals */}
            {[...Array(12)].map((_, i) => (
                <path
                    key={i}
                    d="M12 8C14 8 15 2 12 0C9 2 10 8 12 8Z"
                    stroke="black"
                    strokeWidth="1.25"
                    transform={`rotate(${i * 30} 12 12)`}
                />
            ))}

            {/* Center of flower */}
            <circle cx="12" cy="12" r="4" stroke="black" strokeWidth="1.25" />
        </svg>
    )
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
                    startDecorator={<Typography className="text-xl">🌻</Typography>}
                    className="rounded-full px-2 min-w-20 justify-between pr-4" size="sm">
                    <Typography level="body2" className="text-xl">{sunflowerCount}</Typography>
                </Button>
            )}>
            <SunflowersCard />
        </Popper>
    );
}

function GardenPicker() {
    return (
        // TODO: Enable when implemented
        // <Button variant="plain" className="rounded-full px-2 max-w-24 min-w-14" size="sm">
        <div className="px-2 min-w-32">
            <SelectItems
                variant="plain"
                value="1"
                items={[
                    { value: '1', label: 'Moj vrt' },
                ]} />
        </div>
        // </Button>
    )
}

function Notifications() {
    const notificationCount = 0;

    return (
        <Popper
            className="overflow-hidden"
            side="bottom"
            sideOffset={12}
            trigger={(
                <Button className="rounded-full p-0 aspect-square" size='sm' variant="plain" title="Obavijesti">
                    <Inbox className="size-5" />
                </Button>
            )}>
            <NotificationsCard />
        </Popper>
    );
}

function ProfileCard() {
    return (
        <Stack>
            <Row className="bg-background px-4 py-2" justifyContent="space-between">
                <Typography level="body3" bold>Profil</Typography>
            </Row>
            <Divider />
            <Stack className="p-4">
                <Typography level="body2">Ime Prezime</Typography>
                <Typography level="body2">
                    <a href="#">Uredi profil</a>
                </Typography>
            </Stack>
        </Stack>
    )
}

function Profile() {
    return (
        <Popper
            className="overflow-hidden"
            side="bottom"
            sideOffset={12}
            trigger={(
                <Button className="rounded-full p-0 aspect-square" size='sm' variant="plain" title="Obavijesti">
                    <Avatar>
                        G
                    </Avatar>
                </Button>
            )}>
            <ProfileCard />
        </Popper>
    )
}

export function AccountHud() {
    return (
        <>
            <HudCard position='top-left' open className="left-0 top-0 p-1 pr-2">
                <Row>
                    <Profile />
                    <GardenPicker />
                    <Notifications />
                </Row>
            </HudCard>
            <HudCard position="floating" open className="right-2 top-2">
                <SunflowersAmount />
            </HudCard>
        </>
    );
}