'use client';

import { useEffect, useState } from 'react';

function getCookie(name: string): string | undefined {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop()?.split(';').shift();
    }
    return undefined;
}

function getStopImpersonateUrl() {
    if (
        typeof window !== 'undefined' &&
        window.location.hostname.includes('.test')
    ) {
        return 'https://app.gredice.test/api/users/stop-impersonate';
    }
    return 'https://app.gredice.com/api/users/stop-impersonate';
}

export function ImpersonationBanner() {
    const [isImpersonating, setIsImpersonating] = useState(false);

    useEffect(() => {
        setIsImpersonating(getCookie('gredice_impersonating') === '1');
    }, []);

    if (!isImpersonating) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-500 text-black text-center py-1.5 px-4 text-sm font-medium">
            Prijavljen/a ste kao drugi korisnik (impersonacija).{' '}
            <form method="POST" action={getStopImpersonateUrl()} className="inline">
                <button
                    type="submit"
                    className="underline font-bold hover:text-yellow-900 bg-transparent border-none cursor-pointer p-0 text-sm text-black"
                >
                    Prekini impersonaciju
                </button>
            </form>
        </div>
    );
}
