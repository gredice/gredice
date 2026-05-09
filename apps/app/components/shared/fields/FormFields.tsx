import type { ReactNode } from 'react';
import { Field } from './Field';
import { FieldSet } from './FieldSet';

type FormFieldDefinition = {
    name: string;
    value: ReactNode | string | number | boolean | Date | null | undefined;
    mono?: boolean;
};

export function FormFields({ fields }: { fields: FormFieldDefinition[] }) {
    if (fields.length === 0) {
        return null;
    }

    return (
        <FieldSet>
            {fields.map(({ name, value, mono }) => (
                <Field key={name} name={name} value={value} mono={mono} />
            ))}
        </FieldSet>
    );
}
