'use client';

import { Button } from '@gredice/ui/Button';
import { Navigate } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Image from 'next/image';

type AdventDescriptionScreenProps = {
    onContinue: () => void;
};

export function AdventDescriptionScreen({
    onContinue,
}: AdventDescriptionScreenProps) {
    return (
        <Stack spacing={6} className="items-center text-center p-4">
            {/* Placeholder for illustration */}
            <div className="w-40 h-40 dark:bg-tertiary-foreground rounded-lg dark:shadow-2xl flex items-center justify-center">
                <Image
                    src="https://cdn.gredice.com/assets/advent-gift-box-secret-766x714.png"
                    alt="Advent Gift Box"
                    width={160}
                    height={160}
                />
            </div>

            {/* Description */}
            <Stack spacing={2}>
                <Typography level="body2" className="max-w-xs">
                    Da bi pokupio svoj zadnji, najslađi poklončić, trebaš proći
                    cijeli put.
                </Typography>

                <Typography level="body2" className="max-w-xs">
                    Svaki dan otvori po jedan prozorčić adventskog kalendara i
                    nakon 24 dana čeka te gift box.
                </Typography>
            </Stack>

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
