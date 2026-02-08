import { CompanyWhatsApp } from '../../app/Footer';
import { SocialCard } from './SocialCard';

export function WhatsAppCard() {
    return (
        <SocialCard
            href="https://gredice.link/wa"
            ctaText="Pridruži se našoj WhatsApp zajednici"
            icon={<CompanyWhatsApp className="size-10 fill-white" />}
            bgColor="bg-gradient-to-br p-2 from-green-50 dark:from-green-200 to-emerald-50 dark:to-emerald-200 border-green-200 dark:border-green-700"
            bgIconColor="bg-green-500"
            navigateIconColor="text-green-600"
        />
    );
}
