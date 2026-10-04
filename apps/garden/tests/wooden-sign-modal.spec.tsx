import { expect, test } from '@playwright/experimental-ct-react';
import type { Page, Route } from '@playwright/test';
import { WoodenSignModalStory } from './WoodenSignModalStory';

const woodenSignTestGardenId = 42;
const woodenSignTestBlockId = 'wooden-sign-1';
const woodenSignInitialMessage = 'DOBRO\nDOŠLI!!';
const woodenSignMaximumMessage = 'ABCDEFGHIJKL\nMNOPQRSTUVWX';

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

test('shows the inscription without a visible card header, counter, or disclaimer', async ({
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
    await expect(dialog.locator('h2:not(.sr-only)')).toHaveCount(0);
    await expect(dialog.locator('#wooden-sign-counter')).toHaveCount(0);
    await expect(dialog.locator('#wooden-sign-help')).toHaveCount(0);
    await expect(editor).not.toHaveAttribute('aria-describedby');

    const saveButton = dialog.getByRole('button', { name: 'Spremi natpis' });
    await expect(saveButton).toHaveClass(/bg-primary/u);
    await expect(saveButton).toHaveClass(/text-primary-foreground/u);
    await expect(saveButton).toHaveCSS('background-color', 'rgb(42, 28, 15)');
});

test('automatically wraps continuous typing onto the second row in order', async ({
    mount,
    page,
}) => {
    await mount(<WoodenSignModalStory />);

    const dialog = page.getByRole('dialog', {
        name: 'Uredi drveni natpis',
    });
    const editor = dialog.getByLabel('Tekst na drvenom natpisu');

    await editor.fill('');
    await editor.pressSequentially('ABCDEFGHIJKLMNOPQRSTUVWX');

    await expect(editor).toHaveValue('ABCDEFGHIJKL\nMNOPQRSTUVWX');
});

test('wraps pasted Unicode text and caps the message at two twelve-character rows', async ({
    mount,
    page,
}) => {
    await mount(<WoodenSignModalStory />);

    const dialog = page.getByRole('dialog', {
        name: 'Uredi drveni natpis',
    });
    const editor = dialog.getByLabel('Tekst na drvenom natpisu');

    await editor.fill(`12345678901👩‍🌾ABCDEFGHIJKLZ`);

    await expect(editor).toHaveValue(`12345678901👩‍🌾\nABCDEFGHIJKL`);
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
        responseMessage: woodenSignMaximumMessage,
        responseReady,
    });
    await mount(<WoodenSignModalStory />);

    const dialog = page.getByRole('dialog', {
        name: 'Uredi drveni natpis',
    });
    await dialog
        .getByLabel('Tekst na drvenom natpisu')
        .fill(woodenSignMaximumMessage);
    await dialog.getByRole('button', { name: 'Spremi natpis' }).click();

    await expect
        .poll(() => updatePayloads)
        .toEqual([{ message: woodenSignMaximumMessage }]);
    await expect(page.getByTestId('current-sign-message')).toHaveText(
        woodenSignMaximumMessage,
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
