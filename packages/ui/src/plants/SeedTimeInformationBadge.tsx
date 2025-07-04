'use client';

import { Chip } from "@signalco/ui-primitives/Chip";
import { Popper } from "@signalco/ui-primitives/Popper";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ThumbsUp } from "@signalco/ui-icons";
import { cx } from "@signalco/ui-primitives/cx";
import { useState } from "react";

export function SeedTimeInformationBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
    const [open, setOpen] = useState(false);
    function handleTriggerClick(e: React.MouseEvent<HTMLButtonElement>) {
        e.stopPropagation();
        e.preventDefault();
        setOpen((prev) => !prev);
    }

    return (
        <Popper
            open={open}
            onOpenChange={setOpen}
            trigger={(
                <button onClick={handleTriggerClick}>
                    <Chip size={size} color="success" className="cursor-default hover:bg-lime-400">
                        <ThumbsUp className={cx(
                            size === "sm" && "size-3 shrink-0",
                            size === "md" && "size-4 shrink-0",
                            size === "lg" && "size-5 shrink-0"
                        )} />
                        <span>Vrijeme za sijanje</span>
                    </Chip>
                </button>
            )}
            className="p-6 min-w-96"
        >
            <Stack spacing={2}>
                <Row spacing={2}>
                    <ThumbsUp className="size-10 text-secondary-foreground" />
                    <Typography level="body2" semiBold>&quot;Vrijeme za sijanje&quot; označava da trenutno vrijeme optimalno za sjetvu.</Typography>
                </Row>
                <Stack spacing={1}>
                    <Typography>
                        Prema kalendaru sjetve, trenutno je sijanje ove biljke u gredicama preporučeno.
                    </Typography>
                    <Typography>
                        Ovaj period se može razlikovati ovisno o vremenskim uvjetima i lokaciji, ali općenito označava da je vrijeme za početak rasta biljke.
                    </Typography>
                    <Typography>
                        Biljke koje <strong>nemaju</strong> oznaku &quot;Vrijeme za sijanje&quot; i dalje se mogu sijati ali će vjerojatno zahtijevati dodatnu njegu i pažnju.
                    </Typography>
                </Stack>
            </Stack>
        </Popper>
    );
}