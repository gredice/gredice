'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { PanelRightClose } from '@gredice/ui/icons';
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
