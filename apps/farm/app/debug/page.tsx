import { notFound } from 'next/navigation';
import { HomeButton } from '../../components/HomeButton';

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

                <section className="rounded-lg border bg-background p-4 text-sm text-muted-foreground shadow-xs">
                    No debug pages are linked from this dashboard.
                </section>
            </div>
        </main>
    );
}
