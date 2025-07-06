import { Stack } from "@signalco/ui-primitives/Stack";
import { StyledHtml } from "../../components/shared/StyledHtml";
import { PageHeader } from "../../components/shared/PageHeader";
import { InstagramCard } from "../../components/social/InstagramCard";
import { WhatsAppCard } from "../../components/social/WhatsAppCard";
import { FacebookCard } from "../../components/social/FacebookCard";

export default function ContactPage() {
    return (
        <Stack>
            <PageHeader
                header="Kontakt"
                subHeader="Slobodno nam se javi ako imaš pitanja, prijedloge ili komentare."
                padded />
            <StyledHtml>
                <p>Za sve upite, prijedloge ili komentare, slobodno nas kontaktiraš putem jednog od naših kanala.</p>
                <p>Možeš nas pronaći na društvenim mrežama, poslati nam e-mail ili nam se javiti preko WhatsAppa.</p>
                <p>Trudimo se odgovoriti na sve poruke u najkraćem mogućem roku, stoga ne oklijevaj i javi nam se!</p>
                <hr />
                <p>Kontaktiraj nas:</p>
                <ul>
                    <li>✉️ E-mail za generalne informacije: <a href="mailto:info@gredice.com">info@gredice.com</a></li>
                    <li>📧 E-mail tehničke podrške: <a href="mailto:podrska@gredice.com">podrska@gredice.com</a></li>
                    <li>📱 WhatsApp: <a href="https://wa.me/385993447418">+385 99 344 7418</a></li>
                </ul>
                <hr />
                <p>Prati nas na društvenim mrežama:</p>
                <div className="flex flex-col gap-2">
                    <WhatsAppCard />
                    <InstagramCard />
                    <FacebookCard />
                </div>
                <hr />
                <p>Hvala ti što si dio naše zajednice! 😊🌻</p>
            </StyledHtml>
        </Stack >
    )
}