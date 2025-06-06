import { HudCard } from "./components/HudCard";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
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
import { useCurrentUser } from "../hooks/useCurrentUser";
import { Skeleton } from "@signalco/ui-primitives/Skeleton";
import { KnownPages } from "../knownPages";
import { Check, User, Inbox, ExternalLink, Approved, Configuration, Sprout, LogOut } from "@signalco/ui-icons";
import { useNotifications } from "../hooks/useNotifications";

function NotificationsCard() {
    const [, setProfileModalOpen] = useSearchParam('pregled');
    const { data: currentUser } = useCurrentUser();
    const notifications = useNotifications(currentUser?.id, false);

    return (
        <Stack>
            <Row className="bg-background px-4 py-2" justifyContent="space-between">
                <Typography level="body3" bold>Obavijesti</Typography>
                <IconButton
                    variant="plain"
                    size="sm"
                    title="Označi sve kao pročitane"
                    disabled={!notifications.data?.length}>
                    <Approved />
                </IconButton>
            </Row>
            <Divider />
            <Stack className="p-4" spacing={2}>
                {!notifications.data?.length && <NoNotificationsPlaceholder />}
                {notifications.data?.map((notification, index) => (
                    <Stack key={notification.id ?? index}>
                        <Typography level="body2" bold>{notification.header}</Typography>
                        <Typography level="body2">{notification.content}</Typography>
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
                    <Check className="size-4" />
                    <span>{currentGarden.name}</span>
                </DropdownMenuItem>
            ) : (
                <DropdownMenuLabel className="bg-muted">Još nemaš svoj vrt</DropdownMenuLabel>
            )}
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem className="gap-3" onClick={() => setProfileModalOpen('generalno')}>
                <User className="size-4" />
                <span>Profil</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3" onClick={() => setProfileModalOpen('obavijesti')}>
                <Inbox className="size-4" />
                <span>Obavijesti</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3" onClick={() => setProfileModalOpen('generalno')}>
                <Configuration className="size-4" />
                <span>Postavke</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem className="gap-3 justify-between" href={KnownPages.GredicePlants}>
                <Row spacing={1.5}>
                    <Sprout className="size-4" />
                    <span>Baza biljaka</span>
                </Row>
                <ExternalLink className="size-4 self-end" />
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem className="gap-3" href="/odjava">
                <LogOut className="size-4" />
                <span>Odjava</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    )
}

export function AccountHud() {
    const { data: currentGarden, isPending } = useCurrentGarden();

    return (
        <HudCard
            open
            position="floating"
            className="md:px-2 static">
            <Row spacing={1}>
                <DropdownMenu
                    className="overflow-hidden"
                    side="bottom"
                    sideOffset={12}>
                    <DropdownMenuTrigger asChild>
                        <Button className="rounded-full p-0.5 aspect-square hover:outline hover:outline-1 hover:outline-offset-1 hover:outline-primary" size='sm' variant="plain" title="Obavijesti">
                            <ProfileAvatar variant="transparentOnMobile" />
                        </Button>
                    </DropdownMenuTrigger>
                    <ProfileCard />
                </DropdownMenu>
                <div className="hidden md:block">
                    {isPending ? (
                        <Skeleton className="w-32 h-7" />
                    ) : (currentGarden && (
                        <SelectItems
                            className="w-32"
                            variant="plain"
                            value={currentGarden.id.toString()}
                            items={[
                                { value: currentGarden.id.toString(), label: currentGarden.name },
                            ]} />
                    )
                    )}
                </div>
                <div className="hidden md:block">
                    <Popper
                        className="overflow-hidden border-tertiary border-b-4"
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