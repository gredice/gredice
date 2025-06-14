import { cx } from "@signalco/ui-primitives/cx";
import { Spinner } from "@signalco/ui-primitives/Spinner";

type RaisedBedFieldItemButtonProps =
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        isLoading?: boolean;
    };

export function RaisedBedFieldItemButton({ isLoading, children, className, ...rest }: RaisedBedFieldItemButtonProps) {
    return (
        <button
            type="button"
            className={cx(
                'relative',
                "bg-gradient-to-br from-lime-100/90 to-lime-100/80 size-full flex items-center justify-center rounded-sm",
                "hover:bg-white",
                "transition-colors",
                className
            )} {...rest}>
            {isLoading && (
                <div className="absolute right-1 top-1">
                    <Spinner loadingLabel={"Učitavanje..."} />
                </div>
            )}
            {children}
        </button>
    );
}