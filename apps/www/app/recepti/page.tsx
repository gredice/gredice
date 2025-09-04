import { Stack } from '@signalco/ui-primitives/Stack';
import type { Metadata } from 'next';
import { RecipeList } from '../../components/recipes/RecipeList';
import { PageHeader } from '../../components/shared/PageHeader';
import { getRecipesData } from '../../lib/recipes/getRecipesData';

export const metadata: Metadata = {
    title: 'Recepti',
    description: 'Ideje kako iskoristiti svoje povrće.',
};

export default async function RecipesPage() {
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
