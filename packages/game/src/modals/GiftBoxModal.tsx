'use client';

import { BlockImage } from '@gredice/ui/BlockImage';
import { Button } from '@signalco/ui-primitives/Button';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useGiftBoxParam } from '../useUrlState';

export function GiftBoxModal() {
    const [giftBoxParam, setGiftBoxParam] = useGiftBoxParam();

    const isOpen = Boolean(giftBoxParam);

    const handleClose = () => setGiftBoxParam(null);

    return (
        <Modal
            open={isOpen}
            onOpenChange={(open) => !open && handleClose()}
            title="Poklon kutija"
        >
            <Stack spacing={3}>
                {giftBoxParam && (
                    <div className="flex justify-center">
                        <BlockImage
                            blockName={giftBoxParam}
                            width={120}
                            height={120}
                            className="rounded-lg"
                        />
                    </div>
                )}

                <Stack spacing={1}>
                    <Typography level="body1" semiBold>
                        Poklon kutije možeš otvoriti nakon adventa (25.12.).
                    </Typography>
                    <Typography level="body2" secondary>
                        Svaka kutija skriva iznenađenje za tebe koje će se
                        otkriti tek nakon blagdana.
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
