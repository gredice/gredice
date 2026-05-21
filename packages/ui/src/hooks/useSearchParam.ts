'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function useSetSearchParam(parameterName: string) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    return useCallback(
        (value?: string | null) => {
            const current = searchParams.get(parameterName);
            if (current === value || (current == null && value == null)) {
                return;
            }

            const next = new URLSearchParams(
                Array.from(searchParams.entries()),
            );
            if (value) {
                next.set(parameterName, value);
            } else {
                next.delete(parameterName);
            }

            const query = next.toString();
            router.replace(`${pathname}${query ? `?${query}` : ''}`);
        },
        [parameterName, pathname, router, searchParams],
    );
}

export function useSearchParam(parameterName: string, defaultValue?: string) {
    const value = useSearchParams().get(parameterName) ?? defaultValue;
    return [value, useSetSearchParam(parameterName)] as const;
}
