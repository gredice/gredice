import { BlockImage } from '@gredice/ui/BlockImage';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
    RAISED_BED_ABANDONED_MESSAGE,
} from '../../raisedBedConstants';

export function RaisedBedFieldAbandoned({
    reason,
}: {
    reason?: string | null;
}) {
    const message =
        reason === 'inactivity'
            ? RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE
            : RAISED_BED_ABANDONED_MESSAGE;

    return (
        <div className="flex h-full flex-col items-center mt-4">
            <Stack spacing={2}>
                <Typography level="h5" semiBold center className="text-white">
                    {message}
                </Typography>
                <Typography
                    level="body1"
                    center
                    className="text-balance text-white/80"
                >
                    {RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}
                </Typography>
                <div className="relative left-14 opacity-70 grayscale">
                    <BlockImage
                        blockName="Raised_Bed"
                        width={144}
                        height={144}
                        className="size-36 absolute"
                    />
                    <BlockImage
                        blockName="Raised_Bed"
                        width={144}
                        height={144}
                        className="size-36 absolute left-[60px] top-[33px]"
                    />
                </div>
            </Stack>
        </div>
    );
}
