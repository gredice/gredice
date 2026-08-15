const oarStrokeDistance = 0.82;
const oarStrokeAngle = 0.48;

export function getFishingBoatOarRotation({
    distance,
    rowingAmount,
}: {
    distance: number;
    rowingAmount: number;
}) {
    const amount = Math.min(Math.max(rowingAmount, 0), 1);
    return (
        Math.sin((distance / oarStrokeDistance) * Math.PI * 2) *
        oarStrokeAngle *
        amount
    );
}
