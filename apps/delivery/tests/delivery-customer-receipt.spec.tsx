import { expect, test } from '@playwright/experimental-ct-react';
import {
    CustomerDeliveryReceiptJourneyStory,
    CustomerDeliveryReceiptStatesStory,
} from './CustomerDeliveryReceiptStory';
import '../app/globals.css';

test('renders every advisory receipt state with owned harvest data and contextual support', async ({
    mount,
    page,
}) => {
    await mount(<CustomerDeliveryReceiptStatesStory />);

    const receipts = page.getByTestId('customer-delivery-receipt');
    await expect(receipts).toHaveCount(4);
    await expect(
        page.getByRole('heading', {
            name: /Potvrda o dostavi · Vrlo dugačka sorta/,
        }),
    ).toBeVisible();
    for (const index of [2, 3, 4]) {
        await expect(
            page.getByRole('heading', {
                name: `Potvrda o dostavi · Rajčica kupca ${index}`,
            }),
        ).toBeVisible();
    }
    for (const label of [
        'QR etiketa provjerena je pri predaji.',
        'QR etiketa nije bila dostupna pri predaji.',
        'QR provjera nije provedena pri predaji.',
        'Nema zabilježene QR provjere pri predaji.',
    ]) {
        await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(
        page.getByText('Dostava je evidentirana kao dovršena.', {
            exact: true,
        }),
    ).toHaveCount(4);
    await expect(page.getByText(/evidentirana.*na adresi/i)).toHaveCount(0);
    await expect(
        page.getByText(
            'QR skeniranje služi samo kao dodatna evidencija i ne utječe na status dovršene dostave.',
            { exact: true },
        ),
    ).toHaveCount(4);
    await expect(receipts.first()).toContainText(
        'Vrlo dugačka sorta ekološke rajčice',
    );
    await expect(receipts.first().locator('time')).toHaveAttribute(
        'datetime',
        '2026-07-16T09:30:00.000Z',
    );
    await expect(
        page.getByRole('link', { name: /Otvori trag uroda:/ }),
    ).toHaveCount(3);
    await expect(
        page.getByRole('link', { name: /Prijavi da urod nedostaje:/ }),
    ).toHaveCount(4);
    await expect(
        page.getByRole('link', { name: /Prijavi oštećenje:/ }),
    ).toHaveCount(4);
    await expect(
        page.getByRole('link', {
            name: /Kontaktiraj podršku za dostavu:/,
        }),
    ).toHaveCount(4);

    const missingHref = await page
        .getByRole('link', { name: /Prijavi da urod nedostaje:/ })
        .first()
        .getAttribute('href');
    if (!missingHref) throw new Error('Missing contextual support href.');
    const missingUrl = new URL(missingHref);
    expect(missingUrl.pathname).toBe('podrska@gredice.com');
    expect(missingUrl.searchParams.get('body')).toContain(
        'Referenca dostave: customer-owned-request-1-4144',
    );
    expect(missingUrl.searchParams.get('body')).toContain(
        'customer-owned-trace-1-4144',
    );

    const renderedText = await page.locator('body').innerText();
    for (const sentinel of [
        'PRIVATE DRIVER NOTE 4144',
        'FOREIGN BULK RECIPIENT 4144',
        'FOREIGN HARVEST 4144',
        'FOREIGN REQUEST NOTE 4144',
        'foreign-trace-4144',
    ]) {
        expect(renderedText).not.toContain(sentinel);
    }
});

test.describe('customer receipt on a small touch screen', () => {
    test.use({
        viewport: { width: 360, height: 800 },
        hasTouch: true,
        isMobile: true,
    });

    test('keeps long content contained and every action touch-sized', async ({
        mount,
        page,
    }) => {
        await mount(<CustomerDeliveryReceiptStatesStory />);
        const receipt = page.getByTestId('customer-delivery-receipt').first();

        const fitsViewport = await receipt.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
        );
        expect(fitsViewport).toBe(true);
        for (const link of await receipt.getByRole('link').all()) {
            const box = await link.boundingBox();
            expect(box?.height).toBeGreaterThanOrEqual(44);
        }
    });
});

test('moves from live tracking to a completed receipt in the customer journey', async ({
    mount,
    page,
}) => {
    await mount(<CustomerDeliveryReceiptJourneyStory />);

    await expect(
        page.getByText('Lokacija vozača je uživo.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByTestId('customer-delivery-receipt')).toHaveCount(0);
    await expect(page.getByText('Vozač stiže', { exact: true })).toBeVisible();

    await page
        .getByRole('button', { name: 'Simuliraj potvrdu dostave' })
        .click();

    await expect(
        page.getByText('Lokacija vozača je uživo.', { exact: false }),
    ).toHaveCount(0);
    await expect(
        page.getByText('Dostavljeno', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByTestId('customer-delivery-receipt')).toBeVisible();
    const supportHref = await page
        .getByRole('link', {
            name: /Kontaktiraj podršku za dostavu:/,
        })
        .getAttribute('href');
    if (!supportHref) throw new Error('Missing journey support href.');
    expect(new URL(supportHref).searchParams.get('body')).toContain(
        'customer-owned-request-journey-4144',
    );
});
