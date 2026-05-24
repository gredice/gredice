import { Button, type ButtonProps } from '@gredice/ui/Button';
import { CompanyFacebook } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';

export function FacebookLoginButton({ className, ...props }: ButtonProps) {
    return (
        <Button
            type="button"
            color="neutral"
            variant="outlined"
            className={cx(
                'border-transparent bg-[#1877F2] text-white hover:bg-[#166FE5] dark:border-transparent dark:bg-blue-900 dark:text-white dark:hover:bg-blue-800',
                className,
            )}
            fullWidth
            {...props}
        >
            <CompanyFacebook className="size-4 shrink-0" />
            Poveži Facebook račun
        </Button>
    );
}
