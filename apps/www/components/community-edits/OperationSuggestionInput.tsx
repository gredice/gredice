import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Check, Delete } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    inputControlClassName,
    selectControlClassName,
    textareaControlClassName,
} from './communityControlStyles';
import {
    availableOperationOptions,
    type CommunityEditableField,
    currentOperationOptions,
    emptyOperationSuggestionValue,
    type FieldValue,
    isOperationSuggestionValue,
    type OperationSuggestionMode,
} from './communityEditFields';
import { communitySourceMaxLength } from './communitySuggestionUtils';
import { OperationOptionSummary } from './OperationOptionSummary';

export function OperationSuggestionInput({
    field,
    id,
    onChange,
    value,
}: {
    field: CommunityEditableField;
    id: string;
    onChange: (value: FieldValue) => void;
    value: FieldValue;
}) {
    const suggestionValue = isOperationSuggestionValue(value)
        ? value
        : emptyOperationSuggestionValue;
    const currentOperations = currentOperationOptions(field);
    const availableOperations = availableOperationOptions(field);
    const selectedExistingOperation = availableOperations.find(
        (option) => option.value === suggestionValue.operationId,
    );
    const selectedRemovalOperation = currentOperations.find(
        (option) => option.value === suggestionValue.operationId,
    );
    const operationModeOptions: {
        value: OperationSuggestionMode;
        label: string;
    }[] = [
        { value: 'existing', label: 'Postojeća radnja' },
        { value: 'new', label: 'Nova radnja' },
    ];

    return (
        <Stack spacing={4}>
            <section className="flex flex-col gap-2">
                <Typography level="body3" semiBold>
                    Trenutne radnje
                </Typography>
                {currentOperations.length > 0 ? (
                    <Stack spacing={2}>
                        {currentOperations.map((option) => {
                            const selected =
                                suggestionValue.intent === 'remove' &&
                                suggestionValue.operationId === option.value;
                            return (
                                <div
                                    className={cx(
                                        'grid gap-3 rounded-md border border-border/80 bg-card p-3 shadow-sm sm:grid-cols-[1fr_auto]',
                                        selected && 'border-primary/70',
                                    )}
                                    key={option.value}
                                >
                                    <OperationOptionSummary option={option} />
                                    <Button
                                        color={selected ? 'primary' : 'danger'}
                                        onClick={() =>
                                            onChange({
                                                ...suggestionValue,
                                                intent: 'remove',
                                                operationMode: 'existing',
                                                operationId: option.value,
                                            })
                                        }
                                        type="button"
                                        variant={selected ? 'soft' : 'outlined'}
                                    >
                                        {selected ? (
                                            <Check
                                                aria-hidden
                                                className="size-4"
                                            />
                                        ) : (
                                            <Delete
                                                aria-hidden
                                                className="size-4"
                                            />
                                        )}
                                        {selected ? 'Odabrano' : 'Ukloni'}
                                    </Button>
                                </div>
                            );
                        })}
                    </Stack>
                ) : (
                    <Typography
                        level="body3"
                        className="rounded-md border border-dashed border-border/80 bg-card p-3 text-muted-foreground"
                    >
                        Nema trenutno povezanih radnji za ovu fazu.
                    </Typography>
                )}
                {selectedRemovalOperation ? (
                    <Typography level="body3" className="text-primary">
                        Prijedlog će tražiti uklanjanje radnje “
                        {selectedRemovalOperation.label}”.
                    </Typography>
                ) : null}
            </section>

            <section className="flex flex-col gap-3 rounded-md border border-border/70 bg-card p-3">
                <Typography level="body3" semiBold>
                    Predloži dodavanje
                </Typography>
                <div className="grid grid-cols-2 gap-1 rounded-md border border-border/80 bg-background p-1 shadow-sm">
                    {operationModeOptions.map((option) => (
                        <label
                            className={cx(
                                'flex min-h-9 cursor-pointer items-center justify-center rounded-sm px-3 text-center text-sm font-medium transition-colors',
                                suggestionValue.intent === 'add' &&
                                    suggestionValue.operationMode ===
                                        option.value
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                            )}
                            key={option.value}
                        >
                            <input
                                checked={
                                    suggestionValue.intent === 'add' &&
                                    suggestionValue.operationMode ===
                                        option.value
                                }
                                className="sr-only"
                                name={`${id}-operation-mode`}
                                onChange={() =>
                                    onChange({
                                        ...suggestionValue,
                                        intent: 'add',
                                        operationMode: option.value,
                                        operationId:
                                            option.value === 'new'
                                                ? ''
                                                : suggestionValue.operationId,
                                    })
                                }
                                type="radio"
                                value={option.value}
                            />
                            {option.label}
                        </label>
                    ))}
                </div>

                {suggestionValue.intent !== 'add' ||
                suggestionValue.operationMode === 'existing' ? (
                    <Stack spacing={2}>
                        <label
                            className="flex flex-col gap-1"
                            htmlFor={`${id}-operation`}
                        >
                            <Typography level="body3">Radnja</Typography>
                            <select
                                className={selectControlClassName}
                                disabled={availableOperations.length === 0}
                                id={`${id}-operation`}
                                onChange={(event) =>
                                    onChange({
                                        ...suggestionValue,
                                        intent: 'add',
                                        operationMode: 'existing',
                                        operationId: event.currentTarget.value,
                                    })
                                }
                                value={
                                    availableOperations.some(
                                        (option) =>
                                            option.value ===
                                            suggestionValue.operationId,
                                    )
                                        ? suggestionValue.operationId
                                        : ''
                                }
                            >
                                <option value="">
                                    {availableOperations.length > 0
                                        ? 'Odaberi radnju'
                                        : 'Nema dostupnih radnji'}
                                </option>
                                {availableOperations.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {selectedExistingOperation ? (
                            <div className="rounded-md border border-border/80 bg-background p-3">
                                <OperationOptionSummary
                                    option={selectedExistingOperation}
                                />
                            </div>
                        ) : (
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                {availableOperations.length > 0
                                    ? 'Odaberi postojeću radnju koju želiš dodati.'
                                    : 'Sve postojeće radnje za ovu fazu već su povezane.'}
                            </Typography>
                        )}
                    </Stack>
                ) : (
                    <Stack spacing={3}>
                        <Input
                            className={inputControlClassName}
                            fullWidth
                            id={`${id}-new-operation-name`}
                            label="Naziv nove radnje"
                            onChange={(event) =>
                                onChange({
                                    ...suggestionValue,
                                    intent: 'add',
                                    operationMode: 'new',
                                    newOperationName: event.currentTarget.value,
                                })
                            }
                            placeholder="Npr. Provjera vlage supstrata"
                            value={suggestionValue.newOperationName}
                        />
                        <label
                            className="flex flex-col gap-1"
                            htmlFor={`${id}-new-operation-description`}
                        >
                            <Typography level="body3">
                                Što očekuješ od radnje?
                            </Typography>
                            <textarea
                                className={cx(
                                    textareaControlClassName,
                                    'min-h-24',
                                )}
                                id={`${id}-new-operation-description`}
                                onChange={(event) =>
                                    onChange({
                                        ...suggestionValue,
                                        intent: 'add',
                                        operationMode: 'new',
                                        newOperationDescription:
                                            event.currentTarget.value,
                                    })
                                }
                                placeholder="Opiši kada se radi, što korisnik dobiva i zašto pripada ovoj fazi."
                                value={suggestionValue.newOperationDescription}
                            />
                        </label>
                    </Stack>
                )}
            </section>

            <Input
                className={inputControlClassName}
                fullWidth
                id={`${id}-source`}
                label="Izvor za radnju (opcionalno)"
                maxLength={communitySourceMaxLength}
                onChange={(event) =>
                    onChange({
                        ...suggestionValue,
                        source: event.currentTarget.value,
                    })
                }
                placeholder="Poveznica, knjiga ili vlastito iskustvo"
                value={suggestionValue.source}
            />
            <label className="flex flex-col gap-1" htmlFor={`${id}-note`}>
                <Typography level="body3">
                    Napomena uz radnju (opcionalno)
                </Typography>
                <textarea
                    className={cx(textareaControlClassName, 'min-h-20')}
                    id={`${id}-note`}
                    onChange={(event) =>
                        onChange({
                            ...suggestionValue,
                            note: event.currentTarget.value,
                        })
                    }
                    placeholder="Zašto predlažeš ovu promjenu?"
                    value={suggestionValue.note}
                />
            </label>
        </Stack>
    );
}
