import type { FavoriteEntityType, FavoriteItem } from '@gredice/client';
import {
    advancedSowingCartAuthorizationKind,
    buildAdvancedSowingCartConfigurationV1,
    buildAdvancedSowingSelectionSummaryV1,
} from '@gredice/js/plants';
import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import {
    calendarMonthOffset,
    formatTestCalendarDate,
    selectCalendarDate,
} from './calendarDatePickerTestUtils';
import {
    PlantPickerTestStory,
    type TestShoppingCartItem,
} from './PlantPickerTestStory';

const favoriteTimestamp = '2026-06-01T00:00:00.000Z';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function favoriteItem({
    entityId,
    entityType,
}: {
    entityId: number;
    entityType: FavoriteEntityType;
}): FavoriteItem {
    return {
        id: entityId,
        entityType,
        entityId,
        createdAt: favoriteTimestamp,
        updatedAt: favoriteTimestamp,
    };
}

function isFavoriteRequestBody(value: unknown): value is {
    entityType: FavoriteEntityType;
    entityId: number;
    favorited: boolean;
} {
    if (!isRecord(value)) {
        return false;
    }

    return (
        typeof value.entityType === 'string' &&
        ['plant', 'plantSort', 'operation'].includes(value.entityType) &&
        typeof value.entityId === 'number' &&
        typeof value.favorited === 'boolean'
    );
}

async function mockFavoriteRequests(
    page: Page,
    initialFavorites: FavoriteItem[],
) {
    let favorites = [...initialFavorites];

    await page.route('**/api/gredice/api/favorites**', async (route) => {
        const request = route.request();

        if (request.method() === 'PUT') {
            const body = request.postDataJSON();
            if (!isFavoriteRequestBody(body)) {
                throw new Error('Invalid favorite request body');
            }
            favorites = body.favorited
                ? [
                      favoriteItem({
                          entityType: body.entityType,
                          entityId: body.entityId,
                      }),
                      ...favorites.filter(
                          (favorite) =>
                              favorite.entityType !== body.entityType ||
                              favorite.entityId !== body.entityId,
                      ),
                  ]
                : favorites.filter(
                      (favorite) =>
                          favorite.entityType !== body.entityType ||
                          favorite.entityId !== body.entityId,
                  );

            await route.fulfill({
                body: JSON.stringify({
                    favorited: body.favorited,
                    favorite: body.favorited
                        ? favoriteItem({
                              entityType: body.entityType,
                              entityId: body.entityId,
                          })
                        : null,
                }),
                contentType: 'application/json',
                status: 200,
            });
            return;
        }

        await route.fulfill({
            body: JSON.stringify({ favorites }),
            contentType: 'application/json',
            status: 200,
        });
    });
}

async function mockShoppingCartPosts(page: Page) {
    const posts: unknown[] = [];

    await page.route('**/api/gredice/**/shopping-cart', async (route) => {
        if (route.request().method() === 'POST') {
            posts.push(route.request().postDataJSON());
            await route.fulfill({
                body: JSON.stringify({ success: true }),
                contentType: 'application/json',
                status: 200,
            });
            return;
        }

        await route.fulfill({
            body: JSON.stringify({
                allowPurchase: true,
                hasDeliverableItems: false,
                id: 1,
                items: [],
                notes: [],
                total: 0,
                totalSunflowers: 0,
            }),
            contentType: 'application/json',
            status: 200,
        });
    });

    return posts;
}

function advancedSowingCartItem(
    id: number,
    selectedDistanceCm: number,
): TestShoppingCartItem {
    const plan = buildAdvancedSowingCartConfigurationV1({
        anchorPositionIndex: 17,
        bedFieldCount: 18,
        maxDistanceCm: 60,
        minDistanceCm: 10,
        optimalDistanceCm: 30,
        selectedDistanceCm,
    });

    return {
        additionalData: JSON.stringify({
            scheduledDate: '2026-05-14T00:00:00.000Z',
        }),
        advancedSowingSelection: buildAdvancedSowingSelectionSummaryV1({
            kind: advancedSowingCartAuthorizationKind,
            plan,
            version: 1,
        }),
        amount: 1,
        currency: 'eur',
        entityId: '101',
        entityTypeName: 'plantSort',
        gardenId: 1,
        id,
        positionIndex: 17,
        raisedBedId: 1,
        shopData: {
            discountPrice: null,
            price: 1.5,
        },
        status: 'new',
    };
}

