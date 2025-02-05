import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { Button } from "@signalco/ui-primitives/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Container } from "@signalco/ui-primitives/Container";
import { Input } from "@signalco/ui-primitives/Input";
import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NoNotificationsPlaceholder } from "../shared-ui/NoNotificationsPlaceholder";
import { Divider } from "@signalco/ui-primitives/Divider";
import { Row, RowProps } from "@signalco/ui-primitives/Row";
import { cx } from "@signalco/ui-primitives/cx";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { ProfileInfo } from "../shared-ui/ProfileInfo";
import { NoSunflowersPlaceholder } from "../shared-ui/NoSunflowersPlaceholder";
import { SoundSettingsCard } from "./components/SoundSettingsCard";

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

export function OverviewModal() {
    const [settingsMode, setProfileModalOpen] = useSearchParam('pregled');

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setProfileModalOpen(undefined);
        }
    }

    const currentUser = useCurrentUser();
    const dateFormatter = new Intl.DateTimeFormat('hr-HR', { month: 'long', year: 'numeric' });
    const memberSinceDisplay = currentUser.data?.createdAt
        ? dateFormatter.format(currentUser.data?.createdAt)
        : undefined;

    return (
        <Modal
            open={Boolean(settingsMode)}
            onOpenChange={handleOpenChange}
            className="min-w-full lg:min-w-[80%] xl:min-w-[60%] min-h-[70%]"
            title="Profil">
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
                            nodeId="profile-sunflowers"
                            label="Suncokreti"
                            selected={settingsMode === 'suncokreti'}
                            onSelected={() => setProfileModalOpen('suncokreti')}
                        />
                        <ListItem
                            nodeId="profile-notifications"
                            label="Obavijesti"
                            selected={settingsMode === 'obavijesti'}
                            onSelected={() => setProfileModalOpen('obavijesti')}
                        />
                        <Typography level="body3" uppercase bold className="py-4">Postavke</Typography>
                        <ListItem
                            nodeId="profile-security"
                            label="Sigurnost"
                            selected={settingsMode === 'sigurnost'}
                            onSelected={() => setProfileModalOpen('sigurnost')}
                        />
                        <ListItem
                            nodeId="profile-sound"
                            label="Zvuk"
                            selected={settingsMode === 'zvuk'}
                            onSelected={() => setProfileModalOpen('zvuk')}
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
                                                defaultValue={currentUser.data?.displayName}
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
                                    <Typography level="body1">Prijavljeni ste putem email adrese: <strong>{currentUser.data?.userName}</strong>.</Typography>
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
                                                    autoComplete="current-password"
                                                    placeholder="Unesite trenutnu lozinku..."
                                                    required />
                                                <Input
                                                    name="password"
                                                    label="Nova lozinka"
                                                    type="password"
                                                    autoComplete="new-password"
                                                    placeholder="Unesite novu lozinku..."
                                                    required />
                                                <Input
                                                    name="passwordConfirm"
                                                    type="password"
                                                    autoComplete="new-password"
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
                    {settingsMode === 'zvuk' && (
                        <Stack spacing={4}>
                            <Typography level="h4">Zvuk</Typography>
                            <SoundSettingsCard />
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
                    {settingsMode === 'suncokreti' && (
                        <Stack spacing={4}>
                            <Typography level="h4">Suncokreti</Typography>
                            <Card className="p-4">
                                <NoSunflowersPlaceholder />
                            </Card>
                        </Stack>
                    )}
                </Container>
            </div>
        </Modal>
    )
}