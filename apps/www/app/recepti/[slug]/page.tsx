import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRecipesData } from '../../../lib/recipes/getRecipesData';
import { RecipeView } from './RecipeView';

export async function generateMetadata(
    props: PageProps<'/recepti/[slug]'>,
): Promise<Metadata> {
    const { slug } = await props.params;
    const recipe = (await getRecipesData()).find((r) => r.slug === slug);
    return recipe
        ? { title: recipe.title, description: recipe.description }
        : { title: 'Recept nije pronađen', description: '' };
}

export async function generateStaticParams() {
    const recipes = await getRecipesData();
    return recipes.map((r) => ({ slug: r.slug }));
}

export default async function RecipePage(props: PageProps<'/recepti/[slug]'>) {
    const { slug } = await props.params;
    const recipe = (await getRecipesData()).find((r) => r.slug === slug);
    if (!recipe) {
        notFound();
    }
    return <RecipeView recipe={recipe} />;
}
