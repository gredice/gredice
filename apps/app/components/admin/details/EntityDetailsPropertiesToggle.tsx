'use client';

import { PanelRightClose } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useEntityDetailsProperties } from './EntityDetailsPropertiesContext';

export function EntityDetailsPropertiesToggle() {
    const { isOpen, toggle } = useEntityDetailsProperties();

    return (
        <IconButton
            variant="plain"
            onClick={toggle}
            title={isOpen ? 'Sakrij detalje' : 'Prikaži detalje'}
            aria-controls="entity-details-properties-panel"
            aria-pressed={isOpen}
            className="rounded-md text-muted-foreground hover:text-foreground"
        >
            <PanelRightClose
                className={`size-5 transition-transform ${
                    isOpen ? '' : 'rotate-180'
                }`}
            />
        </IconButton>
    );
}
