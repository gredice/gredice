import { Stack } from '@signalco/ui-primitives/Stack';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RecipeList } from '../../components/recipes/RecipeList';
import { PageHeader } from '../../components/shared/PageHeader';
import { getRecipesData } from '../../lib/recipes/getRecipesData';
import { recipesFlag } from '../flags';

export const metadata: Metadata = {
    title: 'Recepti',
    description: 'Ideje kako iskoristiti svoje povrće.',
};

export default async function RecipesPage() {
    const isRecipesEnabled = await recipesFlag();
    if (!isRecipesEnabled) {
        notFound();
    }

    const recipes = await getRecipesData();
    return (
        <Stack spacing={4} className="py-8">
            <PageHeader
                header="Recepti"
                subHeader="Isprobaj neke od naših omiljenih jela."
            />
            <RecipeList recipes={recipes} />
        </Stack>
    );
}