function activeSelectedPlanting(selectedDistanceCm: number) {
    const selectedPlan = buildAdvancedSowingCartConfigurationV1({
        anchorPositionIndex: 17,
        bedFieldCount: 18,
        maxDistanceCm: 60,
        minDistanceCm: 10,
        optimalDistanceCm: 30,
        selectedDistanceCm,
    });

    return {
        configurationSource: 'selected',
        isActive: true,
        layoutKey: selectedPlan.layoutKey,
        memberships: selectedPlan.occupiedPositionIndices.map(
            (positionIndex) => ({ positionIndex }),
        ),
    };
}

async function selectAdvancedSowingSort(page: Page) {
    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();
}

test('favorite plants and sorts are ranked first', async ({ mount, page }) => {
    const favorites = [
        favoriteItem({ entityType: 'plant', entityId: 2 }),
        favoriteItem({ entityType: 'plantSort', entityId: 105 }),
    ];
    await mockFavoriteRequests(page, favorites);

    await mount(<PlantPickerTestStory favorites={favorites} />);

    await page.getByRole('button', { name: 'Sijanje' }).click();

    const plantRows = page.locator('[data-plant-picker-plant-id]');
    await expect(plantRows.first()).toContainText('Bosiljak');

    const basilRow = page.locator('[data-plant-picker-plant-id="2"]');
    await expect(
        basilRow.getByRole('button', {
            name: 'Ukloni biljku iz omiljenih',
        }),
    ).toBeVisible();

    await page
        .locator('[data-plant-picker-plant-id="1"]')
        .getByRole('button')
        .first()
        .click();

    const sortRows = page.locator('[data-plant-picker-sort-id]');
    await expect(sortRows.first()).toContainText('Rajčica San Marzano');
    await expect(
        page.locator('[data-plant-picker-sort-id="105"]').getByRole('button', {
            name: 'Ukloni sortu iz omiljenih',
        }),
    ).toBeVisible();
});

test('plant search keeps keyboard focus while filtering sowing options', async ({
    mount,
    page,
}) => {
    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();

    const searchInput = page.getByPlaceholder('Pretraži...');
    await searchInput.click();
    await searchInput.pressSequentially('raj');

    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue('raj');
    await expect(page.getByRole('button', { name: /Rajčica/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bosiljak/ })).toHaveCount(0);
    await expect(page).not.toHaveURL(/pretraga=/u);

    await searchInput.fill('');
    await searchInput.pressSequentially('paradajz');

    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue('paradajz');
    await expect(page.getByRole('button', { name: /Rajčica/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bosiljak/ })).toHaveCount(0);
});

test('plant list shows outlet availability before sort selection', async ({
    mount,
    page,
}) => {
    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();

    const tomatoRow = page.locator('[data-plant-picker-plant-id="1"]');
    const basilRow = page.locator('[data-plant-picker-plant-id="2"]');

    await expect(tomatoRow).toContainText('Outlet 2 ponude');
    await expect(tomatoRow.locator('[data-outlet-badge] svg')).toHaveCount(1);
    await expect(basilRow).not.toContainText('Outlet');
});

test('outlet sorts keep planned sowing selected by default', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const sowingMode = page.getByRole('radiogroup', {
        name: 'Način sijanja',
    });
    await expect(
        sowingMode.getByRole('radio', { name: /Planirano sijanje/ }),
    ).toBeChecked();
    await expect(sowingMode.getByText('Outlet sadnica')).toHaveCount(2);
    await expect(sowingMode.locator('svg').first()).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Datum sijanja/u }),
    ).toBeVisible();
    await expect(
        page.getByRole('switch', { name: 'Sijanje u stakleniku' }),
    ).toHaveAttribute('aria-checked', 'false');

    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();

    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post)) {
        return;
    }
    expect(post.outletOfferId).toBeUndefined();
    expect(post.entityId).toBe('101');
});

