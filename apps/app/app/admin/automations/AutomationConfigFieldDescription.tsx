import { Typography } from '@gredice/ui/Typography';

export function AutomationConfigFieldDescription({
    children,
    id,
}: {
    children: string | undefined;
    id?: string;
}) {
    if (!children) {
        return null;
    }

    return (
        <Typography id={id} level="body3" className="text-muted-foreground">
            {children}
        </Typography>
    );
}
