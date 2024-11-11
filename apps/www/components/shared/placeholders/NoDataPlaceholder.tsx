import { Typography, TypographyProps } from "@signalco/ui-primitives/Typography";
import { PropsWithChildren } from "react";

export type NoDataPlaceholder = TypographyProps;

export function NoDataPlaceholder({ children, ...rest }: NoDataPlaceholder) {
    return (
        <Typography level="body2" center {...rest}>
            {children || 'Nema podataka'}
        </Typography>
    )
}