'use client';

/**
 * Main control panel component with tabbed interface
 */

import { Edit, Leaf, Settings, Sprout } from '@signalco/ui-icons';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import type { PlantControlsProps } from '../@types/plant-generator';
import { FlowerTab } from './FlowersTab';
import { FruitTab } from './FruitTab';
import { LeafTab } from './LeafTab';
import { LSystemTab } from './LSystemTab';
import { SettingsTab } from './SettingsTab';
import { StemTab } from './StemTab';

/**
 * Main control panel with tabbed interface for all plant parameters
 */
export function PlantControls(props: PlantControlsProps) {
    const { state, onStateChange } = props;

    return (
        <Tabs
            value={state.activeTab}
            onValueChange={(value: string) =>
                onStateChange({ activeTab: value })
            }
            className="w-full"
        >
            {/* Tab Navigation */}
            <TabsList className="grid w-full grid-cols-6 border">
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

            {/* Tab Content */}
            <TabsContent value="settings" className="pt-4">
                <SettingsTab {...props} />
            </TabsContent>

            <TabsContent value="lsystem" className="pt-4">
                <LSystemTab {...props} />
            </TabsContent>

            <TabsContent value="stem" className="pt-4">
                <StemTab {...props} />
            </TabsContent>

            <TabsContent value="leaf" className="pt-4">
                <LeafTab {...props} />
            </TabsContent>

            <TabsContent value="flower" className="pt-4">
                <FlowerTab {...props} />
            </TabsContent>

            <TabsContent value="fruit" className="pt-4">
                <FruitTab {...props} />
            </TabsContent>
        </Tabs>
    );
}
