import Image from 'next/image';
import type { ReactNode } from 'react';

interface FarmSignInShellProps {
    children: ReactNode;
}

export function FarmSignInShell({ children }: FarmSignInShellProps) {
    return (
        <main
            className="relative isolate flex min-h-[100dvh] w-full min-w-0 items-center justify-center overflow-hidden [padding-bottom:calc(var(--farm-safe-area-bottom,0px)+1rem)] [padding-left:calc(var(--farm-safe-area-left,0px)+1rem)] [padding-right:calc(var(--farm-safe-area-right,0px)+1rem)] [padding-top:calc(var(--farm-safe-area-top,0px)+1rem)] sm:[padding-bottom:calc(var(--farm-safe-area-bottom,0px)+1.5rem)] sm:[padding-left:calc(var(--farm-safe-area-left,0px)+1.5rem)] sm:[padding-right:calc(var(--farm-safe-area-right,0px)+1.5rem)] sm:[padding-top:calc(var(--farm-safe-area-top,0px)+1.5rem)]"
            data-farm-sign-in-shell
        >
            <div aria-hidden="true" className="absolute inset-0 -z-20">
                <Image
                    alt=""
                    className="object-cover"
                    fill
                    priority
                    quality={90}
                    sizes="100vw"
                    src="/login-bg.webp"
                />
            </div>
            <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-background/78 backdrop-blur-[2px] dark:bg-background/88"
            />

            <section
                aria-labelledby="farm-sign-in-heading"
                className="relative w-full max-w-md rounded-2xl border border-border/80 bg-background/95 p-5 shadow-xl shadow-black/10 backdrop-blur sm:p-7"
                data-farm-sign-in-panel
            >
                <header className="mb-7 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                        Prijava za farmere
                    </p>
                    <h1
                        className="text-3xl font-semibold tracking-tight text-foreground"
                        id="farm-sign-in-heading"
                    >
                        Gredice Farm
                    </h1>
                    <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                        Dnevni zadaci, gredice i evidencija rada na jednom
                        mjestu.
                    </p>
                </header>

                {children}
            </section>
        </main>
    );
}
