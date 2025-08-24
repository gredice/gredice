import { Typography } from '@signalco/ui-primitives/Typography';

export function NoSunflowersPlaceholder() {
    return (
        <Typography level="body2" className="flex items-center gap-2">
            <span className="text-2xl pb-1">🥺</span>
            <span>Nema aktivnosti suncokreta</span>
        </Typography>
    );
}
