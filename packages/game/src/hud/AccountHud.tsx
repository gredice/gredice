import { Avatar } from "@signalco/ui-primitives/Avatar";
import { HudCard } from "./components/HudCard";
import { Row, RowProps } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Check, CheckCheck, Inbox, LogOut, User } from 'lucide-react';
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Button } from "@signalco/ui-primitives/Button";
import { HTMLAttributes } from "react";
import { Popper } from "@signalco/ui-primitives/Popper";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Divider } from "@signalco/ui-primitives/Divider";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@signalco/ui-primitives/Menu';
import { Modal } from "@signalco/ui-primitives/Modal";
import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { cx } from "@signalco/ui-primitives/cx";
import { Input } from "@signalco/ui-primitives/Input";
import { Container } from "@signalco/ui-primitives/Container";
import { initials } from "@signalco/js";
import { useControllableState } from "@signalco/hooks/useControllableState";

function SunflowersCard() {
    return (
        <Stack>
            <Row className="bg-background px-4 py-2" justifyContent="space-between">
                <Typography level="body3" bold>Suncokreti</Typography>
            </Row>
            <Divider />
            <Stack className="p-4">
                <Typography level="body2" className="flex items-center gap-2">
                    <span className="text-2xl pb-1 leading-none">🥺</span>
                    <span>Nema suncokreta</span>
                </Typography>
            </Stack>
        </Stack>
    );
}

function NoNotificationsPlaceholder() {
    return (
        <Typography level="body2" className="flex items-center gap-2">
            <span className="text-2xl pb-3 leading-none">📪</span>
            <span>Nema novih obavijesti</span>
        </Typography>
    );
}