test('selected footprint can submit a compatible Advanced Sowing co-plant', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            advancedSowingRange={{ maxDistanceCm: 60, minDistanceCm: 10 }}
            plantings={[activeSelectedPlanting(15)]}
            positionIndex={17}
        />,
    );
    await selectAdvancedSowingSort(page);

    const preview = page.locator('[data-advanced-sowing-preview]');
    await expect(
        preview.getByRole('radio', { name: /4 biljke.*15 cm/u }),
    ).toBeDisabled();
    await expect(
        preview.getByRole('radio', { name: /30 cm.*preporučeno/u }),
    ).toBeChecked();
    const addToCart = page.getByRole('button', { name: 'Dodaj u košaru' });
    await expect(addToCart).toBeEnabled();
    await addToCart.click();
    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (isRecord(post)) {
        expect(post.advancedSowingSelection).toEqual({
            kind: 'advanced-sowing-selection',
            selectedDistanceCm: 30,
            version: 1,
        });
        expect(post.forceCreate).toBe(true);
    }
});

test('legacy field permits only a different-density co-plant', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            advancedSowingRange={{ maxDistanceCm: 60, minDistanceCm: 10 }}
            plantings={[
                {
                    configurationSource: 'legacy',
                    id: 71,
                    isActive: true,
                    layoutKey: null,
                    memberships: [{ positionIndex: 17 }],
                    plantSortId: 101,
                },
            ]}
            positionIndex={17}
        />,
    );
    await selectAdvancedSowingSort(page);

    const preview = page.locator('[data-advanced-sowing-preview]');
    await expect(
        preview.getByRole('radio', { name: /30 cm.*preporučeno/u }),
    ).toBeDisabled();
    const selectedDifferentDensity = preview.getByRole('radio', {
        name: /4 biljke.*15 cm/u,
    });
    await selectedDifferentDensity.check();
    await expect(selectedDifferentDensity).toBeEnabled();
    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();
    await expect.poll(() => posts.length).toBe(1);
});

test('selected footprint blocks an unsupported legacy fallback', async ({
    mount,
    page,
}) => {
    await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            plantings={[activeSelectedPlanting(15)]}
            positionIndex={17}
        />,
    );
    await selectAdvancedSowingSort(page);
    await expect(
        page.getByRole('button', { name: 'Dodaj u košaru' }),
    ).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText(
        'Obična sjetva ovdje nije dostupna',
    );
});

test('selected footprint blocks an outlet legacy fallback', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            advancedSowingRange={{ maxDistanceCm: 60, minDistanceCm: 10 }}
            plantings={[activeSelectedPlanting(15)]}
            positionIndex={17}
        />,
    );
    await selectAdvancedSowingSort(page);
    const sowingMode = page.getByRole('radiogroup', {
        name: 'Način sijanja',
    });
    await sowingMode.getByText('Preostalo 3').click();
    await expect(
        page.getByRole('button', { name: 'Dodaj u košaru' }),
    ).toBeDisabled();
    expect(posts).toHaveLength(0);
});

test('Advanced Sowing submits a one-field density through the top-level selection contract', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            advancedSowingRange={{
                maxDistanceCm: 60,
                minDistanceCm: 10,
            }}
            positionIndex={17}
        />,
    );

    await selectAdvancedSowingSort(page);

    const preview = page.locator('[data-advanced-sowing-preview]');
    await expect(preview).toBeVisible();
    await expect(
        preview.getByRole('radio', { name: /30 cm.*preporučeno/u }),
    ).toBeChecked();
    await expect(
        preview.getByRole('radio', { name: /9 biljaka.*10 cm/u }),
    ).toBeVisible();
    await expect(
        preview.locator('[data-advanced-sowing-density-icon]'),
    ).toHaveCount(4);

    await preview.getByRole('radio', { name: /4 biljke.*15 cm/u }).click();
    await expect(
        preview.locator('[data-advanced-sowing-footprint]'),
    ).toHaveCount(0);

    await expect(
        page.getByText(
            'Odabrani razmak i raspored spremit će se uz ovu sjetvu.',
        ),
    ).toBeVisible();

    const addToCart = page.getByRole('button', { name: 'Dodaj u košaru' });
    await expect(addToCart).toBeEnabled();
    await addToCart.click();
    await expect.poll(() => posts.length).toBe(1);

    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post)) {
        return;
    }
    expect(post.advancedSowingSelection).toEqual({
        kind: 'advanced-sowing-selection',
        selectedDistanceCm: 15,
        version: 1,
    });
    expect(post.forceCreate).toBe(true);
    expect(post.id).toBeUndefined();
    expect(typeof post.additionalData).toBe('string');
    if (typeof post.additionalData === 'string') {
        const additionalData: unknown = JSON.parse(post.additionalData);
        expect(isRecord(additionalData)).toBe(true);
        if (isRecord(additionalData)) {
            expect(additionalData.advancedSowing).toBeUndefined();
            expect(additionalData.advancedSowingAuthorization).toBeUndefined();
        }
    }
});

