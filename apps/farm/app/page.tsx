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
    Fence,
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
    const showDebugTools = process.env.NODE_ENV === 'development';

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
                        <Row justifyContent="space-between">
                            <Stack>
                                <Typography level="h4" component="h1" semiBold>
                                    {`Dobrodošli, ${displayName}!`}
                                </Typography>
                                <Typography
                                    level="body2"
                                    className="text-muted-foreground"
                                >
                                    Upravljaj farmom, planiraj nadolazeće
                                    aktivnosti i prati napredak u realnom
                                    vremenu.
                                </Typography>
                            </Stack>
                            <LogoutButton />
                        </Row>
                        <Row spacing={2}>
                            <Chip
                                color={role?.color ?? 'neutral'}
                                startDecorator={<RoleIcon className="size-4" />}
                            >
                                {role?.label ?? dbUser.role}
                            </Chip>
                            <Chip color="neutral">Član od {joinDate}</Chip>
                            <Chip color="neutral">
                                Povezanih računa: {dbUser.accounts.length}
                            </Chip>
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
                        <Stack spacing={4} className="p-4">
                            <Button
                                variant="solid"
                                size="lg"
                                className="justify-start"
                                startDecorator={<Calendar className="size-4" />}
                                href="/schedule"
                            >
                                Pregled dnevnih zadataka
                            </Button>
                            <Button
                                variant="outlined"
                                size="lg"
                                className="justify-start"
                                startDecorator={<Fence className="size-4" />}
                                href="/raised-beds"
                            >
                                Pregled svih gredica
                            </Button>
                            <Button
                                variant="soft"
                                size="lg"
                                className="justify-start"
                                startDecorator={<BookA className="size-4" />}
                                href="/operations"
                            >
                                Priručnik radnji
                            </Button>
                            <Button
                                variant="soft"
                                size="lg"
                                className="justify-start"
                                startDecorator={<Sprout className="size-4" />}
                                href="/plants"
                            >
                                Priručnik biljaka
                            </Button>
                            {showDebugTools && (
                                <Button
                                    variant="outlined"
                                    size="lg"
                                    className="justify-start"
                                    href="/debug/labels"
                                >
                                    Debug etiketa
                                </Button>
                            )}
                        </Stack>
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
        <div className="min-h-[100dvh] w-full bg-muted">
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
