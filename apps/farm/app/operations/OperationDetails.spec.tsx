import type { EntityStandardized } from '@gredice/storage';
import { expect, test } from '@playwright/experimental-ct-react';
import { OperationDetails } from './OperationDetails';

const markdownOperation = {
    id: 1,
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
    await mount(<OperationDetails operation={markdownOperation} />);

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
});
