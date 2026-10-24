'use client';

import { clientAuthenticated, directoriesClient } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Send } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useId, useState } from 'react';
import type { CommunitySuggestionPlantOption } from './CommunityEntitySuggestionButton';
import {
    inputControlClassName,
    referenceControlClassName,
    textareaControlClassName,
} from './communityControlStyles';
import { errorMessage, isSubmitResponse } from './communitySuggestionUtils';
import { PlantReferencePicker } from './PlantReferencePicker';

export function ExistingPlantHealthSuggestionForm({
    kind,
    plants,
    defaultAffectedPlantId,
    publicPath,
    onSuccess,
}: {
    kind: 'disease' | 'pest';
    plants: CommunitySuggestionPlantOption[];
    defaultAffectedPlantId?: number;
    publicPath: string;
    onSuccess: (requestId: number) => void;
}) {
    const id = useId();
    const entityType = kind === 'disease' ? 'plantDisease' : 'plantPest';
    const [issueId, setIssueId] = useState('');
    const [affectedPlantIds, setAffectedPlantIds] = useState<string[]>(() =>
        defaultAffectedPlantId ? [String(defaultAffectedPlantId)] : [],
    );
    const [source, setSource] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const issues = useQuery({
        queryKey: ['community-plant-health-options', kind],
        queryFn: async () => {
            const response = await directoriesClient().GET(
                kind === 'disease'
                    ? '/entities/plantDisease'
                    : '/entities/plantPest',
            );
            if (!response.response.ok || !response.data) {
                throw new Error('Učitavanje postojećih zapisa nije uspjelo.');
            }
            return response.data;
        },
    });
    const availableIssues = (issues.data ?? []).filter(
        (issue) =>
            affectedPlantIds.length === 0 ||
            affectedPlantIds.some(
                (plantId) =>
                    !issue.relationships?.affectedPlants?.some(
                        (plant) => String(plant.id) === plantId,
                    ),
            ),
    );
    const selectedIssue = availableIssues.find(
        (issue) => String(issue.id) === issueId,
    );
    const options = availableIssues
        .map((issue) => ({
            value: String(issue.id),
            label: issue.information.label || issue.information.name,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'hr'));

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (isSubmitting) return;
        setError(null);
        setIsSubmitting(true);
        try {
            if (!selectedIssue || affectedPlantIds.length === 0) {
                throw new Error('Odaberi zapis i barem jednu pogođenu biljku.');
            }
            const edits =
                clientAuthenticated().api.directories['community-edits'];
            // Read the latest relationship before adding to it. The hash protects
            // changes between this read, submission and administrator approval.
            const fieldsResponse = await edits.entities[':entityType'][
                ':entityId'
            ].fields.$get({
                param: { entityType, entityId: issueId },
                query: { sectionKey: 'relationships' },
            });
            if (!fieldsResponse.ok) {
                throw new Error(errorMessage(await fieldsResponse.json()));
            }
            const fields = await fieldsResponse.json();
            const field = fields.fields.find(
                (candidate) =>
                    candidate.fieldKey === `${entityType}.affected-plants`,
            );
            if (!field?.baseValueHash) {
                throw new Error(
                    'Povezivanje trenutačno nije dostupno. Pokušaj ponovno.',
                );
            }
            const currentIds: unknown = field.currentValue
                ? JSON.parse(field.currentValue)
                : [];
            if (
                !Array.isArray(currentIds) ||
                !currentIds.every(
                    (value): value is string | number =>
                        (typeof value === 'string' ||
                            typeof value === 'number') &&
                        /^\d+$/.test(String(value)),
                )
            ) {
                throw new Error(
                    'Pogođene biljke nije moguće učitati. Pokušaj ponovno.',
                );
            }
            const previousIds = currentIds.map(String);
            const proposedIds = [
                ...new Set([...previousIds, ...affectedPlantIds]),
            ];
            if (proposedIds.length === previousIds.length) {
                throw new Error(
                    'Odabrani zapis već je povezan s odabranim biljkama.',
                );
            }
            const response = await edits.$post({
                json: {
                    entityTypeName: entityType,
                    entityId: selectedIssue.id,
                    publicPath,
                    sectionKey: 'relationships',
                    submitterNote:
                        [
                            source.trim() ? `Izvor: ${source.trim()}` : '',
                            note.trim(),
                        ]
                            .filter(Boolean)
                            .join('\n\n') || null,
                    changes: [
                        {
                            fieldKey: field.fieldKey,
                            proposedValue: proposedIds,
                            baseValueHash: field.baseValueHash,
                        },
                    ],
                },
            });
            if (!response.ok) {
                throw new Error(errorMessage(await response.json()));
            }
            const result: unknown = await response.json();
            if (!isSubmitResponse(result)) {
                throw new Error('Slanje prijedloga nije uspjelo.');
            }
            onSuccess(result.requestId);
        } catch (submitError) {
            setError(errorMessage(submitError));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <fieldset className="min-w-0 space-y-4" disabled={isSubmitting}>
                {defaultAffectedPlantId ? (
                    <Typography level="body2">
                        Povezivanje s biljkom:{' '}
                        {
                            plants.find(
                                (plant) =>
                                    plant.value ===
                                    String(defaultAffectedPlantId),
                            )?.label
                        }
                        . Bolesti i štetnici biljke prikazuju se i na njezinim
                        sortama.
                    </Typography>
                ) : (
                    <div className="space-y-1">
                        <label
                            htmlFor={`${id}-plants`}
                            className="text-sm font-medium"
                        >
                            Pogođene biljke
                        </label>
                        <PlantReferencePicker
                            id={`${id}-plants`}
                            label="Pogođene biljke"
                            options={plants}
                            selectedValues={affectedPlantIds}
                            onValueChange={setAffectedPlantIds}
                        />
                    </div>
                )}
                {issues.isPending ? (
                    <Typography role="status" level="body2">
                        Učitavam postojeće zapise...
                    </Typography>
                ) : issues.isError ? (
                    <div className="space-y-2">
                        <Typography role="alert" level="body2">
                            Učitavanje postojećih zapisa nije uspjelo.
                        </Typography>
                        <Button
                            type="button"
                            variant="outlined"
                            disabled={issues.isFetching}
                            onClick={() => void issues.refetch()}
                        >
                            Pokušaj ponovno
                        </Button>
                    </div>
                ) : options.length === 0 ? (
                    <Typography role="status" level="body2">
                        Nema nepovezanih zapisa za odabrane biljke. Možeš
                        predložiti novi zapis.
                    </Typography>
                ) : (
                    <SelectItems
                        className={referenceControlClassName}
                        id={`${id}-issue`}
                        label={
                            kind === 'disease'
                                ? 'Postojeća bolest'
                                : 'Postojeći štetnik'
                        }
                        placeholder={
                            kind === 'disease'
                                ? 'Odaberi bolest'
                                : 'Odaberi štetnika'
                        }
                        items={options}
                        value={selectedIssue ? issueId : ''}
                        onValueChange={setIssueId}
                        searchable
                        searchPlaceholder={
                            kind === 'disease'
                                ? 'Pretraži bolesti...'
                                : 'Pretraži štetnike...'
                        }
                        emptySearchText="Nema zapisa za taj pojam."
                    />
                )}
                {selectedIssue?.information.shortDescription ? (
                    <Typography level="body2" className="text-muted-foreground">
                        {selectedIssue.information.shortDescription}
                    </Typography>
                ) : null}
                <Input
                    className={inputControlClassName}
                    fullWidth
                    label="Izvor ili poveznica (opcionalno)"
                    maxLength={500}
                    value={source}
                    onChange={(event) => setSource(event.currentTarget.value)}
                />
                <label className="block space-y-1" htmlFor={`${id}-note`}>
                    <Typography level="body2">
                        Napomena za administratora (opcionalno)
                    </Typography>
                    <textarea
                        className={cx(textareaControlClassName, 'min-h-20')}
                        id={`${id}-note`}
                        maxLength={1000}
                        value={note}
                        onChange={(event) => setNote(event.currentTarget.value)}
                    />
                </label>
            </fieldset>
            {error ? (
                <Typography role="alert" level="body2" className="text-red-700">
                    {error}
                </Typography>
            ) : null}
            <Row justifyContent="end">
                <Button
                    type="submit"
                    disabled={
                        isSubmitting ||
                        issues.isPending ||
                        issues.isError ||
                        !selectedIssue ||
                        affectedPlantIds.length === 0
                    }
                    endDecorator={<Send className="size-4" />}
                >
                    {isSubmitting ? 'Šaljem...' : 'Pošalji'}
                </Button>
            </Row>
        </form>
    );
}
