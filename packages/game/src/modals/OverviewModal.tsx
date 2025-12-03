import { getAuthToken } from '@gredice/client';
import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { Approved, CompanyFacebook, Empty, Security } from '@signalco/ui-icons';
import { Button, type ButtonProps } from '@signalco/ui-primitives/Button';
import { Card, CardActions, CardContent } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { type FormEvent, useEffect, useState } from 'react';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useMarkAllNotificationsRead } from '../hooks/useMarkAllNotificationsRead';
import { useRenameGarden } from '../hooks/useRenameGarden';
import { useUserLogins } from '../hooks/useUserLogins';
import { NotificationList } from '../hud/NotificationList';
import { AchievementsOverview } from '../shared-ui/achievements/AchievementsOverview';
import { DeliveryAddressesSection } from '../shared-ui/delivery/DeliveryAddressesSection';
import { DeliveryRequestsSection } from '../shared-ui/delivery/DeliveryRequestsSection';
import { ProfileInfo } from '../shared-ui/ProfileInfo';
import { DailyRewardOverview } from '../shared-ui/sunflowers/DailyRewardOverview';
import { SunflowersList } from '../shared-ui/sunflowers/SunflowersList';
import { SoundSettingsCard } from './components/SoundSettingsCard';
import { TimeZoneSettingsCard } from './components/TimeZoneSettingsCard';
import { UserBirthdayCard } from './components/UserBirthdayCard';
import { UserProfileCard } from './components/UserProfileCard';

export function FacebookLoginButton({ ...props }: ButtonProps) {
    return (
        <Button
            type="button"
            variant="outlined"
            className="bg-white dark:bg-blue-900"
            fullWidth
            {...props}
        >
            <CompanyFacebook className="mr-2" />
            Poveži Facebook račun
        </Button>
    );
}

function CompanyGoogle({ ...props }: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" {...props}>
            <title>Google</title>
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
        </svg>
    );
}

export function GoogleLoginButton({ ...props }: ButtonProps) {
    return (
        <Button
            type="button"
            variant="outlined"
            className="bg-white dark:bg-black"
            fullWidth
            {...props}
        >
            <CompanyGoogle className="mr-2 h-4 w-4" />
            Poveži Google račun
        </Button>
    );
}

