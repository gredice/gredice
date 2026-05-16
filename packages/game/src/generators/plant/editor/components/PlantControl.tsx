'use client';

import { Edit, Leaf, Redo, Settings, Sprout, Undo } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { PlantControlsProps } from '../@types/plant-generator';
import { ExportDialog } from './ExportDialog';
import { FlowerTab } from './FlowersTab';
import { FruitTab } from './FruitTab';
import { InfoHint } from './InfoHint';
import { LeafTab } from './LeafTab';
import { LSystemTab } from './LSystemTab';
import { SettingsTab } from './SettingsTab';
import { StemTab } from './StemTab';

export function PlantControls(props: PlantControlsProps) {
    const { state, onRedo, onStateChange, onUndo, canRedo, canUndo } = props;

    return (
        <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex shrink-0 items-start justify-between gap-3">
                <div className="flex items-center gap-1">
                    <Typography level="body2" bold>
                        Biljke
                    </Typography>
                    <InfoHint label="Savjeti urednika" title="Prečaci urednika">
                        <Typography level="body3">
                            Strelice mijenjaju generaciju, Shift daje korak 0.1,
                            a Ctrl/Cmd+Z vraća zadnju promjenu.
                        </Typography>
                    </InfoHint>
                </div>
                <div className="flex items-center gap-1">
                    <ExportDialog definition={state.definition} />
                    <IconButton
                        title="Poništi"
                        variant="plain"
                        onClick={onUndo}
                        disabled={!canUndo}
                    >
                        <Undo className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                        title="Vrati"
                        variant="plain"
                        onClick={onRedo}
                        disabled={!canRedo}
                    >
                        <Redo className="h-4 w-4" />
                    </IconButton>
                </div>
            </div>

            <Tabs
                value={state.activeTab}
                onValueChange={(value: string) =>
                    onStateChange({ activeTab: value })
                }
                className="flex min-h-0 flex-1 flex-col"
            >
                <TabsList className="grid w-full shrink-0 grid-cols-6 border">
                    <TabsTrigger
                        value="settings"
                        className="flex flex-col items-center p-2"
                    >
                        <Settings className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger
                        value="lsystem"
                        className="flex flex-col items-center p-2"
                    >
                        <Edit className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger
                        value="stem"
                        className="flex flex-col items-center p-2"
                    >
                        <Sprout className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger
                        value="leaf"
                        className="flex flex-col items-center p-2"
                    >
                        <Leaf className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger
                        value="flower"
                        className="flex flex-col items-center p-2"
                    >
                        <Leaf className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger
                        value="fruit"
                        className="flex flex-col items-center p-2"
                    >
                        <Leaf className="h-4 w-4" />
                    </TabsTrigger>
                </TabsList>

                <TabsContent
                    value="settings"
                    className="mt-0 min-h-0 flex-1 overflow-y-auto pt-4 pr-2"
                >
                    <SettingsTab {...props} />
                </TabsContent>

                <TabsContent
                    value="lsystem"
                    className="mt-0 min-h-0 flex-1 overflow-y-auto pt-4 pr-2"
                >
                    <LSystemTab {...props} />
                </TabsContent>

                <TabsContent
                    value="stem"
                    className="mt-0 min-h-0 flex-1 overflow-y-auto pt-4 pr-2"
                >
                    <StemTab {...props} />
                </TabsContent>

                <TabsContent
                    value="leaf"
                    className="mt-0 min-h-0 flex-1 overflow-y-auto pt-4 pr-2"
                >
                    <LeafTab {...props} />
                </TabsContent>

                <TabsContent
                    value="flower"
                    className="mt-0 min-h-0 flex-1 overflow-y-auto pt-4 pr-2"
                >
                    <FlowerTab {...props} />
                </TabsContent>

                <TabsContent
                    value="fruit"
                    className="mt-0 min-h-0 flex-1 overflow-y-auto pt-4 pr-2"
                >
                    <FruitTab {...props} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
