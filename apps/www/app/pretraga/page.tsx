import { directoriesClient } from '@gredice/client';
import {
    type DirectoryEntityTypeName,
    publicSearchCategoryByDirectoryEntityType,
} from '@gredice/directory-types';
import { Search, Warning } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { PageFilterInputNoSSR } from '../../components/shared/PageFilterInputNoSSR';

const categoryOptions = [
    { slug: 'all', label: 'Sve' },
    ...Object.values(publicSearchCategoryByDirectoryEntityType),
] as const;

export const revalidate = 300;

export const metadata = {
    title: 'Pretraga',
    description: 'Pretraži javni sadržaj na Gredice webu.',
    robots: {
        index: false,
        follow: true,
    },
    alternates: {
        canonical: '/pretraga',
    },
};

function getStringParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }
    return value ?? '';
}

type SearchResult = {
    entityId: number;
    entityType: DirectoryEntityTypeName;
    category: string;
    categoryLabel: string;
    title: string;
    summary: string | null;
    imageUrl: string | null;
    imageAlt: string | null;
    href: string;
};

async function loadResults(query: string, category: string) {
    if (query.trim().length < 2) {
        return { results: [] as SearchResult[], error: null as string | null };
    }

    const categoryParam = category !== 'all' ? category : undefined;

    try {
        const { data, error } = await directoriesClient().GET('/search', {
            params: {
                query: {
                    q: query,
                    category: categoryParam,
                    limit: 20,
                },
            },
        });

        if (error) {
            return {
                results: [],
                error: 'Nešto nije u redu s pretragom. Pokušaj ponovno za nekoliko trenutaka.',
            };
        }

        return { results: data?.results ?? [], error: null };
    } catch {
        return {
            results: [],
            error: 'Nešto nije u redu s pretragom. Pokušaj ponovno za nekoliko trenutaka.',
        };
    }
}

export default async function SearchPage({
    searchParams,
}: PageProps<'/pretraga'>) {
    const params = await searchParams;
    const query = getStringParam(params.pretraga);
    const category = getStringParam(params.kategorija) || 'all';
    const selectedCategory = categoryOptions.some(
        (item) => item.slug === category,
    )
        ? category
        : 'all';

    const { results, error } = await loadResults(query, selectedCategory);

    return (
        <Stack spacing={4} className="py-4">
            <Typography level="h1">Pretraga</Typography>
            <PageFilterInputNoSSR
                searchParamName="pretraga"
                fieldName="global-search"
                initialValue={query}
                className="w-full"
            />

            <Row spacing={2} className="flex-wrap">
                {categoryOptions.map((option) => {
                    const href = `/pretraga?pretraga=${encodeURIComponent(query)}${option.slug === 'all' ? '' : `&kategorija=${option.slug}`}`;
                    const active = selectedCategory === option.slug;
                    return (
                        <Button
                            key={option.slug}
                            variant={active ? 'solid' : 'outlined'}
                            size="sm"
                            asChild
                        >
                            <Link href={href}>{option.label}</Link>
                        </Button>
                    );
                })}
            </Row>

            {error ? (
                <Card className="p-4">
                    <Row spacing={2} alignItems="center">
                        <Warning className="size-5 text-orange-500" />
                        <Typography>{error}</Typography>
                    </Row>
                </Card>
            ) : null}

            {!query.trim() ? (
                <Card className="p-6 text-center">
                    <Search className="size-8 mx-auto mb-2 text-muted-foreground" />
                    <Typography>Upiši pojam za pretragu.</Typography>
                </Card>
            ) : query.trim().length < 2 ? (
                <Card className="p-6 text-center">
                    <Typography>Upiši barem 2 znaka za pretragu.</Typography>
                </Card>
            ) : results.length === 0 && !error ? (
                <Card className="p-6 text-center">
                    <Typography>Nema rezultata za zadani pojam.</Typography>
                </Card>
            ) : (
                <Stack spacing={3}>
                    {results.map((result) => (
                        <Card
                            key={`${result.entityType}-${result.entityId}`}
                            className="p-4"
                        >
                            <Stack spacing={2}>
                                <Row
                                    spacing={2}
                                    alignItems="center"
                                    className="flex-wrap"
                                >
                                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium">
                                        {result.categoryLabel}
                                    </span>
                                    <Link
                                        href={result.href.replace(
                                            'https://www.gredice.com',
                                            '',
                                        )}
                                    >
                                        <Typography level="h5">
                                            {result.title}
                                        </Typography>
                                    </Link>
                                </Row>
                                {result.summary ? (
                                    <Typography>{result.summary}</Typography>
                                ) : null}
                                <Link
                                    href={result.href.replace(
                                        'https://www.gredice.com',
                                        '',
                                    )}
                                    className="text-sm text-green-700"
                                >
                                    Otvori stranicu
                                </Link>
                            </Stack>
                        </Card>
                    ))}
                </Stack>
            )}
        </Stack>
    );
}
