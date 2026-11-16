import type { Locator, Page } from '@playwright/test';
import { directoryOperationCoverRecipes } from '../generate/operation-cover-recipes';
import { expect, test } from './fixtures';

const publicQaEnabled = process.env.OPERATION_COVER_PUBLIC_QA === '1';
const publicCoverBaseUrl = 'https://www.gredice.com/assets/operation-icons/';
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
    image?: {
        cover?: { url?: string | null } | null;
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

function originalImageUrl(source: string) {
    try {
        const url = new URL(source);
        return url.pathname === '/_next/image'
            ? url.searchParams.get('url')
            : url.href;
    } catch {
        return null;
    }
}

async function expectAssignedCoverImage(
    scope: Page | Locator,
    coverUrl: string,
) {
    await expect
        .poll(async () => {
            const imageSources = await scope
                .locator('img')
                .evaluateAll((images) =>
                    images
                        .filter((image) => image instanceof HTMLImageElement)
                        .map((image) => image.currentSrc || image.src),
                );
            return imageSources.map(originalImageUrl);
        })
        .toContain(coverUrl);
}

function operationForRecipe(
    recipe: (typeof directoryOperationCoverRecipes)[number],
) {
    const operation = operationsByName.get(recipe.operationId);
    const label = operation?.information?.label;
    const slug = operation?.slug;
    if (!operation || !label || !slug) {
        throw new Error(
            `Missing public operation for recipe ${recipe.operationId}.`,
        );
    }
    const coverUrl = operation.image?.cover?.url;
    const legacyUrl = `${publicCoverBaseUrl}${recipe.outputFileName}`;
    const illustratedUrl = `${publicCoverBaseUrl}illustrated/${recipe.operationId}.webp`;
    if (coverUrl !== legacyUrl && coverUrl !== illustratedUrl) {
        throw new Error(
            `Unexpected cover URL for ${recipe.operationId}: ${coverUrl ?? '(missing)'}.`,
        );
    }
    return {
        ...operation,
        information: { ...operation.information, label },
        slug,
        coverUrl,
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

            await expectAssignedCoverImage(page, operation.coverUrl);
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
            await expectAssignedCoverImage(page, operation.coverUrl);
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
            await expectAssignedCoverImage(result, operation.coverUrl);
        }
    });
});
