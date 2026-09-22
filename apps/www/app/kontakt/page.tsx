import { GameContactIcon, GameMailboxIcon } from '@gredice/ui/GameIcons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { CompanyWhatsApp } from '@gredice/ui/PublicChrome';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { FacebookCard } from '../../components/social/FacebookCard';
import { InstagramCard } from '../../components/social/InstagramCard';
import { WhatsAppCard } from '../../components/social/WhatsAppCard';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';

export const metadata = createPublicMetadata({
    title: 'Kontakt',
    description:
        'Slobodno nam se javi ako imaš pitanja, prijedloge ili komentare.',
    path: KnownPages.Contact,
    eyebrow: 'Kontakt',
});

export default function ContactPage() {
    return (
        <Stack>
            <PageHeader
                header="Kontakt"
                subHeader="Slobodno nam se javi ako imaš pitanja, prijedloge ili komentare."
                padded
            />
            <StyledHtml>
                <p>
                    Za sve upite, prijedloge ili komentare, slobodno nas
                    kontaktiraš putem jednog od naših kanala.
                </p>
                <p>
                    Možeš nas pronaći na društvenim mrežama, poslati nam e-mail
                    ili nam se javiti preko WhatsAppa.
                </p>
                <p>
                    Trudimo se odgovoriti na sve poruke u najkraćem mogućem
                    roku, stoga ne oklijevaj i javi nam se!
                </p>
                <h2 id="pisani-prigovor">Pisani prigovor potrošača</h2>
                <p>
                    Pisani prigovor na kupljeni proizvod, pruženu uslugu ili
                    naše poslovanje možeš poslati na{' '}
                    <a href="mailto:kontakt@gredice.com">kontakt@gredice.com</a>
                    , poštom na Gredice d.o.o., Ulica Julija Knifera 3, 10000
                    Zagreb, ili ga predati u našim poslovnim prostorijama.
                </p>
                <p>
                    Primitak prigovora potvrđujemo bez odgađanja. Pisani odgovor
                    šaljemo u roku od <strong>15 dana od primitka</strong>, uz
                    jasno očitovanje prihvaćamo li osnovanost prigovora.
                    Evidenciju prigovora čuvamo najmanje godinu dana od
                    primitka.
                </p>
                <p>
                    Opiši problem i navedi kontakt za odgovor te, ako ga imaš,
                    broj narudžbe. Fotografije ili drugi podaci mogu pomoći, ali
                    ne moraš koristiti poseban obrazac da bi podnio prigovor.
                    Prigovor i dobrovoljni zahtjev za povrat ne zamjenjuju
                    zakonsko pravo na jednostrani raskid ili druga prava.
                </p>
                <p>
                    Postupci su opisani na stranici{' '}
                    <a href={KnownPages.Refunds}>Povrat novca</a>. Za zahtjeve
                    vezane uz osobne podatke pročitaj{' '}
                    <a href={KnownPages.LegalPrivacy}>Politiku privatnosti</a>.
                </p>
                <hr />
                <p>Kontaktiraj nas:</p>
                <ul>
                    <li>
                        <GameMailboxIcon
                            aria-hidden
                            className="mr-2 inline-block size-6 align-text-bottom"
                        />{' '}
                        E-mail za generalne informacije:{' '}
                        <a href="mailto:info@gredice.com">info@gredice.com</a>
                    </li>
                    <li>
                        <GameContactIcon
                            aria-hidden
                            className="mr-2 inline-block size-6 align-text-bottom"
                        />{' '}
                        E-mail tehničke podrške:{' '}
                        <a href="mailto:podrska@gredice.com">
                            podrska@gredice.com
                        </a>
                    </li>
                    <li>
                        <CompanyWhatsApp
                            aria-hidden
                            className="mr-2 inline-block size-6 align-text-bottom"
                        />{' '}
                        WhatsApp:{' '}
                        <a href="https://wa.me/385993447418">
                            +385 99 344 7418
                        </a>
                    </li>
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
        </Stack>
    );
}
