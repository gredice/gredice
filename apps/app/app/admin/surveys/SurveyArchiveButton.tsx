'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { archiveSurveyByIdAction } from './actions';

export function SurveyArchiveButton({
    archived,
    surveyId,
    surveyKey,
    surveyTitle,
}: {
    archived: boolean;
    surveyId: string;
    surveyKey: string;
    surveyTitle: string;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<{
        message: string;
        success: boolean;
    } | null>(null);

    function archive() {
        startTransition(async () => {
            const next = await archiveSurveyByIdAction(surveyId);
            setResult({
                message: next.message ?? 'Radnja je završena.',
                success: next.success === true,
            });
            if (next.success) {
                router.refresh();
            }
        });
    }

    return (
        <Stack spacing={2}>
            <ModalConfirm
                confirmLabel="Arhiviraj anketu"
                expectedConfirm={surveyKey}
                header="Arhivirati anketu?"
                promptLabel={`Upiši „${surveyKey}” za potvrdu`}
                title={`Arhiviranje ankete ${surveyTitle}`}
                trigger={
                    <Button
                        color="danger"
                        disabled={archived || pending}
                        fullWidth
                        loading={pending}
                        type="button"
                        variant="outlined"
                    >
                        {archived ? 'Anketa je arhivirana' : 'Arhiviraj anketu'}
                    </Button>
                }
                onConfirm={archive}
            >
                <Typography level="body2">
                    Arhivirat će se anketa i sve njezine verzije. Postojeći
                    odgovori ostaju sačuvani za izvještavanje.
                </Typography>
            </ModalConfirm>
            {result ? (
                <Alert color={result.success ? 'success' : 'danger'}>
                    {result.message}
                </Alert>
            ) : null}
        </Stack>
    );
}
