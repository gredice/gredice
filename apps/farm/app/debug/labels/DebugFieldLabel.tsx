import { Typography } from '@signalco/ui-primitives/Typography';

interface DebugFieldLabelProps {
    title: string;
    description?: string;
}

export function DebugFieldLabel({ title, description }: DebugFieldLabelProps) {
    return (
        <div className="space-y-1">
            <Typography level="body2" semiBold>
                {title}
            </Typography>
            {description && (
                <Typography level="body2" className="text-muted-foreground">
                    {description}
                </Typography>
            )}
        </div>
    );
}
