import type { Page } from '@playwright/test';
import { directoryOperationCoverRecipes } from '../generate/operation-cover-recipes';
import { expect, test } from './fixtures';

const publicQaEnabled = process.env.OPERATION_COVER_PUBLIC_QA === '1';
const publicListStageNames = new Set([
    'soilPreparation',
    'sowing',
    'planting',
    'growth',
    'maintenance',
    'watering',
    'flowering',
    'harvest',
    'storage',
]);
type DirectoryOperation = {
    attributes?: {
        stage?: {
            information?: {
                name?: string | null;
            } | null;
        } | null;
    } | null;
    information?: {
        label?: string | null;
        name?: string | null;
    } | null;
    slug?: string | null;
};
let operationsByName = new Map<string, DirectoryOperation>();

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodedSrc(src: string | null) {
    if (!src) return '';

    try {
        return decodeURIComponent(src);
    } catch {
        return src;
    }
}

async function expectPageHasGeneratedCoverImage(
    page: Page,
    outputFileName: string,
) {
    await expect
        .poll(async () => {
            const imageSources = await page
                .locator('img')
                .evaluateAll((images) =>
                    images.map(
                        (image) =>
                            (image as HTMLImageElement).currentSrc ||
                            (image as HTMLImageElement).src,
                    ),
                );
            return imageSources.some((src) =>
                decodedSrc(src).includes(
                    `/assets/operation-icons/${outputFileName}`,
                ),
            );
        })
        .toBe(true);
}

function operationForRecipe(
    recipe: (typeof directoryOperationCoverRecipes)[number],
) {
    const operation = operationsByName.get(recipe.operationId);
    if (!operation?.information?.label || !operation.slug) {
        throw new Error(
            `Missing public operation for recipe ${recipe.operationId}.`,
        );
    }
    return operation as DirectoryOperation & {
        information: { label: string; name?: string | null };
        slug: string;
    };
}

test.beforeAll(async ({ request }) => {
    const response = await request.get(
        `https://api.gredice.com/api/directories/entities/operation?operationCoverQa=${Date.now()}`,
    );
    expect(response.ok()).toBe(true);

    const operations = (await response.json()) as DirectoryOperation[];
    operationsByName = new Map(
        operations
            .filter((operation) => operation.information?.name)
            .map((operation) => [operation.information?.name ?? '', operation]),
    );
});

function recipesWithUniquePublicSlugs() {
    const recipesBySlug = new Map<
        string,
        (typeof directoryOperationCoverRecipes)[number][]
    >();

    for (const recipe of directoryOperationCoverRecipes) {
        const operation = operationForRecipe(recipe);
        const recipes = recipesBySlug.get(operation.slug) ?? [];
        recipes.push(recipe);
        recipesBySlug.set(operation.slug, recipes);
    }

    return Array.from(recipesBySlug.values())
        .filter((recipes) => recipes.length === 1)
        .map((recipes) => recipes[0]);
}

function recipesVisibleInPublicOperationList() {
    return directoryOperationCoverRecipes.filter((recipe) => {
        const operation = operationForRecipe(recipe);
        const stageName = operation.attributes?.stage?.information?.name;
        return stageName ? publicListStageNames.has(stageName) : false;
    });
}

test.describe('operation cover public surfaces', () => {
    test.skip(
        !publicQaEnabled,
        'Set OPERATION_COVER_PUBLIC_QA=1 after DB cover URL sync is approved/applied.',
    );

    test.setTimeout(180_000);

    test('operation list cards use generated covers', async ({ page }) => {
        for (const recipe of recipesVisibleInPublicOperationList()) {
            const operation = operationForRecipe(recipe);
            await page.goto(
                `/radnje?pretraga=${encodeURIComponent(operation.information.label)}`,
                { waitUntil: 'domcontentloaded' },
            );

            await expectPageHasGeneratedCoverImage(page, recipe.outputFileName);
        }
    });

    test('operation detail pages use generated covers', async ({ page }) => {
        for (const recipe of recipesWithUniquePublicSlugs()) {
            const operation = operationForRecipe(recipe);
            await page.goto(`/radnje/${operation.slug}`, {
                waitUntil: 'domcontentloaded',
            });

            await expect(
                page.getByRole('heading', {
                    name: operation.information.label,
                    exact: true,
                }),
            ).toBeVisible();
            await expectPageHasGeneratedCoverImage(page, recipe.outputFileName);
        }
    });

    test('search results use generated covers for representative operations', async ({
        page,
    }) => {
        const representativeRecipes = [
            directoryOperationCoverRecipes[0],
            directoryOperationCoverRecipes.find(
                (recipe) => recipe.operationId === 'rinsePestsFromPlant',
            ),
            directoryOperationCoverRecipes.find(
                (recipe) => recipe.operationId === 'formative-pruning',
            ),
            directoryOperationCoverRecipes.find(
                (recipe) => recipe.operationId === 'plantingPlantSupport',
            ),
            directoryOperationCoverRecipes.at(-1),
        ].filter(
            (
                recipe,
            ): recipe is (typeof directoryOperationCoverRecipes)[number] =>
                Boolean(recipe),
        );

        for (const recipe of representativeRecipes) {
            const operation = operationForRecipe(recipe);
            await page.goto(
                `/pretraga?pretraga=${encodeURIComponent(operation.information.label)}`,
                { waitUntil: 'domcontentloaded' },
            );

            const result = page
                .getByRole('link', {
                    name: new RegExp(escapeRegExp(operation.information.label)),
                })
                .first();

            await expect(result).toBeVisible();
            await expect(
                result.locator('[data-search-result-icon]'),
            ).toHaveCount(0);
            await expectPageHasGeneratedCoverImage(page, recipe.outputFileName);
        }
    });
});
