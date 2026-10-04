import { RaisedBedIcon } from '../RaisedBedIcon';
import { Row } from '../Row';
import { Typography } from '../Typography';
import { cx } from '../utils';

export type RaisedBedLabelProps = {
    className?: string;
    name?: string | null;
    physicalId: string | null;
    size?: 'default' | 'compact';
};

export function RaisedBedLabel({
    className,
    name,
    physicalId,
    size = 'default',
}: RaisedBedLabelProps) {
    const trimmedName = name?.trim();

    if (!physicalId && !trimmedName) {
        return <Typography level="body2">Nema fizičke oznake</Typography>;
    }

    const label = physicalId ? `Gr ${physicalId}` : 'Gredica';
    const isCompact = size === 'compact';
    const shouldShowNameAsPrimary = isCompact && Boolean(trimmedName);

    return (
        <Row spacing={2} className={cx('items-center', className)}>
            <RaisedBedIcon
                className={cx(isCompact ? 'size-5' : 'size-6', 'shrink-0')}
                physicalId={physicalId}
            />
            <Typography
                level={isCompact ? 'body2' : 'h5'}
                component="p"
                className={cx(isCompact ? 'leading-tight' : '')}
            >
                <strong>{shouldShowNameAsPrimary ? trimmedName : label}</strong>
                {trimmedName && !shouldShowNameAsPrimary ? (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                        {trimmedName}
                    </span>
                ) : null}
            </Typography>
        </Row>
    );
}
