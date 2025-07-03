import { cx } from "@signalco/ui-primitives/cx";
import { Spinner } from "@signalco/ui-primitives/Spinner";
import { ButtonGreen } from "../../shared-ui/ButtonGreen";

type RaisedBedFieldItemButtonProps =
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        isLoading?: boolean;
    };

export function RaisedBedFieldItemButton({ isLoading, children, className, ...rest }: RaisedBedFieldItemButtonProps) {
    return (
        <ButtonGreen
            className={cx(
                'p-0 relative size-full flex items-center justify-center rounded-sm',
                className
            )} {...rest}>
            {isLoading && (
                <div className="absolute right-1 top-1">
                    <Spinner loadingLabel={"Učitavanje..."} />
                </div>
            )}
            {children}
        </ButtonGreen>
    );
}