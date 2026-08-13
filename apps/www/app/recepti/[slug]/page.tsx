import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRecipesData } from '../../../lib/recipes/getRecipesData';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';
import { recipesFlag } from '../../flags';
import { RecipeView } from './RecipeView';

export async function generateMetadata(
    props: PageProps<'/recepti/[slug]'>,
): Promise<Metadata> {
    const isRecipesEnabled = await recipesFlag();
    if (!isRecipesEnabled) {
        notFound();
    }

    const { slug } = await props.params;
    const recipe = (await getRecipesData()).find((r) => r.slug === slug);
    if (!recipe) {
        notFound();
    }

    return createPublicMetadata({
        title: recipe.title,
        description: recipe.description,
        path: KnownPages.Recipe(recipe.slug),
        category: 'Recept iz vrta',
    });
}

export async function generateStaticParams() {
    const recipes = await getRecipesData();
    return recipes.map((r) => ({ slug: r.slug }));
}

export default async function RecipePage(props: PageProps<'/recepti/[slug]'>) {
    const isRecipesEnabled = await recipesFlag();
    if (!isRecipesEnabled) {
        notFound();
    }

    const { slug } = await props.params;
    const recipe = (await getRecipesData()).find((r) => r.slug === slug);
    if (!recipe) {
        notFound();
    }
    return <RecipeView recipe={recipe} />;
}