test('Advanced Sowing submits one 2 by 2 footprint from its anchor field', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            advancedSowingRange={{ maxDistanceCm: 60, minDistanceCm: 10 }}
            fieldPositionIndices={[17]}
            positionIndex={17}
        />,
    );
    await selectAdvancedSowingSort(page);

    const preview = page.locator('[data-advanced-sowing-preview]');
    await preview.getByRole('radio', { name: /60 cm.*2 × 2 polja/u }).click();
    await expect(preview.locator('[data-occupied="true"]')).toHaveCount(4);
    await expect(preview.getByText(/zauzima 2 × 2 polja/u)).toBeVisible();
    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();
    await expect.poll(() => posts.length).toBe(1);

    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (isRecord(post)) {
        expect(post.advancedSowingSelection).toEqual({
            kind: 'advanced-sowing-selection',
            selectedDistanceCm: 60,
            version: 1,
        });
        expect(post.forceCreate).toBe(true);
    }
});

test('Advanced Sowing creates a different-density co-plant without replacing the existing row', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            advancedSowingRange={{ maxDistanceCm: 60, minDistanceCm: 10 }}
            cartItems={[advancedSowingCartItem(41, 15)]}
            positionIndex={17}
        />,
    );
    await selectAdvancedSowingSort(page);

    const preview = page.locator('[data-advanced-sowing-preview]');
    await expect(
        preview.getByRole('radio', { name: /30 cm.*preporučeno/u }),
    ).toBeChecked();
    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();
    await expect.poll(() => posts.length).toBe(1);

    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (isRecord(post)) {
        expect(post.id).toBeUndefined();
        expect(post.forceCreate).toBe(true);
        expect(post.amount).toBe(1);
        expect(post.advancedSowingSelection).toEqual({
            kind: 'advanced-sowing-selection',
            selectedDistanceCm: 30,
            version: 1,
        });
    }
});

test('Advanced Sowing updates only the explicitly selected summarized cart row', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);
    const selectedItem = advancedSowingCartItem(42, 30);

    await mount(
        <PlantPickerTestStory
            advancedSowingRange={{ maxDistanceCm: 60, minDistanceCm: 10 }}
            cartItems={[advancedSowingCartItem(41, 15), selectedItem]}
            inShoppingCart
            positionIndex={17}
            preselectedPlantId={1}
            preselectedSortId={101}
            selectedCartItemId={42}
        />,
    );
    await page.getByRole('button', { name: 'Sijanje' }).click();

    const preview = page.locator('[data-advanced-sowing-preview]');
    await expect(
        preview.getByRole('radio', { name: /30 cm.*preporučeno/u }),
    ).toBeChecked();
    await preview.getByRole('radio', { name: /60 cm.*2 × 2 polja/u }).click();
    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();
    await expect.poll(() => posts.length).toBe(1);

    const updatePost = posts[0];
    expect(isRecord(updatePost)).toBe(true);
    if (isRecord(updatePost)) {
        expect(updatePost.id).toBe(42);
        expect(updatePost.forceCreate).toBe(false);
        expect(updatePost.advancedSowingSelection).toEqual({
            kind: 'advanced-sowing-selection',
            selectedDistanceCm: 60,
            version: 1,
        });
    }
});

