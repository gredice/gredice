import Link from 'next/link';

import { Logotype } from '../Logotype';

export default function LoginBanner() {
    return (
        <div className="hidden sm:flex fixed top-4 left-0 w-full justify-center px-6 z-[60] pointer-events-none">
            <Link
                href="https://www.gredice.com"
                className="pointer-events-auto inline-flex items-center gap-4 rounded-2xl bg-white/90 px-5 py-3 shadow-xl ring-1 ring-primary/10 backdrop-blur supports-[backdrop-filter]:bg-white/75 transition hover:-translate-y-0.5 hover:shadow-2xl"
                target="_blank"
                rel="noreferrer"
            >
                <div className="flex items-center gap-3">
                    <Logotype className="h-7 w-auto" />
                    <div className="flex flex-col leading-tight">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                            Gredice
                        </span>
                        <span className="text-sm font-medium text-foreground">
                            Znaš li već za Gredice ili želiš saznati više?
                        </span>
                    </div>
                </div>
                <span className="text-sm font-semibold text-primary underline-offset-2 decoration-primary/60 hover:underline">
                    Posjeti gredice.com
                </span>
            </Link>
        </div>
    );
}
