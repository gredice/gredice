'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useClaimDailyReward } from '../hooks/useClaimDailyReward';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useDailyReward } from '../hooks/useDailyReward';
import { useGameAudio } from '../hooks/useGameAudio';
import {
    AnimateFlyToItem,
    useAnimateFlyToSunflowersHud,
} from '../indicators/AnimateFlyTo';
import { useGameState } from '../useGameState';

const messageTypes = {
    welcome: {
        text: [
            'Sad ima svoj vrt, mjesto gdje ćeš uzgajati svoje biljke i uživati u predivnoj prirodi.',
            'Tvoj vrt je trenutno prazan 🥺 ali ne brini, možeš ga popuniti raskošnim gredicama, raznim alatima i ukrasima.',
            'Alate i ukrase možeš kupiti suncokretima, a gredice i povrće u našem dučanu. Sve dostupno preko trake na dnu ekrana.',
            'Kreni u avanturu i stvori svoj vlastiti vrt iz snova!',
        ],
    },
    newDayMorning: {
        text: [
            'Novi dan je stigao, vrijeme je za zalijevanje biljaka i brigu o vrtu.',
            'Pogledaj svoje biljke i provjeri trebaju li zalijevanje ili neku drugu vrstu njege.',
            'Sretno! 🌻',
        ],
    },
    newDayAfternoon: {
        text: [
            'Sad je pravo vrijeme za obilazak vrta i brigu o svojim biljkama.',
            'Uživaj u predivnom danu! 🌞',
        ],
    },
    newDayEvening: {
        text: [
            'Danas je bio dug i naporan dan, ali još stigneš obići svoj vrt i provjeriti svoje biljke.',
        ],
    },
};

export function WelcomeMessage() {
    const { data: currentUser } = useCurrentUser();
    const { data: dailyReward } = useDailyReward();
    const claimDailyReward = useClaimDailyReward();
    const shouldShow = Boolean(currentUser && dailyReward?.canClaim);
    const [open, setOpen] = useState(shouldShow);
    const [isClosing, setIsClosing] = useState(false);
    const previousShouldShow = useRef(shouldShow);
    const closeTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (shouldShow && !previousShouldShow.current) {
            setOpen(true);
        }

        if (!shouldShow) {
            setOpen(false);
            setIsClosing(false);
            if (closeTimeoutRef.current !== null) {
                window.clearTimeout(closeTimeoutRef.current);
                closeTimeoutRef.current = null;
            }
        }

        previousShouldShow.current = shouldShow;
    }, [shouldShow]);
    useEffect(() => {
        return () => {
            if (closeTimeoutRef.current !== null) {
                window.clearTimeout(closeTimeoutRef.current);
                closeTimeoutRef.current = null;
            }
        };
    }, []);
    const { resumeIfNeeded } = useGameAudio();
    function handleOpenChange(newOpen: boolean) {
        setOpen(newOpen);
        resumeIfNeeded();
        if (!newOpen && dailyReward?.canClaim) {
            claimDailyReward.mutate();
        }
    }

    const animationDuration = 800;
    const animateSunflowerReward = useAnimateFlyToSunflowersHud({
        duration: animationDuration,
    });

    const handleStart = () => {
        if (isClosing) {
            return;
        }

        if (dailyReward?.canClaim) {
            animateSunflowerReward.run();
        }

        setIsClosing(true);
        closeTimeoutRef.current = window.setTimeout(() => {
            closeTimeoutRef.current = null;
            handleOpenChange(false);
        }, animationDuration + 50);
    };

    const timeOfDay = useGameState((state) => state.timeOfDay);
    const isDay = timeOfDay > 0.2 && timeOfDay < 0.8;
    const isMorning = timeOfDay < 0.4;
    const title = isDay
        ? isMorning
            ? 'Dobro jutro'
            : 'Dobar dan!'
        : 'Dobra večer!';

    let messageType: keyof typeof messageTypes;
    if (isDay) {
        messageType = isMorning ? 'newDayMorning' : 'newDayAfternoon';
    } else {
        messageType = 'newDayEvening';
    }
    const messages = messageTypes[messageType];

    if (!shouldShow && !open) {
        return null;
    }

    return (
        <Modal
            title={title}
            open={open}
            onOpenChange={handleOpenChange}
            className="max-w-screen-md border-tertiary border-b-4"
            hideClose
            dismissible={false}
        >
            <div className="grid md:grid-cols-2 [grid-template-areas:'sunflower'_'content'] md:[grid-template-areas:'content_sunflower'] md:p-4 gap-4">
                <Stack spacing={3} className="[grid-area:content]">
                    <Stack spacing={1.5}>
                        <Typography level="h2" gutterBottom>
                            {title}
                        </Typography>
                        {messages.text.map((text) => (
                            <Typography key={text} level="body1">
                                {text}
                            </Typography>
                        ))}
                        {dailyReward && (
                            <Card>
                                <Typography
                                    level="body1"
                                    className="text-md font-semibold"
                                    component="span"
                                >
                                    {`Dan ${
                                        dailyReward.current.day >= 7
                                            ? '7+'
                                            : dailyReward.current.day
                                    }`}
                                </Typography>
                                <Typography level="body1" gutterBottom>
                                    {`Danas dobivaš ${
                                        dailyReward.current.amount
                                    } 🌻 za dnevnu aktivnost.`}
                                </Typography>
                                <Typography level="body3">
                                    ✨ Posjeti svoj vrt svaki dan i skupljaj
                                    suncokrete!
                                </Typography>
                            </Card>
                        )}
                    </Stack>
                    <Button
                        variant="solid"
                        endDecorator={
                            dailyReward && (
                                <AnimateFlyToItem
                                    {...animateSunflowerReward.props}
                                    className="flex items-center gap-1 font-semibold text-yellow-500 dark:text-yellow-100"
                                >
                                    <span>{`+${dailyReward.current.amount}`}</span>
                                    <span role="img" aria-hidden>
                                        🌻
                                    </span>
                                </AnimateFlyToItem>
                            )
                        }
                        onClick={handleStart}
                        disabled={claimDailyReward.isPending || isClosing}
                    >
                        Kreni
                    </Button>
                </Stack>
                <div className="w-full h-full rounded-3xl bg-card flex flex-row items-end justify-center [grid-area:sunflower]">
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
