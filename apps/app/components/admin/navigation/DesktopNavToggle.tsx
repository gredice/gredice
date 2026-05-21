'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { PanelRightClose } from '@gredice/ui/icons';
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
