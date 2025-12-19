'use client';

import { BlockImage } from '@gredice/ui/BlockImage';
import { Button } from '@signalco/ui-primitives/Button';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGiftBoxParam } from '../useUrlState';

export function GiftBoxModal() {
    const [giftBoxParam, setGiftBoxParam] = useGiftBoxParam();
    const { data: garden, isLoading } = useCurrentGarden();
    const isOpen = Boolean(giftBoxParam);
    const handleClose = () => setGiftBoxParam(null);

    const blockName = garden?.stacks
        ?.flatMap((stack) => stack.blocks)
        .find((block) => block.id === giftBoxParam)?.name;

    return (
        <Modal
            open={isOpen}
            onOpenChange={(open) => !open && handleClose()}
            title="Poklon kutija"
        >
            <Stack spacing={3}>
                <div className="flex justify-center">
                    {!giftBoxParam || isLoading ? (
                        <span className="size-28"></span>
                    ) : blockName ? (
                        <BlockImage
                            blockName={blockName}
                            width={160}
                            height={160}
                            className="rounded-lg"
                        />
                    ) : (
                        <span className="size-20 text-[80px]">🎁</span>
                    )}
                </div>

                <Stack spacing={1}>
                    <Typography level="body1" semiBold>
                        Poklon kutija te čeka.
                    </Typography>
                    <Typography level="body2" secondary>
                        Poklon kutije možeš otvoriti nakon adventa (25.12.).
                        Svaka kutija skriva posebno iznenađenje samo za tebe 🎊.
                    </Typography>
                </Stack>

                <Button
                    type="button"
                    variant="solid"
                    className="self-start"
                    onClick={handleClose}
                >
                    Uredu
                </Button>
            </Stack>
        </Modal>
    );
}