test('Advanced Sowing removal targets the exact summarized co-plant row', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            advancedSowingRange={{ maxDistanceCm: 60, minDistanceCm: 10 }}
            cartItems={[
                advancedSowingCartItem(41, 15),
                advancedSowingCartItem(42, 30),
            ]}
            inShoppingCart
            positionIndex={17}
            preselectedPlantId={1}
            preselectedSortId={101}
            selectedCartItemId={42}
        />,
    );
    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: 'Ukloni' }).click();
    await expect.poll(() => posts.length).toBe(1);

    const removePost = posts[0];
    expect(isRecord(removePost)).toBe(true);
    if (isRecord(removePost)) {
        expect(removePost.id).toBe(42);
        expect(removePost.amount).toBe(0);
        expect(removePost.advancedSowingSelection).toBeUndefined();
    }
});

test('Advanced Sowing disables every footprint that overlaps an active legacy planting', async ({
    mount,
    page,
}) => {
    await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            advancedSowingRange={{ maxDistanceCm: 60, minDistanceCm: 10 }}
            plantings={[
                {
                    configurationSource: 'legacy',
                    isActive: true,
                    layoutKey: null,
                    memberships: [{ positionIndex: 17 }],
                },
            ]}
            positionIndex={17}
        />,
    );
    await selectAdvancedSowingSort(page);

    const preview = page.locator('[data-advanced-sowing-preview]');
    await expect(preview.getByRole('radio')).toHaveCount(4);
    for (const radio of await preview.getByRole('radio').all()) {
        await expect(radio).toBeDisabled();
    }
    await expect(
        page.getByRole('button', { name: 'Dodaj u košaru' }),
    ).toBeDisabled();
});

test('planned greenhouse sowing sends greenhouse location', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const greenhouseSwitch = page.getByRole('switch', {
        name: 'Sijanje u stakleniku',
    });
    await expect(greenhouseSwitch).toHaveAttribute('aria-checked', 'false');
    await greenhouseSwitch.click();
    await expect(greenhouseSwitch).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();

    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post)) {
        return;
    }
    expect(typeof post.additionalData).toBe('string');
    if (typeof post.additionalData !== 'string') {
        return;
    }
    const additionalData: unknown = JSON.parse(post.additionalData);
    expect(isRecord(additionalData)).toBe(true);
    if (!isRecord(additionalData)) {
        return;
    }
    expect(additionalData.sowingLocation).toBe('greenhouse');
});

test('planting calendar selects greenhouse sowing by default', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const calendarMonth = tomorrow.getMonth() + 1;

    await mount(
        <PlantPickerTestStory
            propagatingRanges={[{ start: calendarMonth, end: calendarMonth }]}
        />,
    );

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const greenhouseSwitch = page.getByRole('switch', { name: 'Staklenik' });
    await expect(greenhouseSwitch).toBeChecked();

    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();

    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post) || typeof post.additionalData !== 'string') {
        return;
    }
    const additionalData: unknown = JSON.parse(post.additionalData);
    expect(isRecord(additionalData)).toBe(true);
    if (!isRecord(additionalData)) {
        return;
    }
    expect(additionalData.sowingLocation).toBe('greenhouse');
});

test.describe('planting calendar date timezone', () => {
    test.use({ timezoneId: 'America/Los_Angeles' });

    test('matches a selected calendar boundary using the browser local date', async ({
        mount,
        page,
    }) => {
        await mockShoppingCartPosts(page);
        const { calendarMonth, monthOffset, selectedDateKey } =
            await page.evaluate(() => {
                const initialDate = new Date();
                initialDate.setDate(initialDate.getDate() + 1);
                const selectedDate = new Date(
                    initialDate.getFullYear(),
                    initialDate.getMonth() + 1,
                    1,
                    12,
                );
                const formatDateKey = (date: Date) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                return {
                    calendarMonth: selectedDate.getMonth() + 1,
                    monthOffset:
                        (selectedDate.getFullYear() -
                            initialDate.getFullYear()) *
                            12 +
                        selectedDate.getMonth() -
                        initialDate.getMonth(),
                    selectedDateKey: formatDateKey(selectedDate),
                };
            });

        await mount(
            <PlantPickerTestStory
                propagatingRanges={[
                    { start: calendarMonth, end: calendarMonth },
                ]}
            />,
        );

        await page.getByRole('button', { name: 'Sijanje' }).click();
        await page.getByRole('button', { name: /Rajčica/ }).click();
        await page.getByRole('button', { name: /Cherry rajčica/ }).click();
        const dateInput = page.getByRole('button', { name: /Datum sijanja/u });

        await selectCalendarDate({
            date: selectedDateKey,
            monthOffset,
            page,
            trigger: dateInput,
        });

        await expect(
            page.getByRole('switch', { name: 'Staklenik' }),
        ).toBeChecked();
    });
});

