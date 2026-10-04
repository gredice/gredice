import { CompanyFacebook } from '@gredice/ui/icons';
import { SocialCard } from './SocialCard';

export function FacebookCard() {
    return (
        <SocialCard
            href="https://gredice.link/fb"
            ctaText="Prati nas na Facebooku"
            icon={<CompanyFacebook className="size-9 fill-white text-white" />}
            bgColor="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-950 dark:border-blue-800 dark:from-blue-950 dark:to-cyan-950 dark:text-blue-100"
            bgIconColor="bg-[#1877F2]"
            navigateIconColor="text-blue-600 dark:text-blue-300"
        />
    );
}
