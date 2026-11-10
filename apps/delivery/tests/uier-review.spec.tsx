import { expect, test } from '@playwright/experimental-ct-react';
import { UierReviewStory } from './UierReviewStory';

test('normal visits do not contact UIer or include its script', async ({
    mount,
    page,
}) => {
    const requests: string[] = [];
    page.on('request', (request) => {
        if (request.url().startsWith('https://uier.io/'))
            requests.push(request.url());
    });
    await mount(<UierReviewStory />);
    await expect(
        page.getByRole('switch', { name: 'Povratne informacije' }),
    ).toBeEnabled();
    await expect(page.getByRole('switch')).not.toBeChecked();
    await expect(page.locator('script[data-uier-project]')).toHaveCount(0);
    expect(requests).toEqual([]);
});

test('explicit opt-in loads the correct project and opting out reloads cleanly', async ({
    mount,
    page,
}) => {
    await page.route('https://uier.io/toolbar.js', (route) =>
        route.fulfill({
            contentType: 'application/javascript',
            body: 'window.grediceTestReviewLoaded = document.currentScript.dataset.uierProject;',
        }),
    );
    await page.evaluate(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('review', 'true');
        window.history.replaceState(null, '', url);
    });
    await mount(<UierReviewStory />);
    const script = page.locator('script[data-uier-project]');
    await expect(script).toHaveAttribute(
        'data-uier-project',
        'agd12e7hIWwSmiaIwdMXd',
    );
    await expect(page.getByRole('switch')).toBeChecked();
    await page.getByRole('switch').click();
    await page.waitForURL(/review=false/);
    expect(
        await page.evaluate(() => sessionStorage.getItem('gredice:uier:www')),
    ).toBe('0');
    await expect(page.locator('script[data-uier-project]')).toHaveCount(0);
});

test('an existing WWW session does not activate News on the same origin', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        sessionStorage.setItem('gredice:uier:www', '1');
        sessionStorage.setItem('gredice:uier:owner', 'www');
        sessionStorage.setItem(
            'uier:review',
            JSON.stringify({ projectCode: 'agd12e7hIWwSmiaIwdMXd' }),
        );
    });
    await mount(<UierReviewStory project="news" />);
    await expect(page.getByRole('switch')).toBeEnabled();
    await expect(page.getByRole('switch')).not.toBeChecked();
    await expect(page.locator('script[data-uier-project]')).toHaveCount(0);
});

test('auth expiry replaces a delivery page that loaded the review toolbar', async ({
    mount,
    page,
}) => {
    await page.route('https://uier.io/toolbar.js', (route) =>
        route.fulfill({ contentType: 'application/javascript', body: '' }),
    );
    await page.evaluate(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('review', 'true');
        window.history.replaceState(null, '', url);
    });
    const component = await mount(<UierReviewStory project="delivery" />);
    await expect(page.locator('script[data-uier-project]')).toHaveCount(1);
    await component.update(<UierReviewStory project="delivery" signedOut />);
    await page.waitForURL(/review=false/);
    expect(
        await page.evaluate(() =>
            sessionStorage.getItem('gredice:uier:delivery'),
        ),
    ).toBe('0');
    await expect(page.locator('script[data-uier-project]')).toHaveCount(0);
});

test('initial delivery login does not load review or replace the document', async ({
    mount,
    page,
}) => {
    const originalUrl = page.url();
    await mount(<UierReviewStory project="delivery" signedOut />);
    await expect(
        page.getByRole('button', { name: 'Email prijava' }),
    ).toBeVisible();
    expect(page.url()).toBe(originalUrl);
    await expect(page.locator('script[data-uier-project]')).toHaveCount(0);
});
