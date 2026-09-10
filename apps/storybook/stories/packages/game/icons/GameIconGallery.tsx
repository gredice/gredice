import { useId, useState } from 'react';
import { gameIconCatalog } from './gameIconCatalog';

export function GameIconGallery({
    initialGroup = 'All',
}: {
    initialGroup?: string;
}) {
    const [query, setQuery] = useState('');
    const [group, setGroup] = useState(initialGroup);
    const [surface, setSurface] = useState('light');
    const id = useId();
    const groups = [...new Set(gameIconCatalog.map((icon) => icon.group))];
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = gameIconCatalog.filter(
        (icon) =>
            (group === 'All' || group === icon.group) &&
            [icon.name, icon.description, ...icon.sources]
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery),
    );

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <header className="max-w-3xl space-y-2">
                <h1 className="text-2xl font-semibold">
                    In-game icon inventory
                </h1>
                <p className="text-sm text-muted-foreground">
                    Current garden, HUD, dialogs and public garden viewer icons.
                    Use the monochrome groups to plan styled replacements and
                    the shopping basket, backpack and other artwork as visual
                    references. Brand marks, weather and emoji are listed
                    separately for review.
                </p>
                <p className="text-xs text-muted-foreground">
                    Source inventory baseline: 9 September 2026. Includes debug
                    and account screens. Plant photos, product thumbnails, 3D
                    models and decorative chart or panel geometry are outside
                    this icon catalog. CDN artwork is snapshotted locally so the
                    gallery works offline.
                </p>
            </header>
            <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-0 flex-1 basis-64 space-y-1">
                    <label
                        htmlFor={`${id}-search`}
                        className="block text-sm font-medium"
                    >
                        Search icons or source files
                    </label>
                    <input
                        id={`${id}-search`}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="ShoppingCart, shovel, GardenAvatarHud…"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
                    />
                </div>
                <div className="space-y-1">
                    <label
                        htmlFor={`${id}-group`}
                        className="block text-sm font-medium"
                    >
                        Icon family
                    </label>
                    <select
                        id={`${id}-group`}
                        value={group}
                        onChange={(event) => setGroup(event.target.value)}
                        className="max-w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                        <option value="All">All families</option>
                        {groups.map((name) => (
                            <option key={name} value={name}>
                                {name} (
                                {
                                    gameIconCatalog.filter(
                                        (icon) => icon.group === name,
                                    ).length
                                }
                                )
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <label
                        htmlFor={`${id}-surface`}
                        className="block text-sm font-medium"
                    >
                        Preview surface
                    </label>
                    <select
                        id={`${id}-surface`}
                        value={surface}
                        onChange={(event) => setSurface(event.target.value)}
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </div>
            </div>
            <p role="status" className="text-sm text-muted-foreground">
                {filtered.length} of {gameIconCatalog.length} icon entries
            </p>
            {filtered.length === 0 && (
                <p className="py-8 text-muted-foreground">
                    No matching icons. Try another name, source file or family.
                </p>
            )}
            {groups.map((name) => {
                const entries = filtered.filter((icon) => icon.group === name);
                if (!entries.length) return null;
                return (
                    <section key={name} className="space-y-3" aria-label={name}>
                        <h2 className="text-lg font-semibold">
                            {name}{' '}
                            <span className="font-normal text-muted-foreground">
                                ({entries.length})
                            </span>
                        </h2>
                        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {entries.map((icon) => (
                                <li
                                    key={icon.name}
                                    className="min-w-0 overflow-hidden rounded-lg border border-border bg-card"
                                >
                                    <div
                                        className={`flex h-32 items-center justify-center overflow-hidden p-4 ${surface === 'dark' ? 'dark bg-neutral-900 text-neutral-100' : 'bg-stone-100 text-stone-900'}`}
                                    >
                                        {icon.preview}
                                    </div>
                                    <div className="space-y-2 p-4">
                                        <h3 className="break-words font-mono text-sm font-semibold">
                                            {icon.name}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            {icon.description}
                                        </p>
                                        <details className="text-xs">
                                            <summary className="cursor-pointer rounded-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary">
                                                Source locations (
                                                {icon.sources.length})
                                            </summary>
                                            <ul className="mt-2 space-y-2">
                                                {icon.sources.map((source) => (
                                                    <li
                                                        key={source}
                                                        className="break-words font-mono text-muted-foreground"
                                                    >
                                                        {source}
                                                    </li>
                                                ))}
                                            </ul>
                                        </details>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}
        </main>
    );
}
