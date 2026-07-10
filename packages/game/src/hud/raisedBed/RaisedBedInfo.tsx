import { EditableInput } from '@gredice/ui/EditableInput';
import { Book, Hammer, Info } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { ScrollArea } from '@gredice/ui/ScrollArea';
import { Stack } from '@gredice/ui/Stack';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import type { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useUpdateRaisedBed } from '../../hooks/useUpdateRaisedBed';
import { RaisedBedInfoTab } from './RaisedBedInfoTab';
import { RaisedBedOperationHistoryList } from './RaisedBedOperationHistoryList';
import { RaisedBedOperationsTab } from './RaisedBedOperationsTab';
import { RaisedBedPhotosModal } from './RaisedBedPhotosModal';

type RaisedBedTab = 'diary' | 'operations' | 'info';

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
    const [activeTab, setActiveTab] = useState<RaisedBedTab>('diary');

    function handleNameChange(newName: string) {
        updateRaisedBed.mutate({ name: newName });
    }

    return (
        <Stack spacing={4} className="min-w-0 max-w-full">
            <div className="min-w-0 max-w-full pr-8">
                <Row spacing={4} className="min-w-0 flex-1 items-start">
                    <RaisedBedPhotosModal
                        gardenId={gardenId}
                        raisedBedId={raisedBed.id}
                        subjectName={raisedBed.name}
                        triggerPlacement="cover"
                    />
                    <Stack className="min-w-0 flex-1">
                        <Typography level="body2">Naziv gredice</Typography>
                        <EditableInput
                            value={raisedBed.name}
                            onChange={handleNameChange}
                            className="w-full"
                        />
                    </Stack>
                </Row>
            </div>
            <Tabs
                value={activeTab}
                onValueChange={(value: string) =>
                    setActiveTab(value as RaisedBedTab)
                }
                className="flex flex-col pt-2"
            >
                <div className="flex justify-center">
                    <TabsList className="border w-fit self-center">
                        <TabsTrigger value="diary">
                            <Row spacing={2}>
                                <Book className="size-4 shrink-0" />
                                <Typography>Dnevnik</Typography>
                            </Row>
                        </TabsTrigger>
                        <TabsTrigger value="operations">
                            <Row spacing={2}>
                                <Hammer className="size-4 shrink-0" />
                                <Typography>Radnje</Typography>
                            </Row>
                        </TabsTrigger>
                        <TabsTrigger value="info">
                            <Row spacing={2}>
                                <Info className="size-4 shrink-0" />
                                <Typography>Informacije</Typography>
                            </Row>
                        </TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="info">
                    <RaisedBedInfoTab
                        gardenId={gardenId}
                        raisedBedId={raisedBed.id}
                    />
                </TabsContent>
                <TabsContent value="diary">
                    <ScrollArea
                        className="-mx-4 md:-mx-6"
                        viewportClassName="max-h-96 md:max-h-[60dvh]"
                        contentClassName="pl-4 pr-2 md:pl-6 md:pr-2"
                    >
                        <RaisedBedOperationHistoryList
                            raisedBedId={raisedBed.id}
                        />
                    </ScrollArea>
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
