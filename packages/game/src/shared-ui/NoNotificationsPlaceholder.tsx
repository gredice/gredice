import { Typography } from "@signalco/ui-primitives/Typography";

export function NoNotificationsPlaceholder() {
    return (
        <Typography level="body2" className="flex items-center gap-2">
            <span className="text-2xl pb-3">📪</span>
            <span>Nema novih obavijesti</span>
        </Typography>
    );
}
