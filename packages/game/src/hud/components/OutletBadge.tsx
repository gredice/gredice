import { Chip, type ChipProps } from '@gredice/ui/Chip';
import { Discount } from '@gredice/ui/icons';

type OutletBadgeProps = Omit<
    ChipProps,
    'children' | 'color' | 'startDecorator' | 'variant'
> & {
    children: ChipProps['children'];
};

export function OutletBadge({
    children,
    size = 'sm',
    ...props
}: OutletBadgeProps) {
    return (
        <Chip
            color="success"
            data-outlet-badge
            size={size}
            startDecorator={<Discount aria-hidden />}
            variant="soft"
            {...props}
        >
            {children}
        </Chip>
    );
}
