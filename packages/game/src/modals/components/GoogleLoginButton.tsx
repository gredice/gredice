import { Button, type ButtonProps } from '@gredice/ui/Button';
import { cx } from '@gredice/ui/utils';
import { CompanyGoogle } from './CompanyGoogle';

export function GoogleLoginButton({ className, ...props }: ButtonProps) {
    return (
        <Button
            type="button"
            color="neutral"
            variant="outlined"
            className={cx(
                'bg-white text-black hover:bg-white/90 dark:text-black dark:hover:bg-white/80',
                className,
            )}
            fullWidth
            {...props}
        >
            <CompanyGoogle className="h-4 w-4 shrink-0" />
            Poveži Google račun
        </Button>
    );
}
