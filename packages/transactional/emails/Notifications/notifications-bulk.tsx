import {
    Head,
    Html,
    Img,
    Preview,
    Section,
    Tailwind,
} from '@react-email/components';
import { ContentCard } from '../../components/ContentCard';
import { Divider } from '../../components/Divider';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Header } from '../../components/Header';
import { Paragraph } from '../../components/Paragraph';
import { PrimaryButton } from '../../components/PrimaryButton';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export interface EmailNotificationsBulkTemplateProps {
    email: string;
    notificationsCount: number;
    notificationImageUrls?: string[];

    appName?: string;
    appDomain?: string;
}

export default function EmailNotificationsBulkTemplate({
    email = 'login@example.com',
    notificationsCount = 5,
    notificationImageUrls = [
        'https://7ql7fvz1vzzo6adz.public.blob.vercel-storage.com/operations/1026/9424f829-299a-416a-bd78-691782c69c5c.jpg',
        'https://7ql7fvz1vzzo6adz.public.blob.vercel-storage.com/operations/1363/6a9bdd6c-242c-43d8-9a83-89f1be27230d.jpg',
        'https://7ql7fvz1vzzo6adz.public.blob.vercel-storage.com/operations/1396/c20269d5-5ab2-41c8-9699-3d0420d1a8e5.jpg',
    ],

    appName = 'Gredice',
    appDomain = 'gredice.com',
}: EmailNotificationsBulkTemplateProps) {
    const newNotificationsPlural =
        notificationsCount === 1
            ? 'nova obavijest'
            : notificationsCount < 5
              ? 'nove obavijesti'
              : 'novih obavijesti';
    const previewText = `🔔 ${notificationsCount} ${newNotificationsPlural} u tvom vrtu!`;
    const waitingPlural =
        notificationsCount === 1
            ? 'te čeka'
            : notificationsCount < 5
              ? 'te čekaju'
              : 'čeka te';
    const distinctNotificationImageUrls = Array.from(
        new Set(notificationImageUrls),
    );

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className="text-center">
                        <GrediceLogotype />
                    </Section>
                    <Header>Tvoj dnevni pregled obavijesti</Header>
                    <Paragraph>Hej,</Paragraph>
                    <Paragraph>
                        Svrati u svoj vrt i pogledaj što je novo.
                    </Paragraph>

                    <Section className="my-6 rounded-2xl bg-[#166534]/10 bg-[radial-gradient(circle_at_bottom_right,#c6d9ce_0%,transparent_60%)] p-6 text-center">
                        <Paragraph className="text-[24px] font-semibold">
                            {notificationsCount} {newNotificationsPlural}
                        </Paragraph>
                        <Paragraph className="text-[16px] font-semibold text-[#166534]">
                            {waitingPlural} u tvom vrtu!
                        </Paragraph>
                    </Section>

                    {distinctNotificationImageUrls.length > 0 ? (
                        <Section className="my-4 rounded-2xl bg-[#f7f7f7] p-4">
                            <Paragraph className="text-[16px] font-semibold text-center">
                                📸 Novo u tvom vrtu
                            </Paragraph>
                            <Section className="flex flex-col">
                                {distinctNotificationImageUrls.map(
                                    (imageUrl) => (
                                        <Section
                                            key={`img-${imageUrl}`}
                                            className="overflow-hidden rounded-xl bg-white mb-2"
                                        >
                                            <Img
                                                src={imageUrl}
                                                alt="Slika obavijesti"
                                                className="h-auto w-full object-cover"
                                            />
                                        </Section>
                                    ),
                                )}
                            </Section>
                        </Section>
                    ) : null}

                    <Paragraph>
                        Klikni na gumb ispod i provjeri sve obavijesti koje su
                        stigle.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href="https://vrt.gredice.com">
                            Posjeti svoj vrt
                        </PrimaryButton>
                    </Section>
                    <Divider className="my-[26px]" />
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
