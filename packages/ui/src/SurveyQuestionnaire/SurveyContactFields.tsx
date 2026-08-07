import type { SurveyContactValue } from './types';

function contactFieldLabel(field: string) {
    return (
        {
            email: 'Email',
            first_name: 'Ime',
            last_name: 'Prezime',
            phone: 'Telefon',
        }[field] ?? field
    );
}

function contactFieldKey(field: string): keyof SurveyContactValue {
    if (field === 'first_name') return 'firstName';
    if (field === 'last_name') return 'lastName';
    if (field === 'phone') return 'phone';
    return 'email';
}

export function SurveyContactFields({
    fields,
    onChange,
    value,
}: {
    fields: Array<'first_name' | 'last_name' | 'phone' | 'email'>;
    onChange: (value: SurveyContactValue) => void;
    value: SurveyContactValue;
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => {
                const key = contactFieldKey(field);
                return (
                    <label className="space-y-1" key={field}>
                        <span className="block text-sm font-medium text-foreground">
                            {contactFieldLabel(field)}
                        </span>
                        <input
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                            type={field === 'email' ? 'email' : 'text'}
                            value={value[key] ?? ''}
                            onChange={(event) =>
                                onChange({
                                    ...value,
                                    [key]: event.target.value,
                                })
                            }
                        />
                    </label>
                );
            })}
        </div>
    );
}
