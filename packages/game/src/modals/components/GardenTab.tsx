import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { IconButton } from '@gredice/ui/IconButton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { Row } from '@gredice/ui/Row';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Add } from '@signalco/ui-icons';
import { useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useGardenAccountGroups } from '../../hooks/useGardenAccountGroups';
import { useGardens } from '../../hooks/useGardens';
import { GardenAccountMenuItems } from '../../hud/GardenAccountMenuItems';
import { useCurrentGardenIdParam } from '../../useUrlState';
import { CreateGardenModal } from './CreateGardenModal';
import { GardenNameCard } from './GardenNameCard';

function NoGardensCard() {
    const [createGardenModalOpen, setCreateGardenModalOpen] = useState(false);
    const { track } = useGameAnalytics();

    return (
        <>
            <Card>
                <CardContent noHeader>
                    <Stack spacing={2} alignItems="center">
                        <Typography level="body2">
                            Trenutno nemaš svoj vrt.
                        </Typography>
                        <Button
                            variant="solid"
                            onClick={() => {
                                track('game_garden_create_opened', {
                                    source: 'empty_state',
                                });
                                setCreateGardenModalOpen(true);
                            }}
                            startDecorator={<Add className="size-4" />}
                        >
                            Kreiraj svoj prvi vrt
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
            <CreateGardenModal
                open={createGardenModalOpen}
                onOpenChange={setCreateGardenModalOpen}
            />
        </>
    );
}

function GardensSelector() {
    const { data: gardens } = useGardens();
    const { data: currentGarden } = useCurrentGarden();
    const [createGardenModalOpen, setCreateGardenModalOpen] = useState(false);
    const [selectedGardenId] = useCurrentGardenIdParam();
    const { track } = useGameAnalytics();
    const selectedGarden =
        gardens?.find((g) => g.id === selectedGardenId) ??
        currentGarden ??
        gardens?.[0];

    return (
        <>
            <Row>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            className="bg-card rounded grow justify-start overflow-hidden"
                            variant="plain"
                        >
                            <Row spacing={1} className="min-w-0">
                                <span>🏡</span>
                                <Typography noWrap>
                                    {selectedGarden?.name ?? 'Odaberi vrt'}
                                </Typography>
                            </Row>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-80 p-2" align="start">
                        <GardenAccountMenuItems />
                    </DropdownMenuContent>
                </DropdownMenu>
                <IconButton
                    title="Kreiraj novi vrt"
                    variant="plain"
                    onClick={() => {
                        track('game_garden_create_opened', {
                            source: 'garden_tab',
                        });
                        setCreateGardenModalOpen(true);
                    }}
                >
                    <Add className="size-4" />
                </IconButton>
            </Row>
            <CreateGardenModal
                open={createGardenModalOpen}
                onOpenChange={setCreateGardenModalOpen}
            />
        </>
    );
}

export function GardenTab() {
    const {
        data: gardens,
        isLoading: gardensLoading,
        isError: gardensError,
    } = useGardens();
    const { data: accountGroups, isLoading: accountGroupsLoading } =
        useGardenAccountGroups();
    const [selectedGardenId] = useCurrentGardenIdParam();
    const selectedGarden =
        gardens?.find((g) => g.id === selectedGardenId) ?? gardens?.[0];
    const hasAnyGarden =
        (gardens?.length ?? 0) > 0 ||
        (accountGroups?.some((group) => group.gardens.length > 0) ?? false);
    const isLoading = gardensLoading || accountGroupsLoading;

    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">
                🏡 Vrt
            </Typography>
            <Stack spacing={1}>
                {isLoading && !hasAnyGarden ? (
                    <Skeleton className="h-10 w-full" />
                ) : hasAnyGarden || gardensError ? (
                    <>
                        <GardensSelector />
                        {selectedGarden && (
                            <GardenNameCard
                                gardenId={selectedGarden.id}
                                gardenName={selectedGarden.name}
                                gardenCreatedAt={selectedGarden.createdAt}
                            />
                        )}
                    </>
                ) : (
                    <NoGardensCard />
                )}
            </Stack>
        </Stack>
    );
}
