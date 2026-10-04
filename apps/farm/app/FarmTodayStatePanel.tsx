import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Success, Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { FarmTodayRefreshButton } from './FarmTodayRefreshButton';
import type { FarmTodayWorkState } from './farmTodayModel';

type FarmTodayAvailableStatePanelProps = {
    completed: number;
    dateKey: string;
    pendingVerification: number;
    workState: FarmTodayWorkState;
};

export function FarmTodayUnavailableState() {
    return (
        <Alert
            className="items-start"
            color="danger"
            startDecorator={<Warning aria-hidden className="size-5" />}
        >
            <Stack spacing={3}>
                <div>
                    <Typography component="h2" level="h6" semiBold>
                        Današnji zadaci se trenutno ne mogu učitati
                    </Typography>
                    <Typography level="body2">
                        Osvježi prikaz ili otvori cijeli raspored dok ponovno
                        uspostavljamo vezu.
                    </Typography>
                </div>
                <div className="flex flex-wrap gap-2">
                    <FarmTodayRefreshButton />
                    <Button
                        data-farm-analytics="navigation"
                        data-farm-navigation-destination="schedule"
                        data-farm-navigation-source="today_tools"
                        href="/schedule"
                        size="lg"
                        variant="outlined"
                    >
                        Otvori raspored
                    </Button>
                </div>
            </Stack>
        </Alert>
    );
}

export function FarmTodayNoFarmState() {
    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={3}>
                    <div>
                        <Typography component="h2" level="h6" semiBold>
                            Nemaš dodijeljenu farmu
                        </Typography>
                        <Typography level="body2">
                            Kontaktiraj administratora kako bi te dodijelio
                            farmi. Odabir farme nije potreban za svakodnevni
                            rad.
                        </Typography>
                    </div>
                    <Button
                        className="w-fit"
                        data-farm-analytics="navigation"
                        data-farm-navigation-destination="settings"
                        data-farm-navigation-source="today_tools"
                        href="/settings"
                        size="lg"
                        variant="outlined"
                    >
                        Provjeri profil
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}

export function FarmTodayAvailableStatePanel({
    completed,
    dateKey,
    pendingVerification,
    workState,
}: FarmTodayAvailableStatePanelProps) {
    const scheduleHref = `/schedule?date=${dateKey}`;

    if (workState === 'hasWork') {
        return (
            <Card>
                <CardContent noHeader>
                    <Stack spacing={3}>
                        <div>
                            <Typography component="h2" level="h6" semiBold>
                                Trenutačno nema zadatka za dovršiti
                            </Typography>
                            <Typography level="body2">
                                {pendingVerification > 0
                                    ? `${pendingVerification} zadataka čeka potvrdu.`
                                    : 'Provjeri cijeli raspored za dodatne detalje.'}
                            </Typography>
                        </div>
                        <Button
                            className="w-fit"
                            data-farm-analytics="navigation"
                            data-farm-navigation-destination="schedule"
                            data-farm-navigation-source="today_tools"
                            href={scheduleHref}
                            size="lg"
                            variant="outlined"
                        >
                            Provjeri raspored
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    if (workState === 'incomplete') {
        return (
            <Alert
                className="items-start"
                color="warning"
                startDecorator={<Warning aria-hidden className="size-5" />}
            >
                <Stack spacing={3}>
                    <div>
                        <Typography component="h2" level="h6" semiBold>
                            Nisu dostupni svi današnji zadaci
                        </Typography>
                        <Typography level="body2">
                            Ne prikazujemo da je posao gotov dok se svi podaci
                            ne učitaju.
                        </Typography>
                    </div>
                    <FarmTodayRefreshButton />
                </Stack>
            </Alert>
        );
    }

    const content = {
        allDone: {
            description:
                completed > 0
                    ? `Potvrđeno je ${completed} današnjih zadataka.`
                    : 'Za danas nema preostalih zadataka.',
            icon: <Success aria-hidden className="size-5 text-green-600" />,
            title: 'Današnji posao je gotov',
        },
        empty: {
            description:
                'Pogledaj raspored ako želiš provjeriti drugi datum ili planirati sljedeći posao.',
            icon: null,
            title: 'Danas nema planiranih zadataka',
        },
        noAssignedWork: {
            description:
                'Na farmi postoji planirani posao, ali zadaci su trenutačno dodijeljeni drugim članovima.',
            icon: null,
            title: 'Nema zadataka dodijeljenih tebi',
        },
    }[workState];

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={3}>
                    <div className="flex items-start gap-2">
                        {content.icon}
                        <div className="min-w-0">
                            <Typography component="h2" level="h6" semiBold>
                                {content.title}
                            </Typography>
                            <Typography level="body2">
                                {content.description}
                            </Typography>
                        </div>
                    </div>
                    <Button
                        className="w-fit"
                        data-farm-analytics="navigation"
                        data-farm-navigation-destination="schedule"
                        data-farm-navigation-source="today_tools"
                        href={scheduleHref}
                        size="lg"
                        variant="outlined"
                    >
                        {workState === 'noAssignedWork'
                            ? 'Otvori cijeli raspored'
                            : 'Otvori raspored'}
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}
