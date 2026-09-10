import {
    GameInformationIcon,
    GameJournalIcon,
    GameSeedlingIcon,
    GameToolsIcon,
} from '@gredice/ui/GameIcons';
import { TabsList, TabsTrigger } from '@gredice/ui/Tabs';

const diary = { value: 'diary', label: 'Dnevnik', Icon: GameJournalIcon };
const operations = {
    value: 'operations',
    label: 'Radnje',
    Icon: GameToolsIcon,
};
const bedTabs = [
    diary,
    operations,
    { value: 'info', label: 'Informacije', Icon: GameInformationIcon },
];
const plantTabs = [
    { value: 'lifecycle', label: 'Biljka', Icon: GameSeedlingIcon },
    diary,
    operations,
];

/** Keep sibling destinations in the bed and plant details visually consistent. */
export function RaisedBedDetailsTabsList({
    view,
    showOperations = true,
}: {
    view: 'bed' | 'plant';
    showOperations?: boolean;
}) {
    const tabs = view === 'bed' ? bedTabs : plantTabs;
    return (
        <TabsList
            aria-label={view === 'bed' ? 'Detalji gredice' : 'Detalji biljke'}
            className="w-fit max-w-full self-center"
        >
            {tabs
                .filter(({ value }) => showOperations || value !== 'operations')
                .map(({ value, label, Icon }) => (
                    <TabsTrigger
                        key={value}
                        value={value}
                        className="max-sm:gap-1 max-sm:px-2"
                    >
                        <Icon
                            aria-hidden
                            className="size-4 shrink-0 sm:size-5"
                        />
                        <span>{label}</span>
                    </TabsTrigger>
                ))}
        </TabsList>
    );
}
