import { Modal, type ModalProps } from '@gredice/ui/Modal';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import { GameModalHeader } from './GameModalHeader';

export type GameModalProps = ModalProps & {
    headerAction?: ReactNode;
    headerClassName?: string;
    headerDescription?: ReactNode;
    headerIcon?: ReactNode;
    hudLayer?: boolean;
    showHeader?: boolean;
};

export function GameModal({
    children,
    className,
    headerAction,
    headerClassName,
    headerDescription,
    headerIcon,
    hudLayer,
    overlayClassName,
    showHeader,
    title,
    ...rest
}: GameModalProps) {
    const shouldShowHeader =
        showHeader ?? Boolean(headerIcon || headerAction || headerDescription);

    return (
        <Modal
            className={cx(
                'border-tertiary border-b-4 md:[padding-top:calc(var(--game-safe-area-top,0px)+1.5rem)] md:[padding-right:calc(var(--game-safe-area-right,0px)+1.5rem)] md:[padding-bottom:calc(var(--game-safe-area-bottom,0px)+1.5rem)] md:[padding-left:calc(var(--game-safe-area-left,0px)+1.5rem)] md:[&>button:last-child]:top-[calc(var(--game-safe-area-top,0px)+0.25rem)] md:[&>button:last-child]:right-[calc(var(--game-safe-area-right,0px)+0.25rem)]',
                hudLayer && 'z-[46]',
                className,
            )}
            overlayClassName={cx(hudLayer && 'z-[46]', overlayClassName)}
            title={title}
            {...rest}
        >
            {shouldShowHeader ? (
                <GameModalHeader
                    action={headerAction}
                    className={headerClassName}
                    description={headerDescription}
                    icon={headerIcon}
                    title={title}
                />
            ) : null}
            {children}
        </Modal>
    );
}
