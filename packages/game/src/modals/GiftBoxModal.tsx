'use client';

import { BlockImage } from '@gredice/ui/BlockImage';
import { Button } from '@signalco/ui-primitives/Button';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useMemo, useState } from 'react';
import Confetti from 'react-confetti-boom';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useOpenGiftBox } from '../hooks/useOpenGiftBox';
import { GiftBoxRewardScreen } from './GiftBoxRewardScreen';
import { useGiftBoxParam } from '../useUrlState';

const ADVENT_YEAR = 2025;
const ADVENT_END_DATE = new Date(ADVENT_YEAR, 11, 25);

export function GiftBoxModal() {
    const [giftBoxParam, setGiftBoxParam] = useGiftBoxParam();
    const { data: garden, isLoading } = useCurrentGarden();
    const openGiftBox = useOpenGiftBox();
    const [giftOpened, setGiftOpened] = useState(false);
    const [reward, setReward] = useState<
        | {
              kind: 'plant' | 'operation';
              entityTypeName: 'plantSort' | 'operation';
              entityId: string;
              title: string;
          }
        | null
    >(null);
    const isOpen = Boolean(giftBoxParam);
    const canOpenGift = useMemo(
        () => new Date() >= ADVENT_END_DATE,
        [],
    );
    const handleClose = () => {
        setGiftBoxParam(null);
        setGiftOpened(false);
        setReward(null);
        openGiftBox.reset();
    };

    useEffect(() => {
        if (
            openGiftBox.isSuccess &&
            openGiftBox.data &&
            'reward' in openGiftBox.data &&
            openGiftBox.data.reward
        ) {
            setGiftOpened(true);
            setReward(openGiftBox.data.reward);
        }
    }, [openGiftBox.data, openGiftBox.isSuccess]);

    const blockName = garden?.stacks
        ?.flatMap((stack) => stack.blocks)
        .find((block) => block.id === giftBoxParam)?.name;

    const errorMessage =
        openGiftBox.error instanceof Error
            ? openGiftBox.error.message
            : null;

    const handleOpenGift = () => {
        if (!garden || !giftBoxParam) {
            return;
        }
        openGiftBox.mutate({ gardenId: garden.id, blockId: giftBoxParam });
    };

    return (
        <Modal
            open={isOpen}
            onOpenChange={(open) => !open && handleClose()}
            title="Poklon kutija"
        >
            {reward ? (
                <GiftBoxRewardScreen reward={reward} onClose={handleClose} />
            ) : (
            <Stack spacing={3} className="relative">
                {giftOpened && <Confetti mode="fall" particleCount={40} />}
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
                        Sretan Božić! 🎄
                    </Typography>
                    {giftOpened ? (
                        <Typography level="body2" secondary>
                            Poklon je otvoren i spremljen u tvoj inventar.
                        </Typography>
                    ) : (
                        <Typography level="body2" secondary>
                            Otvori svoj poklon i preuzmi novo iznenađenje u
                            inventar.
                        </Typography>
                    )}
                    {!canOpenGift && (
                        <Typography level="body2" secondary>
                            Poklon kutije možeš otvoriti nakon adventa (25.12.).
                        </Typography>
                    )}
                    {errorMessage && (
                        <Typography level="body2" className="text-red-500">
                            {errorMessage}
                        </Typography>
                    )}
                </Stack>

                {giftOpened ? (
                    <Button
                        type="button"
                        variant="solid"
                        className="self-start"
                        onClick={handleClose}
                    >
                        U redu
                    </Button>
                ) : (
                    <Button
                        type="button"
                        variant="solid"
                        className="self-start"
                        onClick={handleOpenGift}
                        disabled={!canOpenGift || openGiftBox.isPending}
                    >
                        Otvori poklon
                    </Button>
                )}
            </Stack>
            )}
        </Modal>
    );
}
