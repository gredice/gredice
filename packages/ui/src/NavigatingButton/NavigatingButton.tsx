import { Button, type ButtonProps } from '../Button';
import { Navigate } from '../icons';
import { cx } from '../utils';

export type NavigatingButtonProps = ButtonProps & {
    hideArrow?: boolean;
};

export function NavigatingButton({
    className,
    endDecorator,
    hideArrow,
    startDecorator,
    ...rest
}: NavigatingButtonProps) {
    return (
        <Button
            className={cx(hideArrow && 'group/nav-button', className)}
            endDecorator={
                endDecorator ?? (
                    <span
                        className={cx(
                            'pl-1',
                            hideArrow &&
                                'opacity-0 transition-opacity group-hover/nav-button:opacity-100',
                        )}
                    >
                        <Navigate aria-hidden className="size-4" />
                    </span>
                )
            }
            startDecorator={
                startDecorator ??
                (hideArrow ? <span className="w-4 pr-1" /> : undefined)
            }
            {...rest}
        />
    );
}
