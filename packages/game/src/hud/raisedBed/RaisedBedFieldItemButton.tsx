import { Spinner } from '@gredice/ui/Spinner';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';

type RaisedBedFieldItemButtonProps = Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'color'
> & {
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
                'p-0 relative size-full flex items-center justify-center rounded-xs',
                className,
            )}
            {...rest}
        >
            <div className="absolute left-0.5 top-0">
                <Typography level="body3" className="text-lime-700">
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