function NotificationsCard() {
    const [, setProfileModalOpen] = useSearchParam('pregled');

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
                <NoNotificationsPlaceholder />
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
    const currentGarden = useCurrentGarden();

    return (
        // TODO: Enable when implemented
        // <Button variant="plain" className="rounded-full px-2 max-w-24 min-w-14" size="sm">
        <div className="px-2 min-w-32">
            <SelectItems
                variant="plain"
                value="1"
                items={[
                    { value: currentGarden.data?.id, label: currentGarden.data?.name },
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

function CardActions({ children, className, ...rest }: RowProps) {
    return (
        <Stack spacing={2} className="-mx-8 -mb-8">
            <Divider />
            <Row className={cx('px-8 pb-4', className)} {...rest}>
                {children}
            </Row>
        </Stack>
    );
}

function useCurrentUser() {
    return {
        data: { user: { email: 'user@example.com', displayName: 'Korisnik 123', createdAt: new Date().getDate() } },
        isLoading: false
    }
}

function useCurrentGarden() {
    return {
        data: { id: '1', name: 'Moj vrt' },
        isLoading: false
    };
}

function ProfileModal() {
    const [settingsMode, setProfileModalOpen] = useSearchParam<string>('pregled', 'profil');

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setProfileModalOpen(undefined);
        }
    }

    const currentUser = useCurrentUser();
    const dateFormatter = new Intl.DateTimeFormat('hr-HR', { month: 'long', year: 'numeric' });
    const memberSinceDisplay = currentUser.data?.user?.createdAt
        ? dateFormatter.format(currentUser.data?.user?.createdAt)
        : undefined;

    return (
        <Modal open onOpenChange={handleOpenChange} className="min-w-full lg:min-w-[80%] xl:min-w-[60%] min-h-[70%]">
            <div className="grid grid-cols-[minmax(230px,auto)_1fr]">
                <Stack spacing={2} className="border-r">
                    <ProfileInfo />
                    <List className="pr-6">
                        <Typography level="body3" uppercase bold className="py-4">Profil</Typography>
                        <ListItem
                            nodeId="profile-general"
                            label="Generalno"
                            selected={settingsMode === 'generalno'}
                            onSelected={() => setProfileModalOpen('generalno')}
                        />
                        <ListItem
                            nodeId="profile-security"
                            label="Sigurnost"
                            selected={settingsMode === 'sigurnost'}
                            onSelected={() => setProfileModalOpen('sigurnost')}
                        />
                        <ListItem
                            nodeId="profile-notifications"
                            label="Obavijesti"
                            selected={settingsMode === 'obavijesti'}
                            onSelected={() => setProfileModalOpen('obavijesti')}
                        />
                    </List>
                </Stack>
                <Container className="pl-6" maxWidth="sm">
                    {settingsMode === 'generalno' && (
                        <Stack spacing={4}>
                            <Typography level="h4">Profil</Typography>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Prikazano ime</CardTitle>
                                </CardHeader>
                                <form>
                                    <CardContent>
                                        <Stack spacing={4}>
                                            <Typography level="body2">Ime koje će biti prikazano drugim korisnicima.</Typography>
                                            <Input
                                                name="displayName"
                                                defaultValue={currentUser.data?.user?.displayName}
                                                type="text"
                                                placeholder="Unesite ime..."
                                                required />
                                            <CardActions className="justify-between">
                                                <Typography level="body2">Član od: {memberSinceDisplay}</Typography>
                                                <Button size="sm" variant="solid" type="submit">Spremi</Button>
                                            </CardActions>
                                        </Stack>
                                    </CardContent>
                                </form>
                            </Card>
                        </Stack>
                    )}
                    {settingsMode === 'sigurnost' && (
                        <Stack spacing={4}>
                            <Typography level="h4">Sigurnost</Typography>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Prijava</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Typography level="body1">Prijavljeni ste putem email adrese <strong>{currentUser.data?.user?.email}</strong>.</Typography>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Lozinka</CardTitle>
                                </CardHeader>
                                <form>
                                    <CardContent>
                                        <Stack spacing={4}>
                                            <Typography level="body2">Promijenite lozinku za svoj račun.</Typography>
                                            <Stack spacing={1}>
                                                <Input
                                                    name="currentPassword"
                                                    label="Trenutna lozinka"
                                                    type="password"
                                                    placeholder="Unesite trenutnu lozinku..."
                                                    required />
                                                <Input
                                                    name="password"
                                                    label="Nova lozinka"
                                                    type="password"
                                                    placeholder="Unesite novu lozinku..."
                                                    required />
                                                <Input
                                                    name="passwordConfirm"
                                                    type="password"
                                                    placeholder="Potvrdite novu lozinku..."
                                                    required />
                                            </Stack>
                                            <CardActions className="justify-end">
                                                <Button size="sm" variant="solid" type="submit">Spremi</Button>
                                            </CardActions>
                                        </Stack>
                                    </CardContent>
                                </form>
                            </Card>
                        </Stack>
                    )}
                    {settingsMode === 'obavijesti' && (
                        <Stack spacing={4}>
                            <Typography level="h4">Obavijesti</Typography>
                            <Card className="p-4">
                                <NoNotificationsPlaceholder />
                            </Card>
                        </Stack>
                    )}
                </Container>
            </div>
        </Modal>
    )
}

function ProfileInfo() {
    const currentUser = useCurrentUser();

    return (
        <Row spacing={2}>
            <ProfileAvatar />
            <Stack spacing={0.5}>
                <Typography level="body2" semiBold className="leading-none">
                    {currentUser.data?.user?.displayName}
                </Typography>
                <Typography level="body3" className="leading-none">
                    {currentUser.data?.user?.email}
                </Typography>
            </Stack>
        </Row>
    )
}

function ProfileAvatar() {
    const currentUser = useCurrentUser();

    return (
        <Avatar>
            {initials(currentUser.data?.user?.displayName)}
        </Avatar>
    );
}

function ProfileCard() {
    const [, setProfileModalOpen] = useSearchParam('pregled');
    const currentGarden = useCurrentGarden();

    return (
        <DropdownMenuContent className="w-80 p-4" align="end" sideOffset={12}>
            <ProfileInfo />
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem className="gap-3 bg-muted">
                <Check className="h-4 w-4" />
                <span>{currentGarden.data?.name}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem className="gap-3" onClick={() => setProfileModalOpen('generalno')}>
                <User className="h-4 w-4" />
                <span>Profil</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3" onClick={() => setProfileModalOpen('obavijesti')}>
                <Inbox className="h-4 w-4" />
                <span>Obavijesti</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-4" />
            <DropdownMenuItem className="gap-3" href="/odjava">
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    )
}

function Profile() {
    return (
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
    )
}

export function AccountHud() {
    const [profileModalOpen] = useSearchParam('pregled');

    return (
        <>
            <HudCard
                open
                position="floating"
                className="md:p-1 md:pr-2 left-2 top-2">
                <Row>
                    <Profile />
                    <div className="hidden md:block">
                        <GardenPicker />
                    </div>
                    <div className="hidden md:block">
                        <Notifications />
                    </div>
                </Row>
            </HudCard>
            <HudCard position="floating" open className="right-2 top-2">
                <SunflowersAmount />
            </HudCard>
            {profileModalOpen && (
                <ProfileModal />
            )}
        </>
    );
}