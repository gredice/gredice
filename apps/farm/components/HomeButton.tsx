import { Button } from '@gredice/ui/Button';
import { ArrowLeft } from '@gredice/ui/icons';

interface HomeButtonProps {
    className?: string;
    href?: string;
    title?: string;
}

export function HomeButton({
    className,
    href = '/',
    title = 'Povratak na početnu',
}: HomeButtonProps) {
    return (
        <Button
            aria-label={title}
            className={`aspect-square px-0 ${className ?? ''}`}
            href={href}
            title={title}
            variant="plain"
        >
            <ArrowLeft className="size-4 shrink-0" />
        </Button>
    );
}
