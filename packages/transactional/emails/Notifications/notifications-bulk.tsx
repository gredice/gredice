import {
    Head,
    Html,
    Preview,
    Section, Tailwind,
} from '@react-email/components';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Paragraph } from '../../components/Paragraph';
import { Header } from '../../components/Header';
import { Divider } from '../../components/Divider';
import { ContentCard } from '../../components/ContentCard';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export interface EmailNotificationsBulkTemplateProps {
    email: string;
    notificationsCount?: number;

    appName?: string;
    appDomain?: string;
}

export default function EmailNotificationsBulkTemplate({
    email = 'login@example.com',
    notificationsCount = 5,

    appName = 'Gredice',
    appDomain = 'gredice.com'
}: EmailNotificationsBulkTemplateProps) {
    const newNotificationsPlural = notificationsCount === 1 ? 'nova obavijest' : (notificationsCount < 5 ? 'nove obavijesti' : 'novih obavijesti');
    const previewText = `🔔 ${notificationsCount} ${newNotificationsPlural} u tvom vrtu!`;
    const waitingPlural = notificationsCount === 1 ? 'te čeka' : (notificationsCount < 5 ? 'te čekaju' : 'čeka te');

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className='text-center'>
                        <GrediceLogotype />
                    </Section>
                    <Header>Tvoj dnevni pregled obavijesti</Header>
                    <Paragraph>
                        Hej,
                    </Paragraph>
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

                    <Paragraph>
                        Klikni na gumb ispod i provjeri sve obavijesti koje su stigle.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href="https://vrt.gredice.com">Posjeti svoj vrt</PrimaryButton>
                    </Section>
                    <Divider className="my-[26px]" />
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}