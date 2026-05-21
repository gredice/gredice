'use client';

import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

type AdventMissedDayScreenProps = {
    day: number;
    onClose: () => void;
};

export function AdventMissedDayScreen({
    day,
    onClose,
}: AdventMissedDayScreenProps) {
    return (
        <Stack spacing={8} className="items-center text-center p-8">
            {/* Sad emoji */}
            <div className="text-6xl">😢</div>

            {/* Message */}
            <Stack spacing={4}>
                <Typography level="h4" className="font-bold">
                    Dan {day}
                </Typography>
                <Typography level="body2">
                    Nažalost, nagrade za ovaj dan su istekle.
                </Typography>
                <Typography level="body2">
                    Ne brini, ima još vremena za pokupiti ostale nagrade! 🎁
                </Typography>
            </Stack>

            {/* Close button */}
            <Button
                variant="solid"
                size="lg"
                className="bg-[#8B0000] hover:bg-[#6B0000] text-white"
                onClick={onClose}
            >
                U redu
            </Button>
        </Stack>
    );
}
