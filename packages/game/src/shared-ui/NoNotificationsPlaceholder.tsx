import { Typography } from "@signalco/ui-primitives/Typography";

export function NoNotificationsPlaceholder() {
    return (
        <Typography level="body2" className="flex items-center gap-4 p-4 justify-center">
            <span className="text-2xl pb-1">📪</span>
            <span>Nema novih obavijesti</span>
        </Typography>
    );
}
