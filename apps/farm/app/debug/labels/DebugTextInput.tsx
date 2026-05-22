import { Typography } from '@gredice/ui/Typography';

interface DebugTextInputProps {
    label: string;
    value: string | number;
    onChange: (value: string) => void;
    type?: 'text' | 'number';
    step?: number;
    min?: number;
}

export function DebugTextInput({
    label,
    value,
    onChange,
    type = 'text',
    step,
    min,
}: DebugTextInputProps) {
    return (
        <label className="space-y-1.5">
            <Typography level="body2" semiBold>
                {label}
            </Typography>
            <input
                type={type}
                value={value}
                step={step}
                min={min}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-hidden transition focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
        </label>
    );
}
