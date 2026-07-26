export function SurveyTextAreaField({
    defaultValue = '',
    label,
    name,
}: {
    defaultValue?: string;
    label: string;
    name: string;
}) {
    return (
        <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">
                {label}
            </span>
            <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                defaultValue={defaultValue}
                name={name}
            />
        </label>
    );
}