test('outlet sowing bypasses Advanced Sowing and sends the selected offer', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            advancedSowingRange={{ maxDistanceCm: 60, minDistanceCm: 10 }}
        />,
    );

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const advancedSowingPreview = page.locator(
        '[data-advanced-sowing-preview]',
    );
    await expect(advancedSowingPreview).toBeVisible();

    const sowingMode = page.getByRole('radiogroup', {
        name: 'Način sijanja',
    });
    const laterOutletOffer = sowingMode.getByRole('radio', {
        name: /Preostalo 3/,
    });
    await sowingMode.getByText('Preostalo 3').click();
    await expect(laterOutletOffer).toBeChecked();
    await expect(advancedSowingPreview).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: /Datum sijanja/u }),
    ).toHaveCount(0);

    const addToCart = page.getByRole('button', { name: 'Dodaj u košaru' });
    await expect(addToCart).toBeEnabled();
    await addToCart.click();

    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post)) {
        return;
    }
    expect(post.outletOfferId).toBe(302);
    expect(post.additionalData).toBe(JSON.stringify({ outletOfferId: 302 }));
    expect(post.advancedSowingSelection).toBeUndefined();
    expect(post.forceCreate).toBeUndefined();
});

test('outlet sowing stays blocked by another pending Advanced Sowing footprint', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            advancedSowingRange={{ maxDistanceCm: 60, minDistanceCm: 10 }}
            cartItems={[advancedSowingCartItem(41, 15)]}
            positionIndex={17}
        />,
    );
    await selectAdvancedSowingSort(page);

    const sowingMode = page.getByRole('radiogroup', {
        name: 'Način sijanja',
    });
    await sowingMode.getByText('Preostalo 3').click();

    await expect(
        page.getByText(/postojećoj ili planiranoj naprednoj sjetvi/u),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Dodaj u košaru' }),
    ).toBeDisabled();
    expect(posts).toHaveLength(0);
});

test('outlet sowing converts an existing inventory row to euros', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);
    const inventoryCartItem = {
        additionalData: JSON.stringify({
            scheduledDate: '2026-05-14T00:00:00.000Z',
        }),
        amount: 1,
        currency: 'inventory',
        entityId: '101',
        entityTypeName: 'plantSort',
        gardenId: 1,
        id: 41,
        positionIndex: 0,
        raisedBedId: 1,
        shopData: {
            discountPrice: null,
            price: 1.5,
        },
        status: 'new',
    } satisfies TestShoppingCartItem;

    await mount(
        <PlantPickerTestStory
            cartItems={[inventoryCartItem]}
            inShoppingCart
            preselectedPlantId={1}
            preselectedSortId={101}
            selectedCartItemId={inventoryCartItem.id}
        />,
    );

    await page.getByRole('button', { name: 'Sijanje' }).click();
    const sowingMode = page.getByRole('radiogroup', {
        name: 'Način sijanja',
    });
    await sowingMode.getByText('Preostalo 3').click();
    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();

    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post)) {
        return;
    }
    expect(post.id).toBe(41);
    expect(post.currency).toBe('eur');
    expect(post.outletOfferId).toBe(302);
    expect(post.additionalData).toBe(JSON.stringify({ outletOfferId: 302 }));
});

