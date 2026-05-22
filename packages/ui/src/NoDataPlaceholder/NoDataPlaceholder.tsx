import { Typography, type TypographyProps } from '../Typography';

export type NoDataPlaceholderProps = TypographyProps;

export function NoDataPlaceholder({
    children,
    ...rest
}: NoDataPlaceholderProps) {
    return (
        <Typography center level="body2" secondary {...rest}>
            {children || 'Nema podataka'}
        </Typography>
    );
}
