import { CompanyWhatsApp } from '@gredice/ui/PublicChrome';
import { SocialCard } from './SocialCard';

export function WhatsAppCard() {
    return (
        <SocialCard
            href="https://gredice.link/wa"
            ctaText="Pridruži se našoj WhatsApp zajednici"
            icon={<CompanyWhatsApp className="size-9 text-white" />}
            bgColor="border-green-200 bg-gradient-to-br from-green-50 to-emerald-100 text-green-950 dark:border-green-800 dark:from-green-950 dark:to-emerald-950 dark:text-green-100"
            bgIconColor="bg-green-500 dark:bg-green-600"
            navigateIconColor="text-green-600 dark:text-green-300"
        />
    );
}
