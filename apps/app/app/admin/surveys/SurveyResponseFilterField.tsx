import type { ReactNode } from 'react';

export function SurveyResponseFilterField({
    children,
    htmlFor,
    label,
}: {
    children: ReactNode;
    htmlFor: string;
    label: string;
}) {
    return (
        <label className="min-w-0 space-y-1" htmlFor={htmlFor}>
            <span className="block text-sm font-medium text-foreground">
                {label}
            </span>
            {children}
        </label>
    );
}
