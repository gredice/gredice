import { Button, type ButtonProps } from '@signalco/ui-primitives/Button';
import { CompanyGoogle } from './CompanyGoogle';

export function GoogleLoginButton({ ...props }: ButtonProps) {
    return (
        <Button
            type="button"
            variant="outlined"
            className="bg-white dark:bg-black"
            fullWidth
            {...props}
        >
            <CompanyGoogle className="mr-2 h-4 w-4" />
            Poveži Google račun
        </Button>
    );
}
