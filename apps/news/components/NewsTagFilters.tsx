'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const defaultTagPath = '/sto-je-novo' satisfies Route;

function tagPath(basePath: Route, tag: string): Route {
    return `${basePath}?tag=${encodeURIComponent(tag)}` as Route;
}

export function NewsTagFilters({
    activeTag,
    basePath = defaultTagPath,
    dropdownTags,
    primaryTags,
}: {
    activeTag?: string;
    basePath?: Route;
    dropdownTags: string[];
    primaryTags: string[];
}) {
    const router = useRouter();

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Link
                className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
                    activeTag
                        ? 'bg-background text-muted-foreground'
                        : 'bg-primary text-primary-foreground'
                }`}
                href={basePath}
            >
                Sve
            </Link>
            {primaryTags.map((value) => (
                <Link
                    key={value}
                    className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
                        activeTag === value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:text-foreground'
                    }`}
                    href={tagPath(basePath, value)}
                >
                    {value}
                </Link>
            ))}
            {dropdownTags.length > 0 ? (
                <select
                    aria-label="Ostali tagovi"
                    className="min-h-9 rounded-sm border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    onChange={(event) => {
                        const selectedTag = event.currentTarget.value;
                        router.push(
                            selectedTag
                                ? tagPath(basePath, selectedTag)
                                : basePath,
                        );
                    }}
                    value={
                        activeTag && dropdownTags.includes(activeTag)
                            ? activeTag
                            : ''
                    }
                >
                    <option value="">Ostali tagovi</option>
                    {dropdownTags.map((value) => (
                        <option key={value} value={value}>
                            {value}
                        </option>
                    ))}
                </select>
            ) : null}
        </div>
    );
}
