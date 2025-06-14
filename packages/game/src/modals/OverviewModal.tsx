import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { Button } from "@signalco/ui-primitives/Button";
import { Card, CardContent, CardActions } from "@signalco/ui-primitives/Card";
import { Input } from "@signalco/ui-primitives/Input";
import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NoNotificationsPlaceholder } from "../shared-ui/NoNotificationsPlaceholder";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { ProfileInfo } from "../shared-ui/ProfileInfo";
import { SoundSettingsCard } from "./components/SoundSettingsCard";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { SunflowersList } from "../shared-ui/sunflowers/SunflowersList";
import { useCurrentAccount } from "../hooks/useCurrentAccount";
import { ScrollArea } from "@signalco/ui-primitives/ScrollArea";
import { UserProfileCard } from "./components/UserProfileCard";

export function OverviewModal() {
    const [settingsMode, setProfileModalOpen] = useSearchParam('pregled');

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setProfileModalOpen(undefined);
        }
    }

    const currentUser = useCurrentUser();

    const { data: currentAccount } = useCurrentAccount();

    return (
        <Modal
            open={Boolean(settingsMode)}
            onOpenChange={handleOpenChange}
            className="md:min-w-full lg:min-w-[80%] xl:min-w-[60%] md:min-h-[70%] md:max-h-full md:border-tertiary md:border-b-4"
            title="Profil">
            <div className="grid grid-rows-[auto_1fr] gap-4 md:gap-0 md:grid-rows-1 md:grid-cols-[minmax(230px,auto)_1fr]">
                <Stack spacing={2} className="md:border-r md:pl-2">
                    <ProfileInfo />
                    <SelectItems
                        className="md:hidden"
                        value={settingsMode}
                        onValueChange={setProfileModalOpen}
                        items={[
                            { label: 'Generalno', value: 'generalno' },
                            { label: 'Suncokreti', value: 'suncokreti' },
                            { label: 'Obavijesti', value: 'obavijesti' },
                            { label: 'Sigurnost', value: 'sigurnost' },
                            { label: 'Zvuk', value: 'zvuk' },
                        ]}
                    />
                    <List className="md:pr-6 hidden md:flex">
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
                <div className="md:pl-6">
                    {settingsMode === 'generalno' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">Profil</Typography>
                            <UserProfileCard />
                        </Stack>
                    )}
                    {settingsMode === 'sigurnost' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">Sigurnost</Typography>
                            <Stack spacing={2}>
                                <Card>
                                    <CardContent noHeader>
                                        <Typography level="body2">Prijavljeni ste putem email adrese: <strong>{currentUser.data?.userName}</strong>.</Typography>
                                    </CardContent>
                                </Card>
                                {/* <Card>
                                    <CardHeader>
                                        <CardTitle>Lozinka</CardTitle>
                                    </CardHeader>
                                    <form>
                                        <CardContent>
                                            <Stack spacing={4}>
                                                <Stack spacing={2}>
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
                                                </Stack>
                                                <CardActions className="justify-end">
                                                    <Button size="sm" variant="solid" type="submit">Spremi</Button>
                                                </CardActions>
                                            </Stack>
                                        </CardContent>
                                    </form>
                                </Card> */}
                            </Stack>
                        </Stack>
                    )}
                    {settingsMode === 'zvuk' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">Zvuk</Typography>
                            <SoundSettingsCard />
                        </Stack>
                    )}
                    {settingsMode === 'obavijesti' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">Obavijesti</Typography>
                            <Card>
                                <CardContent noHeader>
                                    <NoNotificationsPlaceholder />
                                </CardContent>
                            </Card>
                        </Stack>
                    )}
                    {settingsMode === 'suncokreti' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">Suncokreti</Typography>
                            <Stack spacing={2}>
                                <div className="relative mt-12 md:mt-0">
                                    <span className="absolute text-5xl -top-12 right-6">
                                        <img
                                            src="https://cdn.gredice.com/sunflower-large.svg"
                                            alt="Suncokret"
                                            className="size-12"
                                        />
                                    </span>
                                    <Card className="relative z-10">
                                        <CardContent noHeader>
                                            <Typography level="body2">Trenutno imaš <strong>{currentAccount?.sunflowers.amount}</strong> suncokreta za korištenje u svom vrtu.</Typography>
                                        </CardContent>
                                    </Card>
                                </div>
                                <ScrollArea className="basis-56 md:basis-96 rounded-lg text-card-foreground bg-card border shadow-sm p-4">
                                    <SunflowersList />
                                </ScrollArea>
                            </Stack>
                        </Stack>
                    )}
                </div>
            </div>
        </Modal>
    )
}