import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

type NewsArchive = 'changelog' | 'news';

const newsArchives = [
    { href: '/', label: 'Sve objave', value: 'news' },
    {
        href: '/sto-je-novo',
        label: 'Tjedni pregledi',
        value: 'changelog',
    },
] satisfies { href: Route; label: string; value: NewsArchive }[];

export function NewsArchiveNavigation({
    active,
    children,
}: {
    active?: NewsArchive;
    children?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b pb-3">
            <nav aria-label="Vrsta objava">
                <ul className="flex flex-wrap gap-1">
                    {newsArchives.map((archive) => {
                        const isActive = archive.value === active;

                        return (
                            <li key={archive.value}>
                                <Link
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                        isActive
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                                    href={archive.href}
                                >
                                    {archive.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
            {children}
        </div>
    );
}
