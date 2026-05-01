import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type ComponentType, useState } from 'react';

// Vite resolves this glob at build/HMR time — no story update needed when new
// *Icon.tsx files are added to the UI package.
const iconModules = import.meta.glob(
    '../../../../../packages/ui/src/**/*Icon.tsx',
    { eager: true },
);

// Only icons that require props beyond SVGProps need an entry here.
const iconDefaultProps: Record<string, Record<string, unknown>> = {
    RaisedBedIcon: { physicalId: null },
    RaisedBedIdentifierIcon: { physicalId: null },
    PlantGridIcon: { totalPlants: 4 },
};

type IconEntry = {
    name: string;
    Component: ComponentType<{ className?: string; [key: string]: unknown }>;
    defaultProps: Record<string, unknown>;
};

function collectIcons(): IconEntry[] {
    const seen = new Set<string>();
    const icons: IconEntry[] = [];

    for (const module of Object.values(iconModules)) {
        if (!module || typeof module !== 'object') continue;
        for (const [name, value] of Object.entries(
            module as Record<string, unknown>,
        )) {
            if (!name.endsWith('Icon') || typeof value !== 'function') continue;
            if (seen.has(name)) continue;
            seen.add(name);
            icons.push({
                name,
                Component: value as IconEntry['Component'],
                defaultProps: iconDefaultProps[name] ?? {},
            });
        }
    }

    return icons.sort((a, b) => a.name.localeCompare(b.name));
}

const allIcons = collectIcons();

function IconsShowcase() {
    const [query, setQuery] = useState('');
    const filtered = query
        ? allIcons.filter((i) =>
              i.name.toLowerCase().includes(query.toLowerCase()),
          )
        : allIcons;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <input
                    type="search"
                    placeholder="Filter icons…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                    {filtered.length} / {allIcons.length}
                </span>
            </div>

            {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                    No icons match &ldquo;{query}&rdquo;
                </p>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                    {filtered.map(({ name, Component, defaultProps }) => (
                        <div
                            key={name}
                            className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                            title={name}
                        >
                            <Component
                                className="size-8 text-primary"
                                {...defaultProps}
                            />
                            <span className="w-full truncate text-center font-mono text-xs text-muted-foreground">
                                {name}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Placeholder component — Meta needs a component; render() overrides the output.
function IconsShowcasePage() {
    return <IconsShowcase />;
}

const meta = {
    title: 'packages/ui/Icons/Showcase',
    component: IconsShowcasePage,
    parameters: {
        layout: 'padded',
    },
    render: () => <IconsShowcase />,
} satisfies Meta<typeof IconsShowcasePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
