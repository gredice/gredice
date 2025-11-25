import {
    Head,
    Html,
    Preview,
    Section,
    Tailwind,
    Img,
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
    notificationsCount?: number;
    notificationImageUrls?: string[];

    appName?: string;
    appDomain?: string;
}

export default function EmailNotificationsBulkTemplate({
    email = 'login@example.com',
    notificationsCount = 5,
    notificationImageUrls = [],

    appName = 'Gredice',
    appDomain = 'gredice.com'
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

                    {notificationImageUrls.length > 0 ? (
                        <Section className="my-6 rounded-2xl bg-[#f7f7f7] p-4">
                            <Paragraph className="text-[16px] font-semibold text-center">
                                Novo iz tvojeg vrta
                            </Paragraph>
                            <Section className="flex flex-col gap-4">
                                {notificationImageUrls.map((imageUrl, index) => (
                                    <Section
                                        key={`${imageUrl}-${index}`}
                                        className="overflow-hidden rounded-xl bg-white"
                                    >
                                        <Img
                                            src={imageUrl}
                                            alt="Slika obavijesti"
                                            className="h-auto w-full object-cover"
                                        />
                                    </Section>
                                ))}
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
