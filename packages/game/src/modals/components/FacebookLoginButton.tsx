import { CompanyFacebook } from '@signalco/ui-icons';
import { Button, type ButtonProps } from '@signalco/ui-primitives/Button';

export function FacebookLoginButton({ ...props }: ButtonProps) {
    return (
        <Button
            type="button"
            variant="outlined"
            className="bg-white dark:bg-blue-900"
            fullWidth
            {...props}
        >
            <CompanyFacebook className="mr-2" />
            Poveži Facebook račun
        </Button>
    );
}
