import { Button } from '@gredice/ui/Button';
import { ArrowLeft } from '@gredice/ui/icons';

interface HomeButtonProps {
    href?: string;
    title?: string;
}

export function HomeButton({
    href = '/',
    title = 'Povratak na početnu',
}: HomeButtonProps) {
    return (
        <Button
            aria-label={title}
            className="aspect-square px-0"
            href={href}
            title={title}
            variant="plain"
        >
            <ArrowLeft className="size-4 shrink-0" />
        </Button>
    );
}
