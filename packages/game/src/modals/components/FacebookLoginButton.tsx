import { Button, type ButtonProps } from '@gredice/ui/Button';
import { CompanyFacebook } from '@gredice/ui/icons';

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
