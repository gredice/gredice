import { Card } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import type { Recipe } from '../../lib/recipes/getRecipesData';
import { KnownPages } from '../../src/KnownPages';

export function RecipeList({ recipes }: { recipes: Recipe[] }) {
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {recipes.map((recipe) => (
                <Link
                    key={recipe.id}
                    href={KnownPages.Recipe(recipe.slug)}
                    prefetch
                >
                    <Card className="p-4 hover:bg-slate-50">
                        <Stack spacing={2}>
                            <Typography level="h4" component="h3">
                                {recipe.title}
                            </Typography>
                            <Typography level="body2" secondary>
                                {recipe.description}
                            </Typography>
                        </Stack>
                    </Card>
                </Link>
            ))}
        </div>
    );
}
