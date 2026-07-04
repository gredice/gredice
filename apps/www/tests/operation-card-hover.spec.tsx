import { expect, test } from '@playwright/experimental-ct-react';
import type { ComponentProps } from 'react';
import { OperationCard } from '../app/radnje/OperationCard';
import '../app/globals.css';

const operation = {
    id: 1,
    attributes: {
        application: 'plant',
        deliverable: false,
        duration: 15,
        stage: {
            id: 1,
            information: {
                name: 'harvest',
                label: 'Berba',
            },
        },
    },
    image: {
        cover: {
            url: '',
        },
    },
    information: {
        description: 'Opis radnje.',
        instructions: 'Upute za radnju.',
        label: 'Testna radnja',
        name: 'testna-radnja',
        shortDescription: 'Kratak opis radnje.',
    },
    prices: {
        perOperation: 1,
    },
} satisfies ComponentProps<typeof OperationCard>['operation'];

test('scopes hover highlight to operation card groups', async ({
    mount,
    page,
}) => {
    await mount(
        <div className="group" data-testid="section-hover-wrapper">
            <OperationCard operation={operation} variant="compact" />
        </div>,
    );

    const link = page.getByRole('link', { name: /Testna radnja/ });
    const card = link.locator('> div').first();
    const linkClasses = (await link.getAttribute('class'))?.split(/\s+/) ?? [];
    const cardClasses = (await card.getAttribute('class'))?.split(/\s+/) ?? [];

    expect(linkClasses).toContain('group/operation-card');
    expect(linkClasses).not.toContain('group');
    expect(cardClasses).toContain('group-hover/operation-card:bg-accent');
    expect(cardClasses).toContain(
        'group-hover/operation-card:text-accent-foreground',
    );
    expect(cardClasses).not.toContain('group-hover:bg-accent');
    expect(cardClasses).not.toContain('group-hover:text-accent-foreground');
});
