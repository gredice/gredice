import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HomeButton } from '../../components/HomeButton';

const debugGroups = [
    {
        title: 'Labels',
        pages: [
            {
                href: '/debug/labels',
                title: 'Harvest label preview',
                description:
                    'Preview and tune generated harvest labels with representative operation data.',
            },
        ],
    },
] as const;

export default function FarmDebugIndexPage() {
    if (process.env.NODE_ENV !== 'development') {
        notFound();
    }

    return (
        <main className="min-h-screen w-full bg-muted px-4 py-6 text-foreground sm:px-6 sm:py-8">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <header className="flex flex-col gap-4">
                    <HomeButton />
                    <div>
                        <h1 className="text-2xl font-bold">Debug</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            Available farm debug pages.
                        </p>
                    </div>
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
                                    className="rounded-lg border bg-background p-4 shadow-xs transition-colors hover:border-primary/50 hover:bg-accent"
                                >
                                    <span className="block text-base font-semibold text-foreground">
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
