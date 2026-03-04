import { Add } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { useGardens } from '../../hooks/useGardens';
import { useCurrentGardenIdParam } from '../../useUrlState';
import { CreateGardenModal } from './CreateGardenModal';
import { GardenNameCard } from './GardenNameCard';

function NoGardensCard() {
    const [createGardenModalOpen, setCreateGardenModalOpen] = useState(false);

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
                            onClick={() => setCreateGardenModalOpen(true)}
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
    const [createGardenModalOpen, setCreateGardenModalOpen] = useState(false);
    const [selectedGardenId, setSelectedGardenId] = useCurrentGardenIdParam();
    const selectedGarden =
        gardens?.find((g) => g.id === selectedGardenId) ?? gardens?.[0];

    return (
        <>
            <Row>
                <div className="bg-card rounded grow">
                    <SelectItems
                        value={
                            selectedGardenId?.toString() ??
                            selectedGarden?.id.toString()
                        }
                        onValueChange={(value) =>
                            setSelectedGardenId(parseInt(value, 10) || 0)
                        }
                        items={
                            gardens?.map((g) => ({
                                label: (
                                    <>
                                        <Row spacing={1}>
                                            <span>🏡</span>
                                            <Typography>{g.name}</Typography>
                                        </Row>
                                    </>
                                ),
                                value: g.id.toString(),
                            })) ?? []
                        }
                    />
                </div>
                <IconButton
                    title="Kreiraj novi vrt"
                    variant="plain"
                    onClick={() => setCreateGardenModalOpen(true)}
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
    const { data: gardens } = useGardens();
    const [selectedGardenId] = useCurrentGardenIdParam();
    const selectedGarden =
        gardens?.find((g) => g.id === selectedGardenId) ?? gardens?.[0];

    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">
                🏡 Vrt
            </Typography>
            <Stack spacing={1}>
                {gardens && gardens.length > 0 ? (
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
