import Link from 'next/link';

const debugGroups = [
    {
        title: 'Shared UI',
        pages: [
            {
                href: '/debug/select-items',
                title: 'SelectItems mobile debug',
                description:
                    'Manual mobile check for SelectItems open and close behavior.',
            },
        ],
    },
] as const;

export default function AdminDebugIndexPage() {
    return (
        <main className="min-h-screen w-full bg-background px-4 py-6 text-foreground sm:px-6 sm:py-8">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
                <header>
                    <h1 className="text-2xl font-bold">Debug</h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Available admin debug pages.
                    </p>
                </header>

                {debugGroups.map((group) => (
                    <section key={group.title} className="flex flex-col gap-3">
                        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                            {group.title}
                        </h2>
                        <div className="grid gap-3 md:grid-cols-2">
                            {group.pages.map((page) => (
                                <Link
                                    key={page.href}
                                    href={page.href}
                                    className="rounded-lg border bg-card p-4 shadow-xs transition-colors hover:border-primary/50 hover:bg-muted/30"
                                >
                                    <span className="block text-base font-semibold">
                                        {page.title}
                                    </span>
                                    <span className="mt-1 block text-sm text-muted-foreground">
                                        {page.description}
                                    </span>
                                    <span className="mt-3 block break-all font-mono text-xs text-muted-foreground">
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
