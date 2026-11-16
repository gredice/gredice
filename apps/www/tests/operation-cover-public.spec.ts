import type { Locator, Page } from '@playwright/test';
import { readOperationCoverIllustrations } from '../generate/read-operation-cover-illustrations';
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
const representativeSearchNames = [
    'decapitation',
    'rinsePestsFromPlant',
    'formative-pruning',
    'plantingPlantSupport',
    'harvestPlant',
];
type DirectoryOperation = {
    id: number;
    attributes?: {
        internal?: boolean | null;
        stage?: {
            information?: {
                name?: string | null;
            } | null;
        } | null;
    } | null;
    image?: {
        cover?: {
            url?: string | null;
        } | null;
    } | null;
    information?: {
        label?: string | null;
        name?: string | null;
    } | null;
    slug?: string | null;
};

type IllustratedOperation = {
    name: string;
    id: number;
    label: string;
    slug: string;
    coverUrl: string | null;
    imagePath: string;
    internal: boolean;
    visibleInList: boolean;
    uniqueSlug: boolean;
};

let illustratedOperations: IllustratedOperation[] = [];

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function expectIllustratedCover(
    scope: Page | Locator,
    imagePath: string,
) {
    const image = scope
        .locator(
            `img[src*="${imagePath}"], img[src*="${encodeURIComponent(imagePath)}"]`,
        )
        .first();
    await expect(image).toBeVisible();
    await image.scrollIntoViewIfNeeded();
    await expect
        .poll(() =>
            image.evaluate(
                (node) =>
                    node instanceof HTMLImageElement &&
                    node.complete &&
                    node.naturalWidth > 0,
            ),
        )
        .toBe(true);
}

test.describe('operation cover public surfaces', () => {
    test.skip(
        !publicQaEnabled,
        'Set OPERATION_COVER_PUBLIC_QA=1 after the illustration URLs have been assigned.',
    );

    test.setTimeout(360_000);

    test.beforeAll(async ({ request }) => {
        const [illustrations, response] = await Promise.all([
            readOperationCoverIllustrations(),
            request.get(
                `https://api.gredice.com/api/directories/entities/operation?operationCoverQa=${Date.now()}`,
            ),
        ]);
        expect(response.ok()).toBe(true);
        expect(illustrations.size).toBeGreaterThan(0);

        const operations: DirectoryOperation[] = await response.json();
        const operationsById = new Map(
            operations.map((operation) => [operation.id, operation]),
        );
        const slugCounts = new Map<string, number>();
        for (const { slug } of operations) {
            if (slug) {
                slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
            }
        }

        illustratedOperations = Array.from(
            illustrations,
            ([name, illustration]) => {
                const operation = operationsById.get(illustration.entityId);
                const label = operation?.information?.label;
                const slug = operation?.slug;
                if (!label || !slug || operation?.information?.name !== name) {
                    throw new Error(
                        `Missing public operation ${name} (${illustration.entityId}).`,
                    );
                }

                const stageName =
                    operation.attributes?.stage?.information?.name;
                const internal = operation.attributes?.internal === true;
                return {
                    name,
                    id: operation.id,
                    label,
                    slug,
                    coverUrl: operation.image?.cover?.url ?? null,
                    imagePath: `/assets/operation-icons/illustrated/${name}.webp`,
                    internal,
                    visibleInList:
                        internal ||
                        (stageName
                            ? publicListStageNames.has(stageName)
                            : false),
                    uniqueSlug: slugCounts.get(slug) === 1,
                };
            },
        );
    });

    test('directory API publishes each illustrated cover assignment', () => {
        for (const operation of illustratedOperations) {
            expect
                .soft(operation.coverUrl, `${operation.name} (${operation.id})`)
                .toBe(`https://www.gredice.com${operation.imagePath}`);
        }
    });

    test('operation list cards use illustrated covers', async ({ page }) => {
        for (const operation of illustratedOperations.filter(
            (entry) => entry.visibleInList,
        )) {
            await page.goto(
                `/radnje?pretraga=${encodeURIComponent(operation.label)}`,
                { waitUntil: 'domcontentloaded' },
            );

            if (operation.internal) {
                await page
                    .getByRole('button', { name: 'Za OPG partnere' })
                    .click();
            }
            await expectIllustratedCover(page, operation.imagePath);
        }
    });

    test('operation detail pages use illustrated covers', async ({ page }) => {
        for (const operation of illustratedOperations.filter(
            (entry) => entry.uniqueSlug,
        )) {
            await page.goto(`/radnje/${operation.slug}`, {
                waitUntil: 'domcontentloaded',
            });

            await expect(
                page.getByRole('heading', {
                    name: operation.label,
                    exact: true,
                }),
            ).toBeVisible();
            await expectIllustratedCover(page, operation.imagePath);
        }
    });

    test('search results use illustrated covers for representative operations', async ({
        page,
    }) => {
        const representativeOperations = illustratedOperations.filter(
            (operation) =>
                !operation.internal &&
                representativeSearchNames.includes(operation.name),
        );
        expect(representativeOperations.length).toBeGreaterThan(0);

        for (const operation of representativeOperations) {
            await page.goto(
                `/pretraga?pretraga=${encodeURIComponent(operation.label)}`,
                { waitUntil: 'domcontentloaded' },
            );

            const result = page
                .getByRole('link', {
                    name: new RegExp(escapeRegExp(operation.label)),
                })
                .first();

            await expect(result).toBeVisible();
            await expect(
                result.locator('[data-search-result-icon]'),
            ).toHaveCount(0);
            await expectIllustratedCover(result, operation.imagePath);
        }
    });
});
