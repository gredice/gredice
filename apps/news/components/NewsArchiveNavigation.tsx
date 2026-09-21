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
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-b pb-4">
            <nav aria-label="Vrsta objava">
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                    {newsArchives.map((archive) => {
                        const isActive = archive.value === active;

                        return (
                            <li key={archive.value}>
                                <Link
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`flex min-h-11 items-center border-b-2 px-0.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                        isActive
                                            ? 'border-green-800 text-green-900 dark:border-green-200 dark:text-green-100'
                                            : 'border-transparent text-muted-foreground hover:border-green-800/30 hover:text-foreground dark:hover:border-green-200/40'
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
