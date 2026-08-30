import { useState } from 'react';
import { GardenStructureCatalogPicker } from '../../../packages/game/src/structures/catalog/GardenStructureCatalogPicker';
import { gardenStructureKitV1Catalog } from '../../../packages/game/src/structures/catalog/gardenStructureKitV1Catalog';

export function GardenStructureCatalogPickerStory() {
    const [selectedId, setSelectedId] = useState<string | null>('barn');

    return (
        <GardenStructureCatalogPicker
            ariaLabel="Predložak građevine"
            entries={gardenStructureKitV1Catalog.templates}
            onSelectionChange={setSelectedId}
            selectedId={selectedId}
        />
    );
}
