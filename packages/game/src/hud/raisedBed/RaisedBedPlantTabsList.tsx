import { PlantOrSortImage } from '@gredice/ui/plants';
import { TabsList, TabsTrigger } from '@gredice/ui/Tabs';

export type RaisedBedPlantTab = {
    coverUrl: string | null;
    label: string;
    value: string;
};

export function RaisedBedPlantTabsList({
    tabs,
}: {
    tabs: readonly RaisedBedPlantTab[];
}) {
    return (
        <TabsList
            aria-label="Biljke u polju"
            className="grid w-full"
            style={{
                gridTemplateColumns: `repeat(${tabs.length.toString()}, minmax(0, 1fr))`,
            }}
        >
            {tabs.map((tab) => (
                <TabsTrigger
                    className="min-w-0 px-2"
                    data-raised-bed-plant-tab={tab.value}
                    key={tab.value}
                    value={tab.value}
                >
                    <PlantOrSortImage
                        alt=""
                        aria-hidden
                        className="size-7 shrink-0 rounded-full object-cover"
                        coverUrl={tab.coverUrl}
                        height={28}
                        width={28}
                    />
                    <span className="truncate">{tab.label}</span>
                </TabsTrigger>
            ))}
        </TabsList>
    );
}
