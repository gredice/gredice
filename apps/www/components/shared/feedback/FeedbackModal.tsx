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
import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import {
    FeedbackTrigger,
    type FeedbackTriggerProps,
} from './FeedbackTriggerLike';

type FeedbackScore = 'like' | 'dislike' | 'neutral';

type FeedbackUpdate = {
    score: FeedbackScore;
    comment?: string;
};

function feedbackScoreValue(score: FeedbackScore) {
    if (score === 'like') {
        return '1';
    }
    if (score === 'dislike') {
        return '-1';
    }
    return '0';
}

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
    const [score, setScore] = useState<FeedbackScore | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(false);
    const { data: user } = useCurrentUser();
    const feedbackIdRef = useRef<string | null>(null);
    const requestQueueRef = useRef(Promise.resolve());
    const requestVersionRef = useRef(0);
    const interactionKeyRef = useRef(0);
    const dataRef = useRef(data);
    const userRef = useRef(user);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    function feedbackData() {
        const currentData = dataRef.current;
        const currentUser = userRef.current;

        if (!currentUser) {
            return currentData;
        }

        return {
            ...(currentData ?? {}),
            userId: currentUser.id,
        };
    }

    function resetFeedbackInteraction() {
        interactionKeyRef.current += 1;
        feedbackIdRef.current = null;
        requestQueueRef.current = Promise.resolve();
        setIsSubmitting(false);
        setSubmitError(false);
        setScore(null);
    }

    async function persistFeedback(
        update: FeedbackUpdate,
        interactionKey: number,
    ) {
        if (interactionKey !== interactionKeyRef.current) {
            return true;
        }

        const scoreValue = feedbackScoreValue(update.score);
        const feedbackId = feedbackIdRef.current;

        if (feedbackId) {
            const response = await clientPublic().api.feedback[
                ':feedbackId'
            ].$patch({
                param: { feedbackId },
                json: {
                    score: scoreValue,
                    comment: update.comment,
                },
            });

            if (!response.ok) {
                throw new Error(`Feedback update failed: ${response.status}`);
            }

            return true;
        }

        const response = await clientPublic().api.feedback.$post({
            json: {
                topic,
                data: feedbackData(),
                score: scoreValue,
                comment: update.comment,
            },
        });

        if (!response.ok) {
            throw new Error(`Feedback create failed: ${response.status}`);
        }

        const body = await response.json();
        if (interactionKey === interactionKeyRef.current) {
            feedbackIdRef.current = body.id;
        }

        return true;
    }

    function queueFeedback(update: FeedbackUpdate) {
        const interactionKey = interactionKeyRef.current;
        const requestVersion = requestVersionRef.current + 1;
        requestVersionRef.current = requestVersion;
        setIsSubmitting(true);
        setSubmitError(false);

        const request = requestQueueRef.current
            .catch(() => undefined)
            .then(async () => {
                try {
                    return await persistFeedback(update, interactionKey);
                } catch (error) {
                    console.error(error);
                    if (interactionKey === interactionKeyRef.current) {
                        setSubmitError(true);
                    }
                    return false;
                }
            });

        requestQueueRef.current = request.then(() => undefined);
        void request.finally(() => {
            if (requestVersionRef.current === requestVersion) {
                setIsSubmitting(false);
            }
        });

        return request;
    }

    async function handleFeedback(formData: FormData) {
        const commentValue = formData.get('comment');
        const comment = typeof commentValue === 'string' ? commentValue : '';
        const submitted = await queueFeedback({
            score: score ?? 'neutral',
            comment,
        });

        if (!submitted) {
            return;
        }

        // TODO: Show notification feedback was submitted

        resetFeedbackInteraction();
        setOpen(false);
    }

    function handleDisplay(feedback: 'like' | 'dislike') {
        setScore(feedback);
        void queueFeedback({ score: feedback });
    }

    function handleModalScoreChange(feedback: FeedbackScore) {
        setScore(feedback);
        void queueFeedback({ score: feedback });
    }

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (!nextOpen) {
            resetFeedbackInteraction();
        }
    }

    return (
        <Popper
            open={open}
            title={title ?? 'Tvoje mišljenje'}
            onOpenChange={handleOpenChange}
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
                            onClick={() => handleModalScoreChange('dislike')}
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
                            onClick={() => handleModalScoreChange('neutral')}
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
                            onClick={() => handleModalScoreChange('like')}
                        >
                            <SmileHappy />
                        </IconButton>
                    </Row>
                    <Input
                        name="comment"
                        placeholder="Komentar"
                        autoFocus={score !== 'neutral'}
                    />
                    {submitError ? (
                        <Typography level="body2" className="text-red-700">
                            Nismo uspjeli spremiti mišljenje. Pokušaj ponovno.
                        </Typography>
                    ) : null}
                    <Button
                        variant="outlined"
                        type="submit"
                        disabled={isSubmitting}
                        endDecorator={<Send className="size-4" />}
                    >
                        Pošalji
                    </Button>
                </Stack>
            </form>
        </Popper>
    );
}
