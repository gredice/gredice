import { type components, directoriesClient } from '@gredice/client';
import { Card } from '@gredice/ui/Card';
import { Search, Warning } from '@gredice/ui/icons';
import { PageHeader } from '@gredice/ui/PageHeader';
import {
    normalizeSearchCategory,
    searchCategoryParam,
    searchPageLimit,
} from '@gredice/ui/PublicChrome';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { SearchInteractive } from './SearchInteractive';
import { SearchPageControls } from './SearchPageControls';

export const revalidate = 300;

const pageDescription =
    'Pronađi biljke, sorte, radnje, bolesti, štetnike, blokove i sjeme na Gredice webu.';

export const metadata = {
    title: 'Pretraga',
    description: pageDescription,
    robots: {
        index: false,
        follow: true,
    },
    alternates: {
        canonical: '/pretraga',
    },
};

type SearchResult = components['schemas']['directory-search-result'];

function getStringParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }
    return value ?? '';
}

function getPageParam(value: string | string[] | undefined) {
    const page = Number.parseInt(getStringParam(value), 10);
    return Number.isFinite(page) && page > 1 ? page : 1;
}

async function loadResults(
    query: string,
    category: ReturnType<typeof normalizeSearchCategory>,
    page: number,
) {
    if (query.trim().length < 2) {
        return { results: [] as SearchResult[], error: null as string | null };
    }

    try {
        const { data, error } = await directoriesClient().GET('/search', {
            params: {
                query: {
                    q: query,
                    category: searchCategoryParam(category),
                    limit: searchPageLimit,
                    offset: (page - 1) * searchPageLimit,
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
    const selectedCategory = normalizeSearchCategory(params.kategorija);
    const page = getPageParam(params.stranica);
    const { results, error } = await loadResults(query, selectedCategory, page);
    const trimmedQuery = query.trim();
    const hasNextPage = results.length === searchPageLimit;

    return (
        <Stack spacing={5} className="py-4">
            <PageHeader header="Pretraga" subHeader={pageDescription} padded />

            <Stack spacing={3}>
                <SearchPageControls
                    query={query}
                    selectedCategory={selectedCategory}
                />

                {error ? (
                    <Card className="p-4">
                        <Row spacing={4} alignItems="center">
                            <Warning className="size-5 text-orange-500" />
                            <Typography>{error}</Typography>
                        </Row>
                    </Card>
                ) : null}

                <SearchInteractive
                    query={query}
                    selectedCategory={selectedCategory}
                    results={trimmedQuery.length >= 2 ? results : []}
                    page={page}
                    hasNextPage={trimmedQuery.length >= 2 && hasNextPage}
                />

                {!trimmedQuery ? (
                    <Card className="p-6 text-center">
                        <Search className="mx-auto mb-2 size-8 text-muted-foreground" />
                        <Typography>Upiši pojam za pretragu.</Typography>
                    </Card>
                ) : trimmedQuery.length < 2 ? (
                    <Card className="p-6 text-center">
                        <Typography>
                            Upiši barem 2 znaka za pretragu.
                        </Typography>
                    </Card>
                ) : results.length === 0 && !error ? (
                    <Card className="p-6 text-center">
                        <Typography>Nema rezultata za zadani pojam.</Typography>
                    </Card>
                ) : null}
            </Stack>
        </Stack>
    );
}
