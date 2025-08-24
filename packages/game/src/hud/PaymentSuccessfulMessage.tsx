'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { Navigate } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { useState } from 'react';
import Confetti from 'react-confetti-boom';
import { useGameAudio } from '../hooks/useGameAudio';

export function PaymentSuccessfulMessage() {
    const [showSuccessMessage, setShowSuccessMessage] =
        useSearchParam('placanje');
    const isSuccess = showSuccessMessage === 'uspijesno';

    const [open, setOpen] = useState(isSuccess);
    const { resumeIfNeeded } = useGameAudio();
    function handleOpenChange(newOpen: boolean) {
        setOpen(newOpen);
        setShowSuccessMessage(undefined);
        resumeIfNeeded();
    }

    const title = 'Plaćanje uspješno';
    const messages = {
        text: [
            'Hvala ti na tvojoj podršci! Tvoje plaćanje je uspješno obrađeno.',
            'Uskoro ćeš moći uživati u svom još ljepšem vrtu.',
            'Dobit ćeš obavijest kad tvoje narudžbe budu spremne.',
            'Nastavi uživati u Gredici i stvori svoj vrt iz snova! 🌻',
        ],
    };

    return (
        <Modal
            title={title}
            open={open}
            onOpenChange={handleOpenChange}
            className="max-w-screen-md border-tertiary border-b-4"
        >
            <div className="grid md:grid-cols-2 [grid-template-areas:'sunflower'_'content'] md:[grid-template-areas:'content_sunflower'] md:p-4 gap-4">
                <Stack spacing={3} className="[grid-area:content]">
                    <Stack spacing={1.5}>
                        <Typography level="h2" gutterBottom>
                            {title}
                        </Typography>
                        {messages.text.map((text) => (
                            <Typography key={`${text}`} level="body1">
                                {text}
                            </Typography>
                        ))}
                    </Stack>
                    <Button
                        variant="solid"
                        endDecorator={
                            <Navigate className="size-5 animate-pulse" />
                        }
                        onClick={() => handleOpenChange(false)}
                    >
                        Kreni u avanturu
                    </Button>
                </Stack>
                <div className="w-full h-full rounded-3xl bg-card flex flex-row items-end justify-center [grid-area:sunflower]">
                    <Confetti mode="fall" />
                    <div className="size-40 relative">
                        <Image
                            src="https://cdn.gredice.com/sunflower-large.svg"
                            alt="Suncokret"
                            width={160}
                            height={160}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}