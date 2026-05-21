'use client';

import { clientPublic } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Send, SmileHappy, SmileMeh, SmileSad } from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useState } from 'react';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import {
    FeedbackTrigger,
    type FeedbackTriggerProps,
} from './FeedbackTriggerLike';

export type FeedbackModalProps = {
    title?: string;
    topic: string;
    data?: Record<
        string,
        string | string[] | number | number[] | boolean | null | undefined
    >;
} & Omit<FeedbackTriggerProps, 'onFeedback' | 'onClick'>;

export function FeedbackModal({
    title,
    topic,
    data,
    ...rest
}: FeedbackModalProps) {
    const [open, setOpen] = useState(false);
    const [score, setScore] = useState<'like' | 'dislike' | 'neutral' | null>(
        null,
    );
    const { data: user } = useCurrentUser();

    async function handleFeedback(formData: FormData) {
        const comment = formData.get('comment') as string;
        await clientPublic().api.feedback.$post({
            json: {
                topic,
                data: user
                    ? {
                          ...(data ?? {}),
                          userId: user.id,
                      }
                    : data,
                score: (score === 'like'
                    ? 1
                    : score === 'dislike'
                      ? -1
                      : 0
                ).toString(),
                comment,
            },
        });

        // TODO: Show notification feedback was submitted

        setScore(null);
        setOpen?.(false);
    }

    function handleDisplay(feedback: 'like' | 'dislike') {
        setScore(feedback);
    }

    return (
        <Popper
            open={open}
            title={title ?? 'Tvoje mišljenje'}
            onOpenChange={setOpen}
            trigger={<FeedbackTrigger onFeedback={handleDisplay} {...rest} />}
        >
            <form action={handleFeedback}>
                <Stack spacing={4} className="p-4">
                    <Typography level="body1" secondary>
                        Kako ti se sviđa ovaj sadržaj?
                    </Typography>
                    <Row spacing={1} justifyContent="center">
                        <IconButton
                            type="button"
                            variant="plain"
                            className={cx(
                                score === 'dislike' &&
                                    'bg-red-200 text-red-800',
                            )}
                            title="Ne sviđa mi se"
                            onClick={() => setScore('dislike')}
                        >
                            <SmileSad />
                        </IconButton>
                        <IconButton
                            type="button"
                            variant="plain"
                            className={cx(
                                score === 'neutral' &&
                                    'bg-neutral-200 text-neutral-800',
                            )}
                            title="Ne znam"
                            onClick={() => setScore('neutral')}
                        >
                            <SmileMeh />
                        </IconButton>
                        <IconButton
                            type="button"
                            variant="plain"
                            className={cx(
                                score === 'like' &&
                                    'bg-green-200 text-green-800',
                            )}
                            title="Sviđa mi se"
                            onClick={() => setScore('like')}
                        >
                            <SmileHappy />
                        </IconButton>
                    </Row>
                    <Input
                        name="comment"
                        placeholder="Komentar"
                        autoFocus={score !== 'neutral'}
                    />
                    <Button
                        variant="outlined"
                        type="submit"
                        endDecorator={<Send className="size-4" />}
                    >
                        Pošalji
                    </Button>
                </Stack>
            </form>
        </Popper>
    );
}
