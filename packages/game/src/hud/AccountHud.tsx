import { useSearchParam } from '@signalco/hooks/useSearchParam';
import {
    Approved,
    Check,
    Comment,
    Configuration,
    ExternalLink,
    Inbox,
    LogOut,
    Sprout,
    User,
} from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Divider } from '@signalco/ui-primitives/Divider';
import { DotIndicator } from '@signalco/ui-primitives/DotIndicator';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import { Popper } from '@signalco/ui-primitives/Popper';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useMarkAllNotificationsRead } from '../hooks/useMarkAllNotificationsRead';
import { useNotifications } from '../hooks/useNotifications';
import { KnownPages } from '../knownPages';
import { ProfileAvatar } from '../shared-ui/ProfileAvatar';
import { ProfileInfo } from '../shared-ui/ProfileInfo';
import { HudCard } from './components/HudCard';
import { NotificationList } from './NotificationList';

function NotificationsCard() {
    const [, setProfileModalOpen] = useSearchParam('pregled');
    const markAllNotificationsRead = useMarkAllNotificationsRead();

    const handleMarkAllNotificationsRead = () => {
        markAllNotificationsRead.mutate({ readWhere: 'game' });
    };

    return (
        <Stack>
            <Row
                className="bg-background px-4 py-2"
                justifyContent="space-between"
            >
                <Typography level="body2" bold>
                    Obavijesti
                </Typography>
                <IconButton
                    variant="plain"
                    size="sm"
                    title="Označi sve kao pročitane"
                    onClick={handleMarkAllNotificationsRead}
                >
                    <Approved />
                </IconButton>
            </Row>
            <Divider />
            <div className="overflow-y-auto max-h-[50vh]">
                <NotificationList short />
            </div>
            <Divider />
            <Stack>
                <Button
                    variant="plain"
                    size="sm"
                    fullWidth
                    className="rounded-t-none"
                    onClick={() => setProfileModalOpen('obavijesti')}
                >
                    Prikaži sve obavijesti
                </Button>
            </Stack>
        </Stack>
    );
}

function ProfileCard() {
    const [, setProfileModalOpen] = useSearchParam('pregled');
    const { data: currentUser } = useCurrentUser();
    const { data: currentGarden } = useCurrentGarden();
    const { data: notifications } = useNotifications(currentUser?.id, false);
    const hasUnreadNotifications = notifications?.some(
        (notification) => !notification.readAt,
    );

    return (
        <DropdownMenuContent className="w-80 p-4" align="end" sideOffset={12}>
            <ProfileInfo />
            <DropdownMenuSeparator className="my-4" />
            {currentGarden ? (
                <DropdownMenuItem className="gap-3 bg-muted">
                    <Check className="size-4 shrink-0" />
                    <Typography noWrap>{currentGarden.name}</Typography>
                </DropdownMenuItem>
            ) : (
                <DropdownMenuLabel className="bg-muted">
                    Još nemaš svoj vrt
                </DropdownMenuLabel>
            )}
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem
                className="gap-3"
                onClick={() => setProfileModalOpen('generalno')}
            >
                <User className="size-4" />
                <span>Profil</span>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="gap-3"
                onClick={() => setProfileModalOpen('obavijesti')}
                endDecorator={
                    hasUnreadNotifications && <DotIndicator color={'success'} />
                }
            >
                <Inbox className="size-4" />
                <span>Obavijesti</span>
            </DropdownMenuItem>
            <DropdownMenuItem
                className="gap-3"
                onClick={() => setProfileModalOpen('generalno')}
            >
                <Configuration className="size-4" />
                <span>Postavke</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem
                className="gap-3 justify-between"
                href={KnownPages.GredicePlants}
            >
                <Row spacing={1.5}>
                    <Sprout className="size-4" />
                    <span>Baza biljaka</span>
                </Row>
                <ExternalLink className="size-4 self-end" />
            </DropdownMenuItem>
            <DropdownMenuItem
                className="gap-3 justify-between"
                href={KnownPages.GrediceContact}
            >
                <Row spacing={1.5}>
                    <Comment className="size-4" />
                    <span>Kontaktiraj nas</span>
                </Row>
                <ExternalLink className="size-4 self-end" />
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem className="gap-3" href="/odjava">
                <LogOut className="size-4" />
                <span>Odjava</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    );
}

export function AccountHud() {
    const { data: currentUser } = useCurrentUser();
    const { data: currentGarden, isLoading } = useCurrentGarden();
    const { data: notifications } = useNotifications(currentUser?.id, false);
    const hasUnreadNotifications = notifications?.some(
        (notification) => !notification.readAt,
    );

    return (
        <HudCard open position="floating" className="p-0.5 md:px-2 static">
            <Row spacing={1}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <IconButton
                            className="size-10 md:size-auto relative rounded-full p-0.5 aspect-square shrink-0 md:hover:outline outline-offset-2 outline-tertiary-foreground"
                            variant="plain"
                            title="Profil"
                        >
                            <ProfileAvatar variant="transparentOnMobile" />
                            {hasUnreadNotifications && (
                                <div className="md:hidden absolute right-0 -top-1">
                                    <DotIndicator size={14} color={'success'} />
                                </div>
                            )}
                        </IconButton>
                    </DropdownMenuTrigger>
                    <ProfileCard />
                </DropdownMenu>
                <div className="hidden md:block">
                    {isLoading ? (
                        <Skeleton className="w-32 h-7" />
                    ) : (
                        currentGarden && (
                            <SelectItems
                                className="w-32"
                                variant="plain"
                                value={currentGarden.id.toString()}
                                items={[
                                    {
                                        value: currentGarden.id.toString(),
                                        label: currentGarden.name,
                                    },
                                ]}
                            />
                        )
                    )}
                </div>
                <div className="hidden md:block">
                    <Popper
                        className="overflow-hidden border-tertiary border-b-4 w-96"
                        side="bottom"
                        sideOffset={12}
                        trigger={
                            <Button
                                className="relative rounded-full p-0 aspect-square"
                                variant="plain"
                                title="Obavijesti"
                            >
                                {hasUnreadNotifications && (
                                    <div className="absolute right-1 top-1">
                                        <DotIndicator color={'success'} />
                                    </div>
                                )}
                                <Inbox className="size-5" />
                            </Button>
                        }
                    >
                        <NotificationsCard />
                    </Popper>
                </div>
            </Row>
        </HudCard>
    );
}
