import { Modal, type ModalProps } from '@gredice/ui/Modal';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import { GameModalHeader } from './GameModalHeader';

export type GameModalProps = ModalProps & {
    headerAction?: ReactNode;
    headerClassName?: string;
    headerDescription?: ReactNode;
    headerIcon?: ReactNode;
    showHeader?: boolean;
};

export function GameModal({
    children,
    className,
    headerAction,
    headerClassName,
    headerDescription,
    headerIcon,
    overlayClassName,
    showHeader,
    title,
    ...rest
}: GameModalProps) {
    const shouldShowHeader =
        showHeader ?? Boolean(headerIcon || headerAction || headerDescription);

    return (
        <Modal
            className={cx('z-[46] border-tertiary border-b-4', className)}
            overlayClassName={cx('z-[46]', overlayClassName)}
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
