import {
    Typography,
    type TypographyProps,
} from '@signalco/ui-primitives/Typography';

export type NoDataPlaceholder = TypographyProps;

export function NoDataPlaceholder({ children, ...rest }: NoDataPlaceholder) {
    return (
        <Typography level="body2" center {...rest}>
            {children || 'Nema podataka'}
        </Typography>
    );
}
