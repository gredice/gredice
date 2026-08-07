import type { Route } from 'next';
import Link from 'next/link';

type NewsArchive = 'blog' | 'changelog';

const newsArchives = [
    { href: '/', label: 'Blog', value: 'blog' },
    {
        href: '/sto-je-novo',
        label: 'Što je novo',
        value: 'changelog',
    },
] satisfies { href: Route; label: string; value: NewsArchive }[];

export function NewsArchiveNavigation({ active }: { active: NewsArchive }) {
    return (
        <nav aria-label="Arhive novosti" className="border-b">
            <ul className="flex gap-6">
                {newsArchives.map((archive) => {
                    const isActive = archive.value === active;

                    return (
                        <li key={archive.value}>
                            <Link
                                aria-current={isActive ? 'page' : undefined}
                                className={`-mb-px block border-b-2 px-1 pb-3 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                    isActive
                                        ? 'border-primary text-foreground'
                                        : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
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
    );
}