export function OverviewModal() {
    const [settingsMode, setProfileModalOpen] = useSearchParam('pregled');
    const currentUser = useCurrentUser();
    const { data: currentAccount } = useCurrentAccount();
    const { data: currentGarden } = useCurrentGarden();
    const [notificationsFilter, setNotificationsFilter] = useState('unread');
    const markAllNotificationsRead = useMarkAllNotificationsRead();
    const renameGarden = useRenameGarden(currentGarden?.id);
    const [gardenName, setGardenName] = useState('');

    useEffect(() => {
        setGardenName(currentGarden?.name ?? '');
    }, [currentGarden?.name]);

    const currentGardenName = currentGarden?.name ?? '';
    const trimmedGardenName = gardenName.trim();
    const isRenameDisabled =
        !currentGarden?.id ||
        !trimmedGardenName ||
        trimmedGardenName === currentGardenName.trim() ||
        renameGarden.isPending;

    const handleRenameGarden = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentGarden?.id) {
            return;
        }

        const nextName = gardenName.trim();
        if (!nextName) {
            return;
        }

        try {
            await renameGarden.mutateAsync({ name: nextName });
        } catch (error) {
            console.error('Failed to rename garden', error);
        }
    };

    // Security
    const { data: userLogins, isLoading: userLoginsLoading } = useUserLogins(
        currentUser.data?.id,
    );
    const token = getAuthToken();
    const passwordLoginConnected = userLogins?.methods?.some(
        (login) => login.provider === 'password',
    );
    const googleConnected = userLogins?.methods?.some(
        (login) => login.provider === 'google',
    );
    const facebookConnected = userLogins?.methods?.some(
        (login) => login.provider === 'facebook',
    );

    const handleMarkAllNotificationsRead = () => {
        markAllNotificationsRead.mutate({ readWhere: 'game' });
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setProfileModalOpen(undefined);
        }
    };

    return (
        <Modal
            open={Boolean(settingsMode)}
            onOpenChange={handleOpenChange}
            className="md:min-w-full lg:min-w-[80%] xl:min-w-[60%] md:min-h-[70%] md:max-h-full md:border-tertiary md:border-b-4"
            title="Profil"
        >
            <div className="grid grid-rows-[auto_1fr] gap-4 md:gap-0 md:grid-rows-1 md:grid-cols-[minmax(230px,auto)_1fr]">
                <Stack spacing={2} className="md:border-r md:pl-2">
                    <ProfileInfo />
                    <SelectItems
                        className="md:hidden bg-card rounded-lg"
                        value={settingsMode}
                        onValueChange={setProfileModalOpen}
                        items={[
                            { label: '⚙️ Generalno', value: 'generalno' },
                            { label: '🏡 Vrt', value: 'vrt' },
                            { label: '🏆 Postignuća', value: 'postignuca' },
                            { label: '🌻 Suncokreti', value: 'suncokreti' },
                            { label: '🚚 Dostava', value: 'dostava' },
                            { label: '🔔 Obavijesti', value: 'obavijesti' },
                            { label: '🔒 Sigurnost', value: 'sigurnost' },
                            { label: '🔊 Zvuk', value: 'zvuk' },
                        ]}
                    />
                    <List className="md:pr-6 hidden md:flex">
                        <Typography
                            level="body3"
                            uppercase
                            bold
                            className="py-4"
                        >
                            Profil
                        </Typography>
                        <ListItem
                            nodeId="profile-general"
                            label="Generalno"
                            startDecorator={<>⚙️</>}
                            selected={settingsMode === 'generalno'}
                            onSelected={() => setProfileModalOpen('generalno')}
                        />
                        <ListItem
                            nodeId="profile-garden"
                            label="Vrt"
                            startDecorator={<>🏡</>}
                            selected={settingsMode === 'vrt'}
                            onSelected={() => setProfileModalOpen('vrt')}
                        />
                        <ListItem
                            nodeId="profile-achievements"
                            label="Postignuća"
                            startDecorator={<>🏆</>}
                            selected={settingsMode === 'postignuca'}
                            onSelected={() => setProfileModalOpen('postignuca')}
                        />
                        <ListItem
                            nodeId="profile-sunflowers"
                            label="Suncokreti"
                            startDecorator={<>🌻</>}
                            selected={settingsMode === 'suncokreti'}
                            onSelected={() => setProfileModalOpen('suncokreti')}
                        />
                        <ListItem
                            nodeId="profile-delivery"
                            label="Dostava"
                            startDecorator={<>🚚</>}
                            selected={settingsMode === 'dostava'}
                            onSelected={() => setProfileModalOpen('dostava')}
                        />
                        <ListItem
                            nodeId="profile-notifications"
                            label="Obavijesti"
                            startDecorator={<>🔔</>}
                            selected={settingsMode === 'obavijesti'}
                            onSelected={() => setProfileModalOpen('obavijesti')}
                        />
                        <Typography
                            level="body3"
                            uppercase
                            bold
                            className="py-4"
                        >
                            Postavke
                        </Typography>
                        <ListItem
                            nodeId="profile-security"
                            label="Sigurnost"
                            startDecorator={<>🔒</>}
                            selected={settingsMode === 'sigurnost'}
                            onSelected={() => setProfileModalOpen('sigurnost')}
                        />
                        <ListItem
                            nodeId="profile-sound"
                            label="Zvuk"
                            startDecorator={<>🔊</>}
                            selected={settingsMode === 'zvuk'}
                            onSelected={() => setProfileModalOpen('zvuk')}
                        />
                    </List>
                </Stack>
                <div className="md:pl-6">
                    {settingsMode === 'generalno' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">
                                ⚙️ Profil
                            </Typography>
                            <Stack spacing={1}>
                                <UserProfileCard />
                                <UserBirthdayCard />
                                <TimeZoneSettingsCard />
                            </Stack>
                        </Stack>
                    )}
                    {settingsMode === 'vrt' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">
                                🏡 Vrt
                            </Typography>
                            {!currentGarden ? (
                                <Card>
                                    <CardContent noHeader>
                                        <Typography level="body2">
                                            Trenutno nemaš svoj vrt za
                                            uređivanje.
                                        </Typography>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                    <form onSubmit={handleRenameGarden}>
                                        <CardContent noHeader>
                                            <Stack spacing={3}>
                                                <Stack spacing={1}>
                                                    <Typography level="body2">
                                                        Promijeni ime svog vrta.
                                                    </Typography>
                                                    <Input
                                                        name="gardenName"
                                                        label="Naziv vrta"
                                                        value={gardenName}
                                                        onChange={(event) =>
                                                            setGardenName(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        placeholder="Unesite naziv vrta..."
                                                        required
                                                        disabled={
                                                            renameGarden.isPending
                                                        }
                                                    />
                                                    <Typography level="body3">
                                                        Ovo ime će biti
                                                        prikazano u Gredici i
                                                        podijeljeno s drugim
                                                        igračima kada posjete
                                                        tvoj vrt.
                                                    </Typography>
                                                </Stack>
                                                <CardActions className="justify-end">
                                                    <Button
                                                        size="sm"
                                                        variant="solid"
                                                        type="submit"
                                                        loading={
                                                            renameGarden.isPending
                                                        }
                                                        disabled={
                                                            isRenameDisabled
                                                        }
                                                    >
                                                        Spremi
                                                    </Button>
                                                </CardActions>
                                            </Stack>
                                        </CardContent>
                                    </form>
                                </Card>
                            )}
                        </Stack>
                    )}
                    {settingsMode === 'sigurnost' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">
                                🔒 Sigurnost
                            </Typography>
                            <Stack spacing={2}>
                                <Card>
                                    <CardContent noHeader>
                                        <Typography level="body2">
                                            Prijava putem email adrese:{' '}
                                            <strong>
                                                {currentUser.data?.userName}
                                            </strong>
                                        </Typography>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent noHeader>
                                        <Stack spacing={2}>
                                            <Stack spacing={2}>
                                                <Typography level="body2">
                                                    Prijava putem emaila i
                                                    zaporke.
                                                </Typography>
                                                {passwordLoginConnected && (
                                                    <Row spacing={2}>
                                                        <Security className="size-8" />
                                                        <Typography level="body1">
                                                            Tvoj račun ima
                                                            postavljenu zaporku.
                                                        </Typography>
                                                    </Row>
                                                )}
                                                {!passwordLoginConnected && (
                                                    <Typography level="body3">
                                                        Trenutno nemaš
                                                        postavljenu zaporku.
                                                    </Typography>
                                                )}
                                            </Stack>
                                            <Stack spacing={1}>
                                                <Button
                                                    variant="outlined"
                                                    href={`https://vrt.gredice.com/prijava/promjena-zaporke?token=${token}`}
                                                    fullWidth
                                                >
                                                    {passwordLoginConnected
                                                        ? 'Promijeni zaporku'
                                                        : 'Postavi zaporku'}
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent noHeader>
                                        {userLoginsLoading && (
                                            <Spinner
                                                loading
                                                className="size-5"
                                                loadingLabel="Učitavanje prijava..."
                                            />
                                        )}
                                        {!userLoginsLoading && (
                                            <Stack spacing={3}>
                                                <Stack spacing={3}>
                                                    <Typography level="body2">
                                                        Poveži svoj račun
                                                        društvene mrežame za
                                                        bržu i sigurniju
                                                        prijavu.
                                                    </Typography>
                                                    {facebookConnected && (
                                                        <Row spacing={2}>
                                                            <CompanyFacebook className="size-8" />
                                                            <Typography level="body1">
                                                                Tvoj Facebook
                                                                račun je
                                                                povezan.
                                                            </Typography>
                                                        </Row>
                                                    )}
                                                    {googleConnected && (
                                                        <Row spacing={2}>
                                                            <CompanyGoogle className="size-8" />
                                                            <Typography level="body1">
                                                                Tvoj Google
                                                                račun je
                                                                povezan.
                                                            </Typography>
                                                        </Row>
                                                    )}
                                                    {!facebookConnected &&
                                                        !googleConnected && (
                                                            <Typography level="body3">
                                                                Trenutno nemaš
                                                                povezanih
                                                                računa.
                                                            </Typography>
                                                        )}
                                                </Stack>
                                                <Stack spacing={1}>
                                                    {!facebookConnected && (
                                                        <FacebookLoginButton
                                                            href={`https://api.gredice.com/api/auth/facebook?state=${token}&timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`}
                                                        />
                                                    )}
                                                    {!googleConnected && (
                                                        <GoogleLoginButton
                                                            href={`https://api.gredice.com/api/auth/google?state=${token}&timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`}
                                                        />
                                                    )}
                                                </Stack>
                                            </Stack>
                                        )}
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
                    {settingsMode === 'dostava' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">
                                🚚 Dostava
                            </Typography>
                            <Stack
                                spacing={2}
                                className="overflow-y-auto max-h-[calc(100dvh-200px)]"
                            >
                                <Stack spacing={2}>
                                    <DeliveryAddressesSection />
                                </Stack>
                                <Stack spacing={2}>
                                    <DeliveryRequestsSection />
                                </Stack>
                            </Stack>
                        </Stack>
                    )}
                    {settingsMode === 'zvuk' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">
                                🔊 Zvuk
                            </Typography>
                            <SoundSettingsCard />
                        </Stack>
                    )}
                    {settingsMode === 'obavijesti' && (
                        <Stack spacing={1}>
                            <Row justifyContent="space-between">
                                <Typography
                                    level="h4"
                                    className="hidden md:block"
                                >
                                    🔔 Obavijesti
                                </Typography>
                            </Row>
                            <Stack spacing={1}>
                                <Card className="bg-card p-1">
                                    <Row justifyContent="space-between">
                                        <SelectItems
                                            value={notificationsFilter}
                                            onValueChange={
                                                setNotificationsFilter
                                            }
                                            items={[
                                                {
                                                    label: 'Nepročitane',
                                                    value: 'unread',
                                                    icon: (
                                                        <Empty className="size-4" />
                                                    ),
                                                },
                                                {
                                                    label: 'Sve obavijesti',
                                                    value: 'all',
                                                    icon: (
                                                        <Approved className="size-4" />
                                                    ),
                                                },
                                            ]}
                                        />
                                        <Button
                                            variant="plain"
                                            size="sm"
                                            onClick={
                                                handleMarkAllNotificationsRead
                                            }
                                            startDecorator={
                                                <Approved className="size-4" />
                                            }
                                        >
                                            Sve pročitano
                                        </Button>
                                    </Row>
                                </Card>
                                <div className="overflow-y-auto max-h-[calc(100dvh-18rem)] md:max-h-[calc(100dvh-24rem)] rounded-lg text-card-foreground bg-card shadow-sm p-0">
                                    <NotificationList
                                        read={notificationsFilter === 'all'}
                                    />
                                </div>
                            </Stack>
                        </Stack>
                    )}
                    {settingsMode === 'suncokreti' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">
                                🌻 Suncokreti
                            </Typography>
                            <Stack
                                spacing={1}
                                className="max-h-[calc(100dvh-12rem)]"
                            >
                                <div className="relative md:mt-0">
                                    <span className="absolute text-5xl -top-12 right-6 hidden md:block">
                                        <Image
                                            src="https://cdn.gredice.com/sunflower-large.svg"
                                            alt="Suncokret"
                                            className="size-12"
                                            width={48}
                                            height={48}
                                        />
                                    </span>
                                    <Card className="relative z-10">
                                        <CardContent noHeader>
                                            <Typography level="body2">
                                                Trenutno imaš{' '}
                                                <strong>
                                                    {
                                                        currentAccount
                                                            ?.sunflowers.amount
                                                    }
                                                </strong>{' '}
                                                suncokreta za korištenje u svom
                                                vrtu.
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </div>
                                <Card>
                                    <CardContent noHeader>
                                        <DailyRewardOverview />
                                    </CardContent>
                                </Card>
                                <div className="overflow-y-auto max-h-[calc(100dvh-20rem)] md:max-h-[calc(100dvh-24rem)] rounded-lg text-card-foreground bg-card border shadow-sm p-4">
                                    <SunflowersList />
                                </div>
                            </Stack>
                        </Stack>
                    )}
                    {settingsMode === 'postignuca' && (
                        <Stack spacing={4}>
                            <Typography level="h4" className="hidden md:block">
                                🏆 Postignuća
                            </Typography>
                            <AchievementsOverview />
                        </Stack>
                    )}
                </div>
            </div>
        </Modal>
    );
}
