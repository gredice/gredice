import { Typography } from '@gredice/ui/Typography';

export function SurveyResponseJsonDetails({
    label,
    value,
}: {
    label: string;
    value: Record<string, unknown>;
}) {
    return (
        <div>
            <Typography semiBold>{label}</Typography>
            <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs">
                {JSON.stringify(value, null, 2)}
            </pre>
        </div>
    );
}
