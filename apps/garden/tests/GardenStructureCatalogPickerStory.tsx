import { useMemo, useState } from 'react';
import { GardenStructureCatalogPicker } from '../../../packages/game/src/structures/catalog/GardenStructureCatalogPicker';
import {
    gardenStructureKitV1Catalog,
    gardenStructureKitV1CatalogEntries,
} from '../../../packages/game/src/structures/catalog/gardenStructureKitV1Catalog';

export function GardenStructureCatalogPickerStory() {
    const [selectedKey, setSelectedKey] = useState<string | null>(
        gardenStructureKitV1Catalog.templates[0]?.key ?? null,
    );

    return (
        <GardenStructureCatalogPicker
            ariaLabel="Predložak građevine"
            entries={gardenStructureKitV1Catalog.templates}
            onSelectionChange={(entry) => setSelectedKey(entry?.key ?? null)}
            selectedKey={selectedKey}
        />
    );
}

export function GardenStructureCatalogMixedPickerStory() {
    const entries = useMemo(
        () =>
            gardenStructureKitV1CatalogEntries.filter(
                (entry) => entry.id === 'floor.timber',
            ),
        [],
    );
    const [selectedKey, setSelectedKey] = useState<string | null>(
        entries[0]?.key ?? null,
    );

    return (
        <div>
            <GardenStructureCatalogPicker
                ariaLabel="Miješani katalog"
                entries={entries}
                onSelectionChange={(entry) =>
                    setSelectedKey(entry?.key ?? null)
                }
                selectedKey={selectedKey}
            />
            <output data-testid="mixed-catalog-selection">
                {selectedKey ?? 'none'}
            </output>
        </div>
    );
}
