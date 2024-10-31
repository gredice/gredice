import { Typography } from "@signalco/ui-primitives/Typography";
import { PropsWithChildren } from "react";

export function NoDataPlaceholder({ children }: PropsWithChildren) {
    return (
        <Typography level="body2" center>
            {children || 'Nema podataka'}
        </Typography>
    )
}