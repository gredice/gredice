'use client';

import { useEffect } from 'react';
import { useDesktopNav } from './DesktopNavProvider';

export function DesktopNavCollapseOnMount() {
    const { setExpanded } = useDesktopNav();

    useEffect(() => {
        setExpanded(false);
    }, [setExpanded]);

    return null;
}
