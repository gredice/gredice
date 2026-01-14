import { BlockImage } from '@gredice/ui/BlockImage';
import { Alert } from '@signalco/ui/Alert';
import { EditableInput } from '@signalco/ui/EditableInput';
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Book, Hammer, Info, Warning } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { useAbandonRaisedBed } from '../../hooks/useAbandonRaisedBed';
import type { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useUpdateRaisedBed } from '../../hooks/useUpdateRaisedBed';
import { useGameState } from '../../useGameState';
import { RaisedBedDiary } from './RaisedBedDiary';
import { RaisedBedInfoTab } from './RaisedBedInfoTab';
import { RaisedBedOperationsTab } from './RaisedBedOperationsTab';

export function RaisedBedInfo({
    gardenId,
    raisedBed,
}: {
    gardenId: number;
    raisedBed: NonNullable<
        Awaited<ReturnType<typeof useCurrentGarden>>['data']
    >['raisedBeds'][0];
}) {
    const updateRaisedBed = useUpdateRaisedBed(gardenId, raisedBed.id);
    const abandonRaisedBed = useAbandonRaisedBed(gardenId, raisedBed.id);
    const setView = useGameState((state) => state.setView);
    const [abandonError, setAbandonError] = useState<string | null>(null);
    const isAbandoned = raisedBed.status === 'abandoned';

    function handleNameChange(newName: string) {
        updateRaisedBed.mutate({ name: newName });
    }

    function handleAbandonRaisedBed() {
        if (abandonRaisedBed.isPending || isAbandoned) {
            return;
        }

        setAbandonError(null);
        abandonRaisedBed.mutate(undefined, {
            onSuccess: () => {
                setView({ view: 'normal' });
            },
            onError: (error) => {
                console.error('Failed to abandon raised bed:', error);
                if (error instanceof Error) {
                    setAbandonError(error.message);
                } else {
                    setAbandonError(
                        'Došlo je do greške prilikom napuštanja gredice. Pokušaj ponovno.',
                    );
                }
            },
        });
    }

    return (
        <Stack spacing={2}>
            <Row spacing={3}>
                <BlockImage
                    blockName="Raised_Bed"
                    width={80}
                    height={80}
                    className="size-20"
                />
                <Stack>
                    <Typography level="body2">Naziv gredice</Typography>
                    <EditableInput
                        value={raisedBed.name}
                        onChange={handleNameChange}
                        className="w-full"
                    />
                </Stack>
            </Row>
            <Tabs defaultValue="diary" className="flex flex-col">
                <TabsList className="border w-fit self-center">
                    <TabsTrigger value="diary">
                        <Row spacing={1}>
                            <Book className="size-4 shrink-0" />
                            <Typography>Dnevnik</Typography>
                        </Row>
                    </TabsTrigger>
                    <TabsTrigger value="operations">
                        <Row spacing={1}>
                            <Hammer className="size-4 shrink-0" />
                            <Typography>Radnje</Typography>
                        </Row>
                    </TabsTrigger>
                    <TabsTrigger value="info">
                        <Row spacing={1}>
                            <Info className="size-4 shrink-0" />
                            <Typography>Informacije</Typography>
                        </Row>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="info">
                    <Stack spacing={2}>
                        <RaisedBedInfoTab
                            gardenId={gardenId}
                            raisedBedId={raisedBed.id}
                        />
                        {!isAbandoned && (
                            <Stack
                                spacing={1.5}
                                className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40"
                            >
                                <Row spacing={1} alignItems="center">
                                    <Warning className="size-5 shrink-0 text-red-700 dark:text-red-300" />
                                    <Typography level="body1" semiBold>
                                        Napusti gredicu
                                    </Typography>
                                </Row>
                                <Typography level="body2">
                                    Napuštanjem gredice uklanjaju se sve biljke,
                                    senzori i povezani podaci, baš kao prilikom
                                    brisanja računa. Ova radnja je nepovratna.
                                </Typography>
                                <Typography level="body2" secondary>
                                    Nakon napuštanja, gredica će biti odspojena
                                    od tvog vrta i morat ćeš je ponovno
                                    zatražiti želiš li je ponovno koristiti.
                                </Typography>
                                {abandonError && (
                                    <Alert
                                        color="danger"
                                        startDecorator={
                                            <Warning className="size-4 shrink-0" />
                                        }
                                    >
                                        <Typography level="body2">
                                            {abandonError}
                                        </Typography>
                                    </Alert>
                                )}
                                <ModalConfirm
                                    title="Potvrdi napuštanje gredice"
                                    header="Napuštanje gredice"
                                    onConfirm={handleAbandonRaisedBed}
                                    trigger={
                                        <Button
                                            type="button"
                                            variant="solid"
                                            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 dark:bg-red-700 dark:hover:bg-red-600"
                                            disabled={
                                                abandonRaisedBed.isPending
                                            }
                                            loading={abandonRaisedBed.isPending}
                                        >
                                            Napusti gredicu
                                        </Button>
                                    }
                                >
                                    <Stack spacing={2}>
                                        <Typography>
                                            Napuštanjem gredice{' '}
                                            <strong>{raisedBed.name}</strong>{' '}
                                            uklonit će se sve biljke, senzori i
                                            povezani podaci. Postupak je jednak
                                            onome koji provodimo pri brisanju
                                            računa i ne može se poništiti.
                                        </Typography>
                                        <Typography level="body2">
                                            Ako se predomisliš, gredicu će biti
                                            potrebno ponovno zatražiti i
                                            postaviti u vrtu.
                                        </Typography>
                                    </Stack>
                                </ModalConfirm>
                            </Stack>
                        )}
                    </Stack>
                </TabsContent>
                <TabsContent value="diary">
                    <Card>
                        <CardOverflow className="overflow-auto max-h-96">
                            <RaisedBedDiary
                                gardenId={gardenId}
                                raisedBedId={raisedBed.id}
                            />
                        </CardOverflow>
                    </Card>
                </TabsContent>
                <TabsContent value="operations">
                    <RaisedBedOperationsTab
                        gardenId={gardenId}
                        raisedBedId={raisedBed.id}
                    />
                </TabsContent>
            </Tabs>
        </Stack>
    );
}
