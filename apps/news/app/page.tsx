import { EmptyNewsState } from '../components/EmptyNewsState';
import { FilterPills } from '../components/FilterPills';
import { NewsCard } from '../components/NewsCard';
import { getBlogPosts, uniqueNewsValues } from '../lib/news';

export const dynamic = 'force-dynamic';

export default async function NewsHomePage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string; tag?: string }>;
}) {
    const { category, tag } = await searchParams;
    const [allPosts, posts] = await Promise.all([
        getBlogPosts(),
        category || tag ? getBlogPosts({ category, tag }) : getBlogPosts(),
    ]);
    const categories = uniqueNewsValues(allPosts, (item) => item.category);
    const tags = uniqueNewsValues(allPosts, (item) => item.tags);

    return (
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
            <section className="grid gap-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Novosti
                </p>
                <h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-4xl">
                    Blog iz Gredica
                </h1>
                <p className="max-w-2xl text-lg text-muted-foreground">
                    Savjeti, priče iz vrta i obavijesti koje pomažu pratiti što
                    se događa u Gredicama.
                </p>
            </section>
            <aside className="grid gap-4 rounded-md border bg-muted/15 p-4">
                <FilterPills
                    active={category}
                    label="Kategorije"
                    param="category"
                    values={categories}
                />
                <FilterPills
                    active={tag}
                    label="Tagovi"
                    param="tag"
                    values={tags}
                />
            </aside>
            {posts.length > 0 ? (
                <section className="grid gap-4">
                    {posts.map((post) => (
                        <NewsCard
                            key={post.id}
                            entry={post}
                            href={`/${post.slug}`}
                        />
                    ))}
                </section>
            ) : (
                <EmptyNewsState title="Još nema objava">
                    Trenutačno nema objavljenih novosti.
                </EmptyNewsState>
            )}
        </div>
    );
}