test('outlet selection param opens the selected outlet offer', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(<PlantPickerTestStory searchParams="outlet-ponuda=302" />);

    await page.getByRole('button', { name: 'Sijanje' }).click();

    await expect(page.getByText('Odabir sorte').last()).toBeVisible();
    const sowingMode = page.getByRole('radiogroup', {
        name: 'Način sijanja',
    });
    const laterOutletOffer = sowingMode.getByRole('radio', {
        name: /Preostalo 3/,
    });
    await expect(laterOutletOffer).toBeChecked();
    await expect(
        page.getByRole('button', { name: /Datum sijanja/u }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();

    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post)) {
        return;
    }
    expect(post.outletOfferId).toBe(302);
    expect(post.additionalData).toBe(JSON.stringify({ outletOfferId: 302 }));
});

test('owned inventory sorts remain available when the store offer is withdrawn', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            inventoryItems={[
                {
                    entityId: '101',
                    entityTypeName: 'plantSort',
                    amount: 2,
                },
            ]}
            unavailableSortIds={[101, 103]}
        />,
    );

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();

    const cherrySort = page.locator('[data-plant-picker-sort-id="101"]');
    const saintPierreSort = page.locator('[data-plant-picker-sort-id="102"]');
    const unavailableSortWithoutInventory = page.locator(
        '[data-plant-picker-sort-id="103"]',
    );
    const backpackButton = cherrySort.getByRole('button', {
        name: 'Koristi iz ruksaka (2)',
    });
    await expect(backpackButton).toBeVisible();
    await expect(unavailableSortWithoutInventory).toHaveCount(0);
    await expect(
        saintPierreSort.getByRole('button', { name: /ruksaka/ }),
    ).toHaveCount(0);
    await expect(page.getByText(/^U ruksaku/u)).toHaveCount(0);

    await page.getByRole('button', { name: /Cherry rajčica/ }).click();
    await expect(
        cherrySort.getByRole('button', { name: 'Ne koristi iz ruksaka' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await cherrySort
        .getByRole('button', { name: 'Ne koristi iz ruksaka' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Dodaj u košaru' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Dodaj u košaru' }),
    ).toHaveAttribute('title', 'Odabrana sorta dostupna je samo iz ruksaka');

    await page.getByRole('button', { name: /Cherry rajčica/ }).click();
    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();

    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post)) {
        return;
    }
    expect(post.entityId).toBe('101');
    expect(post.currency).toBe('inventory');
});

test('a sole inventory-only sort is auto-selected with inventory payment', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(
        <PlantPickerTestStory
            inventoryItems={[
                {
                    entityId: '101',
                    entityTypeName: 'plantSort',
                    amount: 1,
                },
            ]}
            unavailableSortIds={[101, 102, 103, 104, 105]}
        />,
    );

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await expect(
        page.getByRole('button', { name: 'Ne koristi iz ruksaka' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();

    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post)) {
        return;
    }
    expect(post.entityId).toBe('101');
    expect(post.currency).toBe('inventory');
});

test('scheduled greenhouse sowing sends date and sowing location together', async ({
    mount,
    page,
}) => {
    const posts = await mockShoppingCartPosts(page);

    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const dateInput = page.getByRole('button', { name: /Datum sijanja/u });
    const greenhouseSwitch = page.getByRole('switch', {
        name: 'Sijanje u stakleniku',
    });
    await expect(dateInput).toBeVisible();
    await expect(greenhouseSwitch).toBeVisible();

    const dateBox = await dateInput.boundingBox();
    const switchBox = await greenhouseSwitch.boundingBox();
    expect(dateBox).not.toBeNull();
    expect(switchBox).not.toBeNull();
    expect(Math.abs((dateBox?.y ?? 0) - (switchBox?.y ?? 0))).toBeLessThan(48);

    const initialDate = new Date();
    initialDate.setDate(initialDate.getDate() + 1);
    const selectedDate = new Date();
    selectedDate.setDate(selectedDate.getDate() + 14);
    const selectedDateKey = formatTestCalendarDate(selectedDate);
    await selectCalendarDate({
        date: selectedDateKey,
        monthOffset: calendarMonthOffset(initialDate, selectedDate),
        page,
        trigger: dateInput,
    });
    await greenhouseSwitch.click();
    await expect(greenhouseSwitch).toBeChecked();
    await page.getByRole('button', { name: 'Dodaj u košaru' }).click();

    await expect.poll(() => posts.length).toBe(1);
    const post = posts[0];
    expect(isRecord(post)).toBe(true);
    if (!isRecord(post)) {
        return;
    }
    expect(typeof post.additionalData).toBe('string');
    if (typeof post.additionalData !== 'string') {
        return;
    }

    const additionalData: unknown = JSON.parse(post.additionalData);
    expect(isRecord(additionalData)).toBe(true);
    if (!isRecord(additionalData)) {
        return;
    }
    expect(additionalData.sowingLocation).toBe('greenhouse');
    expect(additionalData.scheduledDate).toBe(
        `${selectedDateKey}T00:00:00.000Z`,
    );
});

