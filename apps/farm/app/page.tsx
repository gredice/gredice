import { getFarms, getUser } from '@gredice/storage';
import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import {
    BookA,
    Calendar,
    Euro,
    Fence,
    MapPinHouse,
    Settings,
    Shield,
    Sprout,
    User,
} from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { Suspense } from 'react';
import LoginDialog from '../components/auth/LoginDialog';
import { LogoutButton } from '../components/auth/LogoutButton';
import { auth } from '../lib/auth/auth';
import { FarmDashboardGreeting } from './FarmDashboardGreeting';

function formatDate(date?: Date | string | null) {
    if (!date) {
        return '—';
    }

    const parsed = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(parsed.getTime())) {
        return '—';
    }

    return parsed.toLocaleDateString('hr-HR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

const roleConfig: Record<
    string,
    {
        label: string;
        icon: typeof Fence;
        color: 'neutral' | 'success' | 'warning';
    }
> = {
    user: { label: 'Korisnik', icon: User, color: 'neutral' },
    farmer: { label: 'Poljoprivrednik', icon: Fence, color: 'success' },
    admin: { label: 'Administrator', icon: Shield, color: 'warning' },
};

function formatCoordinate(value?: number | null) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '—';
    }

    return `${value.toFixed(4)}°`;
}

async function FarmerDashboard() {
    const { userId } = await auth(['farmer', 'admin']);
    const [dbUser, farms] = await Promise.all([getUser(userId), getFarms()]);

    if (!dbUser) {
        return (
            <div className="max-w-5xl mx-auto w-full px-4 py-10">
                <Typography level="h3" semiBold>
                    Korisnik nije pronađen.
                </Typography>
            </div>
        );
    }

    const displayName = dbUser.displayName ?? dbUser.userName;
    const joinDate = formatDate(dbUser.createdAt);
    const role = roleConfig[dbUser.role];
    const RoleIcon = role?.icon ?? User;

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <Card>
                <CardContent noHeader>
                    <Stack spacing={4}>
                        <Row
                            justifyContent="space-between"
                            className="flex-wrap items-start gap-3"
                        >
                            <Stack className="min-w-0">
                                <FarmDashboardGreeting
                                    displayName={displayName}
                                    initialDateIso={new Date().toISOString()}
                                />
                                <Typography
                                    level="body2"
                                    className="text-muted-foreground"
                                >
                                    Upravljaj farmom, planiraj nadolazeće
                                    aktivnosti i prati napredak u realnom
                                    vremenu.
                                </Typography>
                            </Stack>
                            <Row spacing={1} className="shrink-0">
                                <Button
                                    aria-label="Postavke"
                                    className="aspect-square px-0"
                                    href="/settings"
                                    title="Postavke"
                                    variant="plain"
                                >
                                    <Settings className="size-4 shrink-0" />
                                </Button>
                                <LogoutButton />
                            </Row>
                        </Row>
                        <Row spacing={2} className="flex-wrap gap-y-2">
                            <Chip
                                color={role?.color ?? 'neutral'}
                                startDecorator={<RoleIcon className="size-4" />}
                            >
                                {role?.label ?? dbUser.role}
                            </Chip>
                            <Chip color="neutral">Član od {joinDate}</Chip>
                        </Row>
                    </Stack>
                </CardContent>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2">
                <Card className="h-full">
                    <CardHeader>
                        <Stack spacing={2}>
                            <CardTitle>Brze radnje</CardTitle>
                            <Typography className="text-sm text-muted-foreground">
                                Alati za svakodnevno upravljanje farmom stižu
                                uskoro.
                            </Typography>
                        </Stack>
                    </CardHeader>
                    <CardOverflow>
                        <div className="grid grid-cols-2 gap-3 p-4">
                            <Button
                                variant="solid"
                                size="lg"
                                fullWidth
                                className="h-24 flex-col text-center text-base"
                                startDecorator={<Calendar className="size-6" />}
                                href="/schedule"
                            >
                                Dnevni zadaci
                            </Button>
                            <Button
                                variant="soft"
                                size="lg"
                                fullWidth
                                className="h-24 flex-col text-center text-base"
                                startDecorator={<Fence className="size-6" />}
                                href="/raised-beds"
                            >
                                Gredice
                            </Button>
                            <Button
                                variant="soft"
                                size="lg"
                                fullWidth
                                className="h-24 flex-col text-center text-base"
                                startDecorator={
                                    <MapPinHouse className="size-6" />
                                }
                                href="/greenhouse"
                            >
                                Staklenik
                            </Button>
                            <Button
                                variant="soft"
                                size="lg"
                                fullWidth
                                className="h-24 flex-col text-center text-base"
                                startDecorator={<BookA className="size-6" />}
                                href="/operations"
                            >
                                Radnje
                            </Button>
                            <Button
                                variant="soft"
                                size="lg"
                                fullWidth
                                className="h-24 flex-col text-center text-base"
                                startDecorator={<Sprout className="size-6" />}
                                href="/plants"
                            >
                                Biljke
                            </Button>
                            <Button
                                variant="soft"
                                size="lg"
                                fullWidth
                                className="h-24 flex-col text-center text-base"
                                startDecorator={<Euro className="size-6" />}
                                href="/payouts"
                            >
                                Isplate
                            </Button>
                        </div>
                    </CardOverflow>
                </Card>
                <Card className="h-full">
                    <CardHeader>
                        <Stack spacing={2}>
                            <CardTitle>Moje farme</CardTitle>
                            <Typography className="text-sm text-muted-foreground">
                                Pregled aktivnih farmi u Gredice sustavu.
                            </Typography>
                        </Stack>
                    </CardHeader>
                    <CardOverflow>
                        {farms.length ? (
                            <Table>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.Head>Naziv</Table.Head>
                                        <Table.Head>Lokacija</Table.Head>
                                        <Table.Head>Aktivna od</Table.Head>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {farms.map((farm) => (
                                        <Table.Row key={farm.id}>
                                            <Table.Cell>{farm.name}</Table.Cell>
                                            <Table.Cell>
                                                {formatCoordinate(
                                                    farm.latitude,
                                                )}
                                                ,{' '}
                                                {formatCoordinate(
                                                    farm.longitude,
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {formatDate(farm.createdAt)}
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table>
                        ) : (
                            <div className="p-6 text-sm text-muted-foreground">
                                Još nema dodanih farmi. Kontaktiraj
                                administratora kako bi dodali tvoju prvu
                                lokaciju.
                            </div>
                        )}
                    </CardOverflow>
                </Card>
            </div>
        </div>
    );
}

export default function Home() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={authFarmer}>
                <Suspense>
                    <FarmerDashboard />
                </Suspense>
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
