import type { Locator, Page } from '@playwright/test';
import { directoryOperationCoverRecipes } from '../generate/operation-cover-recipes';
import { KnownPages } from '../src/KnownPages';
import { expect, test } from './fixtures';

const publicQaEnabled = process.env.OPERATION_COVER_PUBLIC_QA === '1';

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

async function expectGeneratedCoverImage(
    image: Locator,
    outputFileName: string,
) {
    await expect(image).toBeVisible();
    await expect
        .poll(async () => decodedSrc(await image.getAttribute('src')))
        .toContain(`/assets/operation-icons/${outputFileName}`);
}

async function expectOperationCardCover({
    page,
    operationLabel,
    outputFileName,
}: {
    page: Page;
    operationLabel: string;
    outputFileName: string;
}) {
    const card = page
        .locator('a')
        .filter({
            hasText: new RegExp(escapeRegExp(operationLabel)),
        })
        .first();

    await expect(card).toBeVisible();
    await expectGeneratedCoverImage(
        card.getByRole('img', { name: operationLabel }).first(),
        outputFileName,
    );
}

test.describe('operation cover public surfaces', () => {
    test.skip(
        !publicQaEnabled,
        'Set OPERATION_COVER_PUBLIC_QA=1 after DB cover URL sync is approved/applied.',
    );

    test.setTimeout(180_000);

    test('operation list cards use generated covers', async ({ page }) => {
        for (const recipe of directoryOperationCoverRecipes) {
            await page.goto(
                `/radnje?pretraga=${encodeURIComponent(recipe.operationLabel)}`,
                { waitUntil: 'domcontentloaded' },
            );

            await expectOperationCardCover({
                page,
                operationLabel: recipe.operationLabel,
                outputFileName: recipe.outputFileName,
            });
        }
    });

    test('operation detail pages use generated covers', async ({ page }) => {
        for (const recipe of directoryOperationCoverRecipes) {
            await page.goto(KnownPages.Operation(recipe.operationLabel), {
                waitUntil: 'domcontentloaded',
            });

            await expect(
                page.getByRole('heading', {
                    name: recipe.operationLabel,
                    exact: true,
                }),
            ).toBeVisible();
            await expectGeneratedCoverImage(
                page.getByRole('img', { name: recipe.operationLabel }).first(),
                recipe.outputFileName,
            );
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
            await page.goto(
                `/pretraga?pretraga=${encodeURIComponent(recipe.operationLabel)}`,
                { waitUntil: 'domcontentloaded' },
            );

            const result = page
                .getByRole('link', {
                    name: new RegExp(escapeRegExp(recipe.operationLabel)),
                })
                .first();

            await expect(result).toBeVisible();
            await expect(
                result.locator('[data-search-result-icon]'),
            ).toHaveCount(0);
            await expectGeneratedCoverImage(
                result.locator('img').first(),
                recipe.outputFileName,
            );
        }
    });
});
