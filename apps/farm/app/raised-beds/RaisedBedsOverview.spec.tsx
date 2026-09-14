import { getRaisedBedFieldGroups } from '@gredice/js/plants';
import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedsOverview } from './RaisedBedsOverview';

const raisedBeds = [6, 5, 3, 2, 1].map((position) => ({
    id: position + 100,
    physicalId: String(position),
    name:
        position === 5
            ? 'Ljupki Vjetar s vrlo dugim nazivom'
            : `Gredica ${position}`,
    fields: getRaisedBedFieldGroups(
        Array.from({ length: 18 }, (_, i) => 17 - i),
        [],
    ).map((group) => ({
        ...group,
        key: String(group.positionNumbers[0]),
        hasPlant: true,
        label: `Polje ${group.positionNumbers[0]}`,
        plants: [
            {
                key: String(group.positionNumbers[0]),
                plantSort: undefined,
                positionNumbers: group.positionNumbers,
                plantCount: undefined,
                status: 'sowed',
                statusLabel: 'Posijana',
            },
        ],
    })),
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
