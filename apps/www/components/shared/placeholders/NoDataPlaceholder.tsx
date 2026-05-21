import { Typography, type TypographyProps } from '@gredice/ui/Typography';

export type NoDataPlaceholder = TypographyProps;

export function NoDataPlaceholder({ children, ...rest }: NoDataPlaceholder) {
    return (
        <Typography level="body2" center {...rest}>
            {children || 'Nema podataka'}
        </Typography>
    );
}
