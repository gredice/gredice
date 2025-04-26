'use client';

import { Modal } from "@signalco/ui-primitives/Modal";
import { useGameState } from "@gredice/game";
import { Typography } from "@signalco/ui-primitives/Typography";
import { useMemo, useState } from "react";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Button } from "@signalco/ui-primitives/Button";
import { ChevronRight } from "lucide-react";
import { useGameAudio } from "../hooks/useGameAudio";

const messageTypes = {
    welcome: {
        text: [
            "Sad ima svoj vrt, mjesto gdje ćeš uzgajati svoje biljke i uživati u predivnoj prirodi.",
            "Tvoj vrt je trenutno prazan 🥺 ali ne brini, možeš ga popuniti raskošnim gredicama, raznim alatima i ukrasima.",
            "Alate i ukrase možeš kupiti suncokretima, a gredice i povrće u našem dučanu. Sve dostupno preko trake na dnu ekrana.",
            "Kreni u avanturu i stvori svoj vlastiti vrt iz snova!"
        ]
    },
    newDayMorning: {
        text: [
            "Novi dan je stigao, vrijeme je za zalijevanje biljaka i brigu o vrtu.",
            "Pogledaj svoje biljke i provjeri trebaju li zalijevanje ili neku drugu vrstu njege.",
            "Sretno! 🌻"
        ]
    },
    newDayAfternoon: {
        text: [
            "Sad je pravo vrijeme za obilazak vrta i brigu o svojim biljkama.",
            "Uživaj u predivnom danu! 🌞"
        ]
    },
    newDayEvening: {
        text: [
            "Danas je bio dug i naporan dan, ali još stigneš obići svoj vrt i provjeriti svoje biljke."
        ]
    },
}

export function WelcomeMessage() {
    const show = useMemo(() => {
        let showWelcomeMessage = false;
        const now = new Date();
        
        // Today 6am (yesterday if before 6am)
        const today6am = new Date(now);
        today6am.setHours(6, 0, 0, 0);
        if (now < today6am) {
            today6am.setDate(today6am.getDate() - 1);
        }

        const lastSeenStr = localStorage.getItem("welcomeMessageLastSeen");
        if (!lastSeenStr) {
            showWelcomeMessage = true;
        } else {
            const lastSeenDate = new Date(lastSeenStr);
            if (lastSeenDate < today6am && now >= today6am) {
                showWelcomeMessage = true;
            }
        }

        if (showWelcomeMessage) {
            localStorage.setItem("welcomeMessageLastSeen", today6am.toISOString());
        }

        return showWelcomeMessage;
    }, []);

    const [open, setOpen] = useState(show);
    const { resumeIfNeeded } = useGameAudio();
    function handleOpenChange(newOpen: boolean) {
        setOpen(newOpen);
        resumeIfNeeded();
    }

    const timeOfDay = useGameState(state => state.timeOfDay);
    const isDay = timeOfDay > 0.2 && timeOfDay < 0.8;
    const isMorning = timeOfDay < 0.5;
    const title = isDay ? (isMorning ? "Dobro jutro" : "Dobar dan!") : "Dobra večer!";

    let messageType: keyof typeof messageTypes;
    if (isDay) {
        messageType = isMorning ? "newDayMorning" : "newDayAfternoon";
    } else {
        messageType = "newDayEvening";
    }
    const messages = messageTypes[messageType];

    return (
        <Modal
            title={title}
            open={open}
            onOpenChange={handleOpenChange}
            className="max-w-screen-md border-tertiary border-b-4">
            <div className="grid md:grid-cols-2 [grid-template-areas:'sunflower'_'content'] md:[grid-template-areas:'content_sunflower'] md:p-4 gap-4">
                <Stack spacing={3} className="[grid-area:content]">
                    <Stack spacing={1.5}>
                        <Typography level="h2" gutterBottom>{title}</Typography>
                        {messages.text.map((text, index) => (
                            <Typography key={index} level="body1">{text}</Typography>
                        ))}
                    </Stack>
                    <Button variant="solid" endDecorator={<ChevronRight className="size-5 animate-pulse" />} onClick={() => handleOpenChange(false)}>Kreni u avanturu</Button>
                </Stack>
                <div className="w-full h-full rounded-3xl bg-card flex flex-row items-end justify-center [grid-area:sunflower]">
                    <div className="size-40 relative">
                        <img
                            src="https://cdn.gredice.com/sunflower-large.svg"
                            alt="Suncokret"
                             />
                    </div>
                </div>
            </div>
        </Modal>
    );
}