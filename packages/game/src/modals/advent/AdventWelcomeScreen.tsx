'use client';

import { Navigate } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { SantaCapIcon } from '../../icons/SantaCap';
import { adventTitleFont } from './fonts';

type AdventWelcomeScreenProps = {
    onContinue: () => void;
};

export function AdventWelcomeScreen({ onContinue }: AdventWelcomeScreenProps) {
    return (
        <Stack spacing={2} className="items-center text-center p-4">
            {/* Mascot with Santa cap */}
            <div className="relative">
                <SantaCapIcon className="absolute top-[-10px] left-1/2 translate-x-[-8px] size-16 z-10 rotate-12" />
                <Image
                    src="https://cdn.gredice.com/sunflower-large.svg"
                    alt="Suncokret"
                    width={160}
                    height={160}
                    className="relative"
                />
            </div>

            {/* Title */}
            <Typography
                level="h2"
                className={`text-2xl font-bold ${adventTitleFont.className}`}
            >
                Adventski kalendar
            </Typography>

            {/* Description */}
            <Typography level="body2" className="max-w-xs">
                Otvori jedno polje svaki dan i pripremi se za najbolja
                iznenađenja 🤩
            </Typography>

            {/* Continue button */}
            <Button
                variant="solid"
                size="lg"
                className="bg-[#8B0000] hover:bg-[#6B0000] text-white"
                onClick={onContinue}
                endDecorator={<Navigate className="size-5 shrink-0" />}
            >
                Nastavi
            </Button>
        </Stack>
    );
}
