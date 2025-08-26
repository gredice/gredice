import { cx } from '@signalco/ui-primitives/cx';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Typography } from '@signalco/ui-primitives/Typography';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';

type RaisedBedFieldItemButtonProps =
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        isLoading?: boolean;
        positionIndex: number;
    };

export function RaisedBedFieldItemButton({
    isLoading,
    children,
    className,
    positionIndex,
    ...rest
}: RaisedBedFieldItemButtonProps) {
    return (
        <ButtonGreen
            className={cx(
                'p-0 relative size-full flex items-center justify-center rounded-sm',
                className,
            )}
            {...rest}
        >
            <div className="absolute left-1.5 top-1">
                <Typography bold className="text-lime-700">
                    {positionIndex + 1}
                </Typography>
            </div>
            {isLoading && (
                <div className="absolute right-1 top-1">
                    <Spinner loadingLabel={'Učitavanje...'} />
                </div>
            )}
            {children}
        </ButtonGreen>
    );
}
