import { Heart, Lightning } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import type { RaisedBedFieldRelationshipIndicator as RaisedBedFieldRelationshipIndicatorData } from './plantRelationshipSignals';

const directionClassNames: Record<
    RaisedBedFieldRelationshipIndicatorData['direction'],
    string
> = {
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-[calc(50%+2px)]',
    bottomLeft:
        'bottom-0 left-0 -translate-x-[calc(50%+2px)] translate-y-[calc(50%+2px)]',
    bottomRight:
        'bottom-0 right-0 translate-x-[calc(50%+2px)] translate-y-[calc(50%+2px)]',
    left: 'left-0 top-1/2 -translate-x-[calc(50%+2px)] -translate-y-1/2',
    right: 'right-0 top-1/2 translate-x-[calc(50%+2px)] -translate-y-1/2',
    top: 'left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(50%+2px)]',
    topLeft:
        'left-0 top-0 -translate-x-[calc(50%+2px)] -translate-y-[calc(50%+2px)]',
    topRight:
        'right-0 top-0 translate-x-[calc(50%+2px)] -translate-y-[calc(50%+2px)]',
};

const connectorEndPoints: Record<
    RaisedBedFieldRelationshipIndicatorData['direction'],
    { x: number; y: number }
> = {
    bottom: { x: 50, y: 100 },
    bottomLeft: { x: 0, y: 100 },
    bottomRight: { x: 100, y: 100 },
    left: { x: 0, y: 50 },
    right: { x: 100, y: 50 },
    top: { x: 50, y: 0 },
    topLeft: { x: 0, y: 0 },
    topRight: { x: 100, y: 0 },
};

const connectorStartOffsets: Record<
    RaisedBedFieldRelationshipIndicatorData['direction'],
    { x: number; y: number }
> = {
    bottom: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
    bottomRight: { x: 0, y: 0 },
    left: { x: 0, y: 4 },
    right: { x: 0, y: 4 },
    top: { x: 0, y: 0 },
    topLeft: { x: 0, y: 0 },
    topRight: { x: 4, y: 5 },
};

function relationshipTitle(indicator: RaisedBedFieldRelationshipIndicatorData) {
    if (indicator.status === 'companion') {
        return `Dobri susjedi: ${indicator.companionPlantNames.join(', ')}`;
    }

    return `Loši susjedi: ${indicator.antagonistPlantNames.join(', ')}`;
}

function relationshipConnectorPath(
    direction: RaisedBedFieldRelationshipIndicatorData['direction'],
) {
    const center = { x: 50, y: 50 };
    const end = connectorEndPoints[direction];
    const baseDeltaX = end.x - center.x;
    const baseDeltaY = end.y - center.y;
    const baseLength = Math.hypot(baseDeltaX, baseDeltaY) || 1;
    const baseUnitX = baseDeltaX / baseLength;
    const baseUnitY = baseDeltaY / baseLength;
    const startOffset = connectorStartOffsets[direction];
    const start = {
        x: center.x + baseUnitX * 16 + startOffset.x,
        y: center.y + baseUnitY * 16 + startOffset.y,
    };
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const length = Math.hypot(deltaX, deltaY) || 1;
    const unitX = deltaX / length;
    const unitY = deltaY / length;
    const perpendicularX = -unitY;
    const perpendicularY = unitX;
    const startHalfWidth = 3.75;
    const endHalfWidth = 10.75;
    const sideCurve = 10;
    const startCap = {
        x: start.x - unitX * 4,
        y: start.y - unitY * 4,
    };
    const point = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;
    const startLeft = {
        x: start.x + perpendicularX * startHalfWidth,
        y: start.y + perpendicularY * startHalfWidth,
    };
    const endLeft = {
        x: end.x + perpendicularX * endHalfWidth,
        y: end.y + perpendicularY * endHalfWidth,
    };
    const endRight = {
        x: end.x - perpendicularX * endHalfWidth,
        y: end.y - perpendicularY * endHalfWidth,
    };
    const startRight = {
        x: start.x - perpendicularX * startHalfWidth,
        y: start.y - perpendicularY * startHalfWidth,
    };

    return [
        `M ${point(startLeft.x, startLeft.y)}`,
        `C ${point(startLeft.x + unitX * sideCurve, startLeft.y + unitY * sideCurve)} ${point(endLeft.x - unitX * sideCurve, endLeft.y - unitY * sideCurve)} ${point(endLeft.x, endLeft.y)}`,
        `Q ${point(end.x, end.y)} ${point(endRight.x, endRight.y)}`,
        `C ${point(endRight.x - unitX * sideCurve, endRight.y - unitY * sideCurve)} ${point(startRight.x + unitX * sideCurve, startRight.y + unitY * sideCurve)} ${point(startRight.x, startRight.y)}`,
        `Q ${point(startCap.x, startCap.y)} ${point(startLeft.x, startLeft.y)}`,
        'Z',
    ].join(' ');
}

export function RaisedBedFieldRelationshipIndicator({
    indicator,
    showBadge = true,
}: {
    indicator: RaisedBedFieldRelationshipIndicatorData;
    showBadge?: boolean;
}) {
    const title = relationshipTitle(indicator);

    return (
        <>
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: Decorative connector; the badge carries the accessible label. */}
            <svg
                aria-hidden
                className="pointer-events-none absolute -inset-0.5 z-10 overflow-visible"
                focusable="false"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
            >
                <path
                    className="fill-white drop-shadow-sm"
                    d={relationshipConnectorPath(indicator.direction)}
                />
            </svg>
            {showBadge ? (
                <div
                    aria-label={title}
                    className={cx(
                        'pointer-events-none absolute z-20 flex size-6 items-center justify-center rounded-full shadow-md ring-1',
                        directionClassNames[indicator.direction],
                        indicator.status === 'companion'
                            ? 'bg-green-500 text-white ring-green-950/20'
                            : 'bg-red-600 text-white ring-red-950/20',
                    )}
                    data-relationship-status={indicator.status}
                    role="img"
                    title={title}
                >
                    {indicator.status === 'companion' ? (
                        <Heart
                            aria-hidden
                            className="size-3.5 fill-current"
                            strokeWidth={3}
                        />
                    ) : (
                        <Lightning
                            aria-hidden
                            className="size-4 fill-current"
                            strokeWidth={3}
                        />
                    )}
                </div>
            ) : null}
        </>
    );
}
