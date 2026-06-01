import Link from 'next/link';

const debugGroups = [
    {
        title: 'Entities',
        pages: [
            {
                href: '/debug/entities',
                title: 'Entity grid',
                description: 'All registered garden entities in one 3D scene.',
            },
            {
                href: '/debug/entities/FireflyJar?zoom=130&static=1',
                title: 'Single entity viewer',
                description:
                    'One entity rendered with EntityViewer. Replace the path segment with any entity name.',
            },
        ],
    },
    {
        title: 'Game Scene Profiles',
        pages: [
            {
                href: '/debug/profile/game',
                title: 'Baseline',
                description: 'Full mock garden scene for baseline rendering.',
            },
            {
                href: '/debug/profile/game?mode=details',
                title: 'Details',
                description:
                    'Mock garden scene with deferred detail rendering enabled.',
            },
            {
                href: '/debug/profile/game?mode=rain&quality=low',
                title: 'Rain',
                description: 'Mock garden scene with rainy weather.',
            },
            {
                href: '/debug/profile/game?mode=snow&quality=low',
                title: 'Snow',
                description: 'Mock garden scene with winter weather.',
            },
            {
                href: '/debug/profile/game?mode=night&quality=low',
                title: 'Night',
                description: 'Mock garden scene at night.',
            },
            {
                href: '/debug/profile/game?mode=storm&quality=low',
                title: 'Storm',
                description: 'Mock garden scene with heavy rain and thunder.',
            },
            {
                href: '/debug/profile/game?mode=autumn&quality=low',
                title: 'Autumn',
                description: 'Mock garden scene with autumn time and wind.',
            },
            {
                href: '/debug/sandbox',
                title: 'Local sandbox',
                description:
                    'Playable sandbox scene backed by browser local storage.',
            },
        ],
    },
    {
        title: 'Plants',
        pages: [
            {
                href: '/debug/plants',
                title: 'Plant performance',
                description:
                    'Generated plant presets rendered in dense batches.',
            },
        ],
    },
] as const;

export default function DebugIndexPage() {
    return (
        <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
                <header>
                    <h1 className="text-2xl font-bold">Debug</h1>
                    <p className="mt-2 max-w-2xl text-sm text-neutral-400">
                        Available garden debug pages.
                    </p>
                </header>
                {debugGroups.map((group) => (
                    <section key={group.title} className="flex flex-col gap-3">
                        <h2 className="text-sm font-semibold uppercase text-neutral-500">
                            {group.title}
                        </h2>
                        <div className="grid gap-3 md:grid-cols-2">
                            {group.pages.map((page) => (
                                <Link
                                    key={page.href}
                                    href={page.href}
                                    className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600 hover:bg-neutral-900/80"
                                >
                                    <span className="block text-base font-semibold">
                                        {page.title}
                                    </span>
                                    <span className="mt-1 block text-sm text-neutral-400">
                                        {page.description}
                                    </span>
                                    <span className="mt-3 block break-all font-mono text-xs text-neutral-500">
                                        {page.href}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </main>
    );
}
