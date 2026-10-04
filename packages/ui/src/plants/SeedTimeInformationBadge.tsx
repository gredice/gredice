'use client';

import { useState } from 'react';
import { Chip } from '../Chip';
import { ThumbsUp } from '../icons';
import { Popper } from '../Popper';
import { Row } from '../Row';
import { Stack } from '../Stack';
import { Typography } from '../Typography';
import { cx } from '../utils';

export function SeedTimeInformationBadge({
    size = 'md',
}: {
    size?: 'sm' | 'md' | 'lg';
}) {
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
            trigger={
                <button type="button" onClick={handleTriggerClick}>
                    <Chip
                        size={size}
                        color="success"
                        className="cursor-default hover:bg-lime-400"
                    >
                        <ThumbsUp
                            className={cx(
                                size === 'sm' && 'size-3 shrink-0',
                                size === 'md' && 'size-4 shrink-0',
                                size === 'lg' && 'size-5 shrink-0',
                            )}
                        />
                        <span>Vrijeme za sijanje</span>
                    </Chip>
                </button>
            }
            className="p-6 min-w-96"
        >
            <Stack spacing={4}>
                <Row spacing={4}>
                    <ThumbsUp className="size-10 text-secondary-foreground" />
                    <Typography level="body2" semiBold>
                        &quot;Vrijeme za sijanje&quot; označava da je upravo sad
                        optimalno vrijeme za sjetvu.
                    </Typography>
                </Row>
                <Stack spacing={2}>
                    <Typography>
                        Prema kalendaru sjetve, sijanje ove biljke u gredicama
                        je preporučeno.
                    </Typography>
                    <Typography>
                        Ovaj period se može razlikovati ovisno o vremenskim
                        uvjetima i lokaciji, ali općenito označava da je vrijeme
                        za sjetvu ove biljke.
                    </Typography>
                    <Typography>
                        Biljke koje <strong>nemaju</strong> oznaku &quot;Vrijeme
                        za sijanje&quot; i dalje se mogu sijati ali će
                        vjerojatno zahtijevati dodatnu njegu i pažnju.
                    </Typography>
                </Stack>
            </Stack>
        </Popper>
    );
}
