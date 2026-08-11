import { expect, test } from '@playwright/experimental-ct-react';
import { DetailedInspectionFarmerFixture } from './DetailedInspectionFarmerFixture';

test('keeps the inspection farmer grounded while patrolling around the bed', async ({
    mount,
}) => {
    const fixture = await mount(<DetailedInspectionFarmerFixture />);
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const initialX = Number(await fixture.getAttribute('data-actor-x'));
    const initialZ = Number(await fixture.getAttribute('data-actor-z'));
    await expect
        .poll(async () => {
            const x = Number(await fixture.getAttribute('data-actor-x'));
            const z = Number(await fixture.getAttribute('data-actor-z'));
            return Math.hypot(x - initialX, z - initialZ);
        })
        .toBeGreaterThan(0.2);

    const actorY = Number(await fixture.getAttribute('data-actor-y'));
    expect(actorY).toBeCloseTo(0.4, 2);
});

test('renders wider advice that still opens the inspection review', async ({
    mount,
}) => {
    const fixture = await mount(<DetailedInspectionFarmerFixture />);
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const bubble = fixture.getByRole('button', {
        name: 'Otvori bilješke detaljnog pregleda gredica',
    });
    const bubbleBox = await bubble.boundingBox();
    expect(bubbleBox?.width).toBeGreaterThan(240);
    await bubble.evaluate((element) => element.click());
    await expect(fixture).toHaveAttribute('data-opened', 'true');
});
