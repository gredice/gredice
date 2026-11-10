'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Info } from '@gredice/ui/icons';
import dynamic from 'next/dynamic';
import { type ReactNode, useState } from 'react';

const Modal = dynamic(() =>
    import('@gredice/ui/Modal').then((module) => module.Modal),
);

export function AttributeInfoButton({
    children,
    title,
}: {
    children: ReactNode;
    title: string;
}) {
    const [open, setOpen] = useState(false);
    const [hasOpened, setHasOpened] = useState(false);

    return (
        <>
            <IconButton
                size="lg"
                variant="plain"
                aria-label={`Više informacija o ${title}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={(event) => {
                    event.currentTarget.focus({ preventScroll: true });
                    setHasOpened(true);
                    setOpen(true);
                }}
            >
                <Info />
            </IconButton>
            {hasOpened ? (
                <Modal
                    title={title}
                    className="border border-tertiary border-b-4 max-w-xl"
                    onOpenChange={setOpen}
                    open={open}
                >
                    {children}
                </Modal>
            ) : null}
        </>
    );
}
