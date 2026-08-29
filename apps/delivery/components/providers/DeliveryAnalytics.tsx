'use client';

import { Analytics } from '@vercel/analytics/react';
import { usePathname } from 'next/navigation';

const excludedPaths = ['/prijava/android', '/android/auth/callback'];

export function DeliveryAnalytics() {
    const pathname = usePathname();
    return excludedPaths.includes(pathname) ? null : <Analytics />;
}
