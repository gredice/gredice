import { Card } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
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
                        <Stack spacing={1}>
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
