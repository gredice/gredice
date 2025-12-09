'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Logotype } from '../Logotype';

export default function LoginBanner() {
    const [hasToken, setHasToken] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('gredice-token');
        setHasToken(!!token);
    }, []);

    if (hasToken) {
        return null;
    }

    return (
        <div className="flex fixed top-4 left-0 w-full justify-center px-4 sm:px-6 z-[51] pointer-events-none">
            <Link
                href="https://www.gredice.com"
                className="pointer-events-auto inline-flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 rounded-2xl dark:bg-card/90 px-4 sm:px-5 py-3 shadow-xl ring-1 ring-primary/10 backdrop-blur supports-[backdrop-filter]:bg-white/75 transition hover:-translate-y-0.5 hover:shadow-2xl"
                target="_blank"
                rel="noreferrer"
            >
                <Logotype className="h-6 sm:h-7 w-auto dark:fill-[#68ba7f] sm:mb-1" />
                <div className="flex flex-row sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                    <div className="flex flex-col leading-tight">
                        <span className="text-xs sm:text-sm font-medium text-foreground text-left">
                            Znaš li već za Gredice ili želiš saznati više?
                        </span>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-primary underline-offset-2 decoration-primary/60 hover:underline whitespace-nowrap">
                        Posjeti gredice.com
                    </span>
                </div>
            </Link>
        </div>
    );
}
