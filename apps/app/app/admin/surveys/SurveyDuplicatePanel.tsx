'use client';

import type { SelectSurveyVersion } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState, useTransition } from 'react';
import { KnownPages } from '../../../src/KnownPages';
import { duplicateSurveyDefinitionAction } from './actions';

export function SurveyDuplicatePanel({
    surveyId,
    surveyKey,
    surveyTitle,
    versions,
}: {
    surveyId: string;
    surveyKey: string;
    surveyTitle: string;
    versions: SelectSurveyVersion[];
}) {
    const [key, setKey] = useState(`${surveyKey}_copy`);
    const [title, setTitle] = useState(`${surveyTitle} — kopija`);
    const [versionId, setVersionId] = useState(versions[0]?.id ?? '');
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<{
        message: string;
        surveyId?: string;
        success: boolean;
    } | null>(null);
    const normalizedKey = key.trim();
    const normalizedTitle = title.trim();

    function duplicate() {
        startTransition(async () => {
            const next = await duplicateSurveyDefinitionAction({
                sourceSurveyId: surveyId,
                sourceVersionId: versionId,
                key: normalizedKey,
                title: normalizedTitle,
            });
            setResult({
                message: next.message ?? 'Radnja je završena.',
                surveyId: next.surveyId,
                success: next.success === true,
            });
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Dupliciraj anketu</CardTitle>
            </CardHeader>
            <CardContent>
                <Stack spacing={3}>
                    <Typography level="body2" secondary>
                        Kopira definiciju odabrane verzije u novu anketu v1.
                        Slanja, dodjele i odgovori se ne kopiraju.
                    </Typography>
                    <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">
                            Izvorna verzija
                        </span>
                        <select
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                            value={versionId}
                            onChange={(event) =>
                                setVersionId(event.target.value)
                            }
                        >
                            {versions.map((version) => (
                                <option key={version.id} value={version.id}>
                                    v{version.versionNumber} · {version.title}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Input
                        fullWidth
                        label="Ključ nove ankete"
                        value={key}
                        onChange={(event) => setKey(event.target.value)}
                    />
                    <Input
                        fullWidth
                        label="Naziv nove ankete"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                    />
                    <ModalConfirm
                        confirmLabel="Stvori novi nacrt"
                        expectedConfirm={normalizedKey || '__missing_key__'}
                        header="Duplicirati anketu?"
                        promptLabel={`Upiši „${normalizedKey || 'ključ nove ankete'}” za potvrdu`}
                        title={`Dupliciranje iz ankete ${surveyTitle}`}
                        trigger={
                            <Button
                                disabled={
                                    pending ||
                                    !normalizedKey ||
                                    !normalizedTitle ||
                                    !versionId
                                }
                                fullWidth
                                loading={pending}
                                type="button"
                                variant="outlined"
                            >
                                Dupliciraj u novi nacrt
                            </Button>
                        }
                        onConfirm={duplicate}
                    >
                        <Typography level="body2">
                            Izvor ostaje nepromijenjen. Odredište će imati novi
                            identitet, autora i životni ciklus.
                        </Typography>
                    </ModalConfirm>
                    {result ? (
                        <Alert color={result.success ? 'success' : 'danger'}>
                            <Stack spacing={2}>
                                <Typography level="body2">
                                    {result.message}
                                </Typography>
                                {result.success && result.surveyId ? (
                                    <Button
                                        href={KnownPages.Survey(
                                            result.surveyId,
                                        )}
                                        size="sm"
                                        variant="outlined"
                                    >
                                        Otvori novi nacrt
                                    </Button>
                                ) : null}
                            </Stack>
                        </Alert>
                    ) : null}
                </Stack>
            </CardContent>
        </Card>
    );
}
