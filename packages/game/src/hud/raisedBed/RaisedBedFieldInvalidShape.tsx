import { BlockImage } from '@gredice/ui/BlockImage';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';

export function RaisedBedFieldInvalidShape() {
    return (
        <div className="flex flex-col mt-4 items-center h-full">
            <Stack spacing={1}>
                <Typography level="h5" semiBold center className="text-white">
                    Nevaljan oblik gredice
                </Typography>
                <Typography
                    level="body1"
                    center
                    className="text-balance text-white/80"
                >
                    Gredice trenutno mogu biti samo u obliku 1x2 ili 2x1.
                </Typography>
                <div className="relative left-14">
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
