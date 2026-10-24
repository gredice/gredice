import { getRaisedBedFieldGroups } from '@gredice/js/plants';
import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedsOverview } from './RaisedBedsOverview';
import { getRaisedBedPositionIndexesDescending } from './raisedBedPositionOrder';

const raisedBeds = [6, 5, 3, 2, 1].map((position) => ({
    id: position + 100,
    physicalId: String(position),
    name:
        position === 5
            ? 'Ljupki Vjetar s vrlo dugim nazivom'
            : `Gredica ${position}`,
    fields: getRaisedBedFieldGroups(
        getRaisedBedPositionIndexesDescending(
            Array.from(
                { length: position === 5 ? 9 : position === 2 ? 0 : 18 },
                (_, i) => i,
            ),
        ),
        [],
    ).map((group) => {
        const hasPlant =
            position !== 2 &&
            (position !== 5 ||
                group.positionNumbers.every((number) => number <= 9));
        return {
            ...group,
            key: String(group.positionNumbers[0]),
            hasPlant,
            label: `Polje ${group.positionNumbers[0]}${hasPlant ? '' : ' prazno'}`,
            plants: hasPlant
                ? [
                      {
                          key: String(group.positionNumbers[0]),
                          plantSort: undefined,
                          positionNumbers: group.positionNumbers,
                          plantCount: undefined,
                          status: 'sowed',
                          statusLabel: 'Posijana',
                      },
                  ]
                : [],
        };
    }),
}));

for (const width of [320, 375, 768, 1280]) {
    test(`physical bed positions remain aligned at ${width}px`, async ({
        mount,
        page,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 });
        const component = await mount(
            <div className="mx-auto max-w-2xl p-2 sm:p-4">
                <RaisedBedsOverview raisedBeds={raisedBeds} />
            </div>,
        );
        const rect = (physicalId: number) =>
            component
                .getByRole('link', {
                    name: new RegExp(`^Gredica ${physicalId}:`),
                })
                .boundingBox();
        const [six, five, three, two, one] = await Promise.all(
            [6, 5, 3, 2, 1].map(rect),
        );
        expect(six && five && three && two && one).toBeTruthy();
        if (!six || !five || !three || !two || !one)
            throw new Error('Missing bed');
        expect(six.y).toBe(five.y);
        expect(three.y).toBe(one.y);
        expect(three.y).toBeGreaterThan(six.y + six.height);
        expect(three.x).toBe(six.x);
        expect(two.x).toBe(five.x);
        expect(one.x).toBeGreaterThan(two.x + two.width);
        expect(six.height).toBeLessThan(330);
        expect(five.height).toBe(six.height);
        const sparseBed = component.getByRole('link', { name: /^Gredica 5:/ });
        for (let field = 10; field <= 18; field++) {
            await expect(
                sparseBed.getByTitle(`Polje ${field} prazno`, { exact: true }),
            ).toBeVisible();
        }
        const [topLeft, middleRight, bottomHalf, bottomRight] =
            await Promise.all(
                [
                    'Polje 18 prazno',
                    'Polje 10 prazno',
                    'Polje 9',
                    'Polje 1',
                ].map((title) =>
                    sparseBed.getByTitle(title, { exact: true }).boundingBox(),
                ),
            );
        if (!topLeft || !middleRight || !bottomHalf || !bottomRight)
            throw new Error('Missing field');
        expect(bottomHalf.y).toBeGreaterThan(
            middleRight.y + middleRight.height,
        );
        expect(bottomHalf.x).toBe(topLeft.x);
        expect(bottomRight.x).toBe(middleRight.x);
        expect(bottomRight.y).toBeGreaterThan(bottomHalf.y + bottomHalf.height);
        await expect(
            component
                .getByRole('link', { name: /^Gredica 2:/ })
                .getByTitle(/^Polje \d+ prazno$/),
        ).toHaveCount(18);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
        await page.screenshot({
            path: testInfo.outputPath(`overview-${width}.png`),
            fullPage: true,
        });
    });
}
