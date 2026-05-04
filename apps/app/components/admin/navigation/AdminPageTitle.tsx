'use client';

import { useContext, useEffect } from 'react';
import { AdminTitleContext } from './AdminTitleContext';

export function AdminPageTitle({
    title,
}: {
    title: string | null | undefined;
}) {
    const setTitle = useContext(AdminTitleContext);

    useEffect(() => {
        if (!setTitle) {
            return;
        }

        setTitle(title?.trim() || null);
        return () => setTitle(null);
    }, [setTitle, title]);

    return null;
}
