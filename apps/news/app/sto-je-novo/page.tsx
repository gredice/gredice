import Link from 'next/link';
import { EmptyNewsState } from '../../components/EmptyNewsState';
import {
    formatNewsDate,
    getChangelogEntries,
    uniqueNewsValues,
} from '../../lib/news';

export const dynamic = 'force-dynamic';

export default async function WhatsNewPage({
    searchParams,
}: {
    searchParams: Promise<{ tag?: string }>;
}) {
    const { tag } = await searchParams;
    const [allEntries, entries] = await Promise.all([
        getChangelogEntries(),
        tag ? getChangelogEntries({ tag }) : getChangelogEntries(),
    ]);
    const tags = uniqueNewsValues(allEntries, (item) => item.tags);

    return (
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
            <section className="grid gap-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Što je novo
                </p>
                <h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-4xl">
                    Promjene i nove mogućnosti
                </h1>
                <p className="max-w-2xl text-lg text-muted-foreground">
                    Kronološki pregled nadogradnji, poboljšanja i novih značajki
                    u Gredicama.
                </p>
            </section>
            {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    <Link
                        className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
                            tag
                                ? 'bg-background text-muted-foreground'
                                : 'bg-primary text-primary-foreground'
                        }`}
                        href="/sto-je-novo"
                    >
                        Sve
                    </Link>
                    {tags.map((value) => (
                        <Link
                            key={value}
                            className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
                                tag === value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background text-muted-foreground hover:text-foreground'
                            }`}
                            href={`/sto-je-novo?tag=${encodeURIComponent(value)}`}
                        >
                            {value}
                        </Link>
                    ))}
                </div>
            ) : null}
            {entries.length > 0 ? (
                <ol className="relative grid gap-4 border-l pl-5">
                    {entries.map((entry) => (
                        <li key={entry.id} className="relative">
                            <span className="absolute -left-[1.82rem] top-5 size-3 rounded-full border-2 border-background bg-primary" />
                            <Link
                                className="grid gap-3 rounded-md border bg-card p-5 shadow-xs transition-colors hover:bg-muted/20"
                                href={`/sto-je-novo/${entry.slug}`}
                            >
                                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                    {entry.publishedAt ? (
                                        <span>
                                            {formatNewsDate(entry.publishedAt)}
                                        </span>
                                    ) : null}
                                    {entry.tags.map((entryTag) => (
                                        <span key={entryTag}>{entryTag}</span>
                                    ))}
                                </div>
                                <h2 className="text-xl font-bold leading-tight">
                                    {entry.title}
                                </h2>
                                {entry.excerpt ? (
                                    <p className="text-sm leading-6 text-muted-foreground">
                                        {entry.excerpt}
                                    </p>
                                ) : null}
                            </Link>
                        </li>
                    ))}
                </ol>
            ) : (
                <EmptyNewsState title="Još nema zapisa">
                    Changelog zapisi će se prikazati ovdje čim se objave kroz
                    CMS.
                </EmptyNewsState>
            )}
        </div>
    );
}
