import { expect, test } from '@playwright/experimental-ct-react';
import type { Page, Route } from '@playwright/test';
import { WoodenSignModalStory } from './WoodenSignModalStory';

const woodenSignTestGardenId = 42;
const woodenSignTestBlockId = 'wooden-sign-1';
const woodenSignInitialMessage = 'DOBRO\nDOŠLI!!';

const updatePath = `/api/gredice/api/gardens/${woodenSignTestGardenId.toString()}/blocks/${woodenSignTestBlockId}`;

function gardenApiResponse(message: string) {
    return {
        id: woodenSignTestGardenId,
        name: 'Vrt s natpisom',
        isSandbox: false,
        isPublic: false,
        backgroundPalette: 'default',
        farmId: null,
        homeCamera: null,
        latitude: 45.739,
        longitude: 16.572,
        previewImage: null,
        previewSourceRevision: null,
        raisedBeds: [],
        stacks: {
            0: {
                0: [
                    {
                        id: woodenSignTestBlockId,
                        message,
                        name: 'WoodenSign',
                        rotation: 0,
                    },
                ],
            },
        },
    };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
    await route.fulfill({
        body: JSON.stringify(body),
        contentType: 'application/json',
        status,
    });
}

async function mockWoodenSignRequests(
    page: Page,
    {
        responseBody = null,
        responseMessage = woodenSignInitialMessage,
        responseReady,
        responseStatus = 200,
    }: {
        responseBody?: unknown;
        responseMessage?: string;
        responseReady?: Promise<void>;
        responseStatus?: number;
    } = {},
) {
    const updatePayloads: unknown[] = [];

    await page.route('**/api/gredice/api/gardens/**', async (route) => {
        const request = route.request();
        const { pathname } = new URL(request.url());

        if (request.method() === 'PUT' && pathname === updatePath) {
            updatePayloads.push(request.postDataJSON());
            await responseReady;
            await fulfillJson(route, responseBody, responseStatus);
            return;
        }

        if (
            request.method() === 'GET' &&
            pathname ===
                `/api/gredice/api/gardens/${woodenSignTestGardenId.toString()}`
        ) {
            await fulfillJson(route, gardenApiResponse(responseMessage));
            return;
        }

        throw new Error(
            `Unexpected wooden sign request: ${request.method()} ${pathname}`,
        );
    });

    return updatePayloads;
}

test('shows the existing two-row inscription and its grapheme counter', async ({
    mount,
    page,
}) => {
    await mount(<WoodenSignModalStory />);

    const dialog = page.getByRole('dialog', {
        name: 'Uredi drveni natpis',
    });
    const editor = dialog.getByLabel('Tekst na drvenom natpisu');

    await expect(dialog).toBeVisible();
    await expect(editor).toHaveValue(woodenSignInitialMessage);
    await expect(dialog.getByText('12/12', { exact: true })).toBeVisible();
});

test('keeps one Unicode grapheme intact while rejecting the thirteenth character', async ({
    mount,
    page,
}) => {
    await mount(<WoodenSignModalStory />);

    const dialog = page.getByRole('dialog', {
        name: 'Uredi drveni natpis',
    });
    const editor = dialog.getByLabel('Tekst na drvenom natpisu');

    await editor.fill('12345678901👩‍🌾A');

    await expect(editor).toHaveValue('12345678901👩‍🌾');
    await expect(dialog.getByText('12/12', { exact: true })).toBeVisible();
});

test('optimistically updates the sign, sends the exact payload, and closes after success', async ({
    mount,
    page,
}) => {
    let releaseResponse: () => void = () => undefined;
    const responseReady = new Promise<void>((resolve) => {
        releaseResponse = resolve;
    });
    const updatePayloads = await mockWoodenSignRequests(page, {
        responseMessage: 'MOJ\nVRT',
        responseReady,
    });
    await mount(<WoodenSignModalStory />);

    const dialog = page.getByRole('dialog', {
        name: 'Uredi drveni natpis',
    });
    await dialog.getByLabel('Tekst na drvenom natpisu').fill('MOJ\nVRT');
    await dialog.getByRole('button', { name: 'Spremi natpis' }).click();

    await expect.poll(() => updatePayloads).toEqual([{ message: 'MOJ\nVRT' }]);
    await expect(page.getByTestId('current-sign-message')).toHaveText(
        'MOJ\nVRT',
    );

    releaseResponse();

    await expect(dialog).toHaveCount(0);
});

test('keeps the editor open and shows a Croatian error when saving fails', async ({
    mount,
    page,
}) => {
    const updatePayloads = await mockWoodenSignRequests(page, {
        responseBody: {},
        responseStatus: 500,
    });
    await mount(<WoodenSignModalStory />);

    const dialog = page.getByRole('dialog', {
        name: 'Uredi drveni natpis',
    });
    await dialog.getByLabel('Tekst na drvenom natpisu').fill('NEUSPJEH');
    await dialog.getByRole('button', { name: 'Spremi natpis' }).click();

    await expect.poll(() => updatePayloads).toEqual([{ message: 'NEUSPJEH' }]);
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByRole('alert').filter({
            hasText: 'Natpis se trenutno ne može spremiti. Pokušaj ponovno.',
        }),
    ).toBeVisible();
    await expect(page.getByTestId('current-sign-message')).toHaveText(
        woodenSignInitialMessage,
    );
});

test('cancel closes the editor without sending an update', async ({
    mount,
    page,
}) => {
    const updatePayloads = await mockWoodenSignRequests(page);
    await mount(<WoodenSignModalStory />);

    const dialog = page.getByRole('dialog', {
        name: 'Uredi drveni natpis',
    });
    await dialog.getByLabel('Tekst na drvenom natpisu').fill('NE SPREMAJ');
    await dialog.getByRole('button', { name: 'Odustani' }).click();

    await expect(dialog).toHaveCount(0);
    expect(updatePayloads).toEqual([]);
});

test('saving a blank inscription clears the persisted message', async ({
    mount,
    page,
}) => {
    const updatePayloads = await mockWoodenSignRequests(page, {
        responseMessage: '',
    });
    await mount(<WoodenSignModalStory />);

    const dialog = page.getByRole('dialog', {
        name: 'Uredi drveni natpis',
    });
    await dialog.getByLabel('Tekst na drvenom natpisu').fill('');
    await dialog.getByRole('button', { name: 'Spremi natpis' }).click();

    await expect.poll(() => updatePayloads).toEqual([{ message: null }]);
    await expect(dialog).toHaveCount(0);
});
