import { type components, directoriesClient } from '@gredice/client';
import { Search, Warning } from '@signalco/ui-icons';
import { Card } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import {
    normalizeSearchCategory,
    searchCategoryParam,
    searchPageLimit,
} from '../../components/search/searchCategories';
import { PageFilterInputNoSSR } from '../../components/shared/PageFilterInputNoSSR';
import { SearchInteractive } from './SearchInteractive';

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
        <Stack spacing={4} className="py-4">
            <Typography level="h1">Pretraga</Typography>
            <PageFilterInputNoSSR
                searchParamName="pretraga"
                fieldName="global-search"
                initialValue={query}
                className="w-full"
                navigateOnChange
                placeholder="Pretraga..."
                resetSearchParamNamesOnChange={['stranica']}
            />

            {error ? (
                <Card className="p-4">
                    <Row spacing={2} alignItems="center">
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
                    <Typography>Upiši barem 2 znaka za pretragu.</Typography>
                </Card>
            ) : results.length === 0 && !error ? (
                <Card className="p-6 text-center">
                    <Typography>Nema rezultata za zadani pojam.</Typography>
                </Card>
            ) : null}
        </Stack>
    );
}
