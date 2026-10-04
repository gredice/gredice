'use client';

import { SidePanelToggleButton } from '@gredice/ui/SidePanelLayout';
import { useDesktopNav } from './DesktopNavProvider';

export function DesktopNavToggle() {
    const { isExpanded, toggle } = useDesktopNav();

    return (
        <SidePanelToggleButton
            className="hidden md:inline-flex"
            label="navigaciju"
            onClick={toggle}
            open={isExpanded}
            side="left"
        />
    );
}
