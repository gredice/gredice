'use client';

import { SidePanelToggleButton } from '@gredice/ui/SidePanelLayout';
import { useEntityDetailsProperties } from './EntityDetailsPropertiesContext';

export function EntityDetailsPropertiesToggle() {
    const { isOpen, toggle } = useEntityDetailsProperties();

    return (
        <SidePanelToggleButton
            aria-controls="entity-details-properties-panel"
            label="detalje"
            onOpenChange={toggle}
            open={isOpen}
            side="right"
        />
    );
}
