import { BlockImage } from '@gredice/ui/BlockImage';
import { Alert } from '@signalco/ui/Alert';
import { EditableInput } from '@signalco/ui/EditableInput';
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import {
    Book,
    Hammer,
    Info,
    MoreHorizontal,
    Warning,
} from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { cx } from '@signalco/ui-primitives/cx';
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
import {
    RAISED_BED_ABANDON_FAILED_MESSAGE,
    RAISED_BED_STATUS_ABANDONED,
} from '../../raisedBedConstants';
import { useGameState } from '../../useGameState';
import { RaisedBedDiary } from './RaisedBedDiary';
import { RaisedBedInfoTab } from './RaisedBedInfoTab';
import { RaisedBedOperationsTab } from './RaisedBedOperationsTab';

type RaisedBedTab = 'diary' | 'operations' | 'info' | 'more';

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
    const [activeTab, setActiveTab] = useState<RaisedBedTab>('diary');
    const [abandonError, setAbandonError] = useState<string | null>(null);
    const isAbandoned = raisedBed.status === RAISED_BED_STATUS_ABANDONED;

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
                    setAbandonError(RAISED_BED_ABANDON_FAILED_MESSAGE);
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
            <Tabs
                value={activeTab}
                onValueChange={(value: string) =>
                    setActiveTab(value as RaisedBedTab)
                }
                className="flex flex-col"
            >
                <div className="relative flex justify-center">
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
                    <Button
                        type="button"
                        variant="plain"
                        aria-label="Prikaži dodatne opcije gredice"
                        className={cx(
                            'absolute right-0 top-0 h-full min-w-10 rounded-full px-3',
                            activeTab === 'more'
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                : undefined,
                        )}
                        onClick={() => setActiveTab('more')}
                    >
                        <MoreHorizontal className="size-4" />
                    </Button>
                </div>
                <TabsContent value="info">
                    <RaisedBedInfoTab
                        gardenId={gardenId}
                        raisedBedId={raisedBed.id}
                    />
                </TabsContent>
                <TabsContent value="more">
                    <Stack spacing={2}>
                        {isAbandoned ? (
                            <Alert
                                color="danger"
                                startDecorator={
                                    <Warning className="size-4 shrink-0" />
                                }
                            >
                                <Typography level="body2">
                                    Gredica je označena kao napuštena.
                                </Typography>
                            </Alert>
                        ) : (
                            <Stack
                                spacing={1.5}
                                className="rounded-xl border border-red-200 bg-red-50/90 p-4 shadow-sm dark:border-red-900/60 dark:bg-red-950/90"
                            >
                                <Row spacing={2} alignItems="center">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 ring-4 ring-red-200/70 dark:bg-red-900/70 dark:text-red-100 dark:ring-red-800/70">
                                        <Warning className="size-5 shrink-0" />
                                    </div>
                                    <Stack spacing={0.5}>
                                        <Typography level="body1" semiBold>
                                            Napusti gredicu
                                        </Typography>
                                        <Typography level="body2" secondary>
                                            Ova radnja pokreće napuštanje
                                            gredice.
                                        </Typography>
                                    </Stack>
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
