'use client';

import { PanelRightClose } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useDesktopNav } from './DesktopNavProvider';

export function DesktopNavToggle() {
    const { isExpanded, toggle } = useDesktopNav();

    return (
        <IconButton
            variant="plain"
            onClick={toggle}
            title={
                isExpanded
                    ? 'Sažmi bočnu navigaciju'
                    : 'Proširi bočnu navigaciju'
            }
            className="hidden rounded-md text-muted-foreground hover:text-foreground md:inline-flex"
        >
            <PanelRightClose
                className={`size-4 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                }`}
            />
        </IconButton>
    );
}
