import { CompanyInstagram } from '@gredice/ui/PublicChrome';
import { SocialCard } from './SocialCard';

export function InstagramCard() {
    return (
        <SocialCard
            href="https://gredice.link/ig"
            ctaText="Prati nas na Instagramu"
            icon={<CompanyInstagram className="size-9 text-white" />}
            bgColor="border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 text-rose-950 dark:border-rose-800 dark:from-rose-950 dark:to-orange-950 dark:text-rose-100"
            bgIconColor="bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]"
            navigateIconColor="text-orange-500 dark:text-orange-300"
        />
    );
}
