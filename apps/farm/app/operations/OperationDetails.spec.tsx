import type { EntityStandardized } from '@gredice/storage';
import { expect, test } from '@playwright/experimental-ct-react';
import { OperationDetails } from './OperationDetails';

const markdownOperation = {
    id: 1,
    conditions: {
        completionAttachImagesRequired: true,
        completionAttachNotes: true,
    },
    information: {
        name: 'Čišćenje gredice',
        description: 'Uklanjaju se:\n* korovi\n* stare biljke',
        instructions:
            '1. Pregledava se cijela gredica.\n2. Ručno se čupaju korovi.',
    },
} satisfies EntityStandardized;

test('operation details render manual markdown fields', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const component = await mount(
        <OperationDetails operation={markdownOperation} />,
    );

    await expect(page.getByText('Uklanjaju se:')).toBeVisible();
    await expect(
        page.getByRole('listitem').filter({ hasText: /^korovi$/ }),
    ).toBeVisible();
    await expect(
        page.getByRole('listitem').filter({ hasText: 'stare biljke' }),
    ).toBeVisible();
    await expect(
        page
            .getByRole('listitem')
            .filter({ hasText: 'Pregledava se cijela gredica.' }),
    ).toBeVisible();
    await expect(page.getByText('* korovi')).toHaveCount(0);
    await expect(page.getByText('Dodaj fotografiju (obavezno)')).toBeVisible();
    await expect(page.getByText('Dodaj napomenu (opcionalno)')).toBeVisible();

    const instructionsTop = await page
        .getByText('Upute', { exact: true })
        .evaluate((element) => element.getBoundingClientRect().top);
    const descriptionTop = await page
        .getByText('Opis', { exact: true })
        .evaluate((element) => element.getBoundingClientRect().top);
    expect(instructionsTop).toBeLessThan(descriptionTop);
    expect(
        await component.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return (
                bounds.left >= 0 &&
                bounds.right <= window.innerWidth &&
                element.scrollWidth <= element.clientWidth
            );
        }),
    ).toBe(true);
});

test('keeps long handbook tokens contained on a narrow phone', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const component = await mount(
        <OperationDetails
            operation={{
                id: 2,
                information: {
                    instructions: [
                        '## VrloDugNaslovBezRazmakaKojiSeMoraPrelomitiNaMalomZaslonuVrloDugNaslovBezRazmaka',
                        '',
                        'VrloDugNePrekinutTekstKojiSeMoraPrelomitiNaMalomZaslonuBezHorizontalnogPomicanjaVrloDugNePrekinutTekst',
                        '',
                        'Otvori [detaljne upute](https://example.test/iznimno-duga-poveznica-koja-se-mora-prelomiti-na-malom-zaslonu-bez-horizontalnog-pomicanja).',
                        '',
                        '`vrlo-duga-naredba-bez-razmaka-koja-ne-smije-prosiriti-stranicu-na-telefonu`',
                        '',
                        '```',
                        'vrlo-duga-naredba-u-bloku-bez-razmaka-koja-se-pomice-unutar-kartice',
                        '```',
                    ].join('\n'),
                },
            }}
        />,
    );

    await expect(component.getByRole('link')).toBeVisible();
    await expect(
        component.getByRole('heading', {
            name: /VrloDugNaslovBezRazmaka/,
        }),
    ).toBeVisible();
    await expect(component.locator('pre')).toBeVisible();
    expect(
        await component.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
        ),
    ).toBe(true);
});
