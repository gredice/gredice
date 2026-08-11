import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RecipeList } from '../../components/recipes/RecipeList';
import { getRecipesData } from '../../lib/recipes/getRecipesData';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';
import { recipesFlag } from '../flags';

export const metadata: Metadata = createPublicMetadata({
    title: 'Recepti',
    description: 'Ideje kako iskoristiti svoje povrće.',
    path: KnownPages.Recipes,
    category: 'Iz vrta na stol',
});

export default async function RecipesPage() {
    const isRecipesEnabled = await recipesFlag();
    if (!isRecipesEnabled) {
        notFound();
    }

    const recipes = await getRecipesData();
    return (
        <Stack spacing={8} className="py-8">
            <PageHeader
                header="Recepti"
                subHeader="Isprobaj neke od naših omiljenih jela."
            />
            <RecipeList recipes={recipes} />
        </Stack>
    );
}