test('outlet refetch does not replace a missing selected offer', async ({
    mount,
    page,
}) => {
    await mockShoppingCartPosts(page);

    await mount(<PlantPickerTestStory showOutletRefetchControl />);

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const sowingMode = page.getByRole('radiogroup', {
        name: 'Način sijanja',
    });
    const laterOutletOffer = sowingMode.getByRole('radio', {
        name: /Preostalo 3/,
    });
    await sowingMode.getByText('Preostalo 3').click();
    await expect(laterOutletOffer).toBeChecked();

    await page.evaluate(() => window.__grediceRemoveOutlet302?.());

    await expect(
        page.getByText('Odabrana outlet sadnica više nije dostupna.'),
    ).toBeVisible();
    await expect(
        sowingMode.getByRole('radio', { name: /Preostalo 2/ }),
    ).not.toBeChecked();
    await expect(
        page.getByRole('button', { name: /Datum sijanja/u }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Dodaj u košaru' }),
    ).toBeDisabled();
});

test('mobile sort step keeps the cart action reachable', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const cartAction = page.getByRole('button', { name: 'Dodaj u košaru' });
    await expect(cartAction).toBeVisible();
    await expect(cartAction).toBeInViewport();

    const actions = page.locator('[data-plant-picker-actions]');
    const backAction = actions.getByRole('button', { name: 'Odabir biljke' });
    const actionsBox = await actions.boundingBox();
    const backActionBox = await backAction.boundingBox();
    const cartActionBox = await cartAction.boundingBox();
    expect(actionsBox).not.toBeNull();
    expect(backActionBox).not.toBeNull();
    expect(cartActionBox).not.toBeNull();
    expect(
        Math.abs(
            (backActionBox?.y ?? 0) +
                (backActionBox?.height ?? 0) / 2 -
                ((cartActionBox?.y ?? 0) + (cartActionBox?.height ?? 0) / 2),
        ),
    ).toBeLessThan(12);
    expect(backActionBox?.x ?? 0).toBeLessThan(cartActionBox?.x ?? 0);

    const actionBottom = Math.max(
        (backActionBox?.y ?? 0) + (backActionBox?.height ?? 0),
        (cartActionBox?.y ?? 0) + (cartActionBox?.height ?? 0),
    );
    expect(
        (actionsBox?.y ?? 0) + (actionsBox?.height ?? 0) - actionBottom,
    ).toBeLessThanOrEqual(24);
});

test('mobile sort step scrolls the sowing date clear of sticky actions', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await mount(<PlantPickerTestStory />);

    await page.getByRole('button', { name: 'Sijanje' }).click();
    await page.getByRole('button', { name: /Rajčica/ }).click();
    await page.getByRole('button', { name: /Cherry rajčica/ }).click();

    const dateInput = page.getByRole('button', { name: /Datum sijanja/u });
    await dateInput.evaluate((element) => {
        let scrollParent = element.parentElement;
        while (scrollParent) {
            const style = window.getComputedStyle(scrollParent);
            if (
                /(auto|scroll)/u.test(style.overflowY) &&
                scrollParent.scrollHeight > scrollParent.clientHeight
            ) {
                scrollParent.scrollTop = scrollParent.scrollHeight;
                return;
            }
            scrollParent = scrollParent.parentElement;
        }
    });

    const actions = page.locator('[data-plant-picker-actions]');
    const dateBox = await dateInput.boundingBox();
    const actionsBox = await actions.boundingBox();
    expect(dateBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect((dateBox?.y ?? 0) + (dateBox?.height ?? 0)).toBeLessThanOrEqual(
        (actionsBox?.y ?? 0) - 12,
    );
});
