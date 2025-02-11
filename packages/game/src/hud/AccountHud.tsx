import { HudCard } from "./components/HudCard";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Check, CheckCheck, Inbox, LogOut, Settings2, User } from 'lucide-react';
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Button } from "@signalco/ui-primitives/Button";
import { Popper } from "@signalco/ui-primitives/Popper";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Divider } from "@signalco/ui-primitives/Divider";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@signalco/ui-primitives/Menu';
import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { NoNotificationsPlaceholder } from "../shared-ui/NoNotificationsPlaceholder";
import { useCurrentGarden } from "../hooks/useCurrentGarden";
import { ProfileInfo } from "../shared-ui/ProfileInfo";
import { ProfileAvatar } from "../shared-ui/ProfileAvatar";
import { useNotifications } from "../hooks/useNotifications";
import { Skeleton } from "@signalco/ui-primitives/Skeleton";

function NotificationsCard() {
    const [, setProfileModalOpen] = useSearchParam('pregled');
    const notifications = useNotifications();

    return (
        <Stack>
            <Row className="bg-background px-4 py-2" justifyContent="space-between">
                <Typography level="body3" bold>Obavijesti</Typography>
                <IconButton
                    variant="plain"
                    size="sm"
                    title="Označi sve kao pročitane"
                    disabled={!notifications.data.notifications.length}>
                    <CheckCheck />
                </IconButton>
            </Row>
            <Divider />
            <Stack className="p-4" spacing={2}>
                {!notifications.data.notifications.length && <NoNotificationsPlaceholder />}
                {notifications.data.notifications.map((notification, index) => (
                    <Stack key={index}>
                        <Typography level="body2" bold>{notification.title}</Typography>
                        <Typography level="body2">{notification.description}</Typography>
                    </Stack>
                ))}
            </Stack>
            <Divider />
            <Stack>
                <Button variant="plain" size="sm" fullWidth className="rounded-t-none" onClick={() => setProfileModalOpen('obavijesti')}>
                    Prikaži sve obavijesti
                </Button>
            </Stack>
        </Stack>
    );
}

function ProfileCard() {
    const [, setProfileModalOpen] = useSearchParam('pregled');
    const { data: currentGarden } = useCurrentGarden();

    return (
        <DropdownMenuContent className="w-80 p-4" align="end" sideOffset={12}>
            <ProfileInfo />
            <DropdownMenuSeparator className="my-4" />
            {currentGarden ? (
                <DropdownMenuItem className="gap-3 bg-muted">
                    <Check className="h-4 w-4" />
                    <span>{currentGarden.name}</span>
                </DropdownMenuItem>
            ) : (
                <DropdownMenuLabel className="bg-muted">Nemate vrt</DropdownMenuLabel>
            )}
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem className="gap-3" onClick={() => setProfileModalOpen('generalno')}>
                <User className="h-4 w-4" />
                <span>Profil</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3" onClick={() => setProfileModalOpen('obavijesti')}>
                <Inbox className="h-4 w-4" />
                <span>Obavijesti</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3" onClick={() => setProfileModalOpen('generalno')}>
                <Settings2 className="h-4 w-4" />
                <span>Postavke</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem className="gap-3" href="/odjava">
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    )
}

export function AccountHud() {
    const { data: currentGarden, isLoading } = useCurrentGarden();

    return (
        <HudCard
            open
            position="floating"
            className="left-2 top-2 md:px-2">
            <Row spacing={1}>
                <DropdownMenu
                    className="overflow-hidden"
                    side="bottom"
                    sideOffset={12}>
                    <DropdownMenuTrigger asChild>
                        <Button className="rounded-full p-0 aspect-square hover:outline hover:outline-1 hover:outline-offset-1 hover:outline-primary" size='sm' variant="plain" title="Obavijesti">
                            <ProfileAvatar />
                        </Button>
                    </DropdownMenuTrigger>
                    <ProfileCard />
                </DropdownMenu>
                <div className="hidden md:block">
                    {isLoading ? (
                        <Skeleton className="w-32 h-7" />
                    ) : (currentGarden && (
                            <SelectItems
                                className="w-32"
                                variant="plain"
                                value="1"
                                items={[
                                    { value: currentGarden.id.toString(), label: currentGarden.name },
                                ]} />
                    )
                    )}
                </div>
                <div className="hidden md:block">
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
                </div>
            </Row>
        </HudCard>
    );
}