import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Container } from "@signalco/ui-primitives/Container";
import { Typography } from "@signalco/ui-primitives/Typography";
import { StyledHtml } from "../../../components/shared/StyledHtml";

const thirdPartyPlatforms = [
    { name: "Axiom", description: "platforma za upravljanje sistemskim zapisima." },
    { name: "Azure", description: "platforma za upravljanje i distribuciju aplikacija u oblaku." },
    { name: "Blender", description: "alat za izradu 3D modela i animacija." },
    { name: "CloudFlare DNS", description: "usluga za upravljanje DNS zapisima i poboljšanje sigurnosti web stranice." },
    { name: "CloudFlare Email Router", description: "usluga za upravljanje e-poštom i zaštitu od neželjene pošte." },
    { name: "CloudFlare R2", description: "usluga za brzu isporuku sadržaja i optimizaciju performansi web stranice." },
    { name: "Figma", description: "alat za dizajniranje korisničkog sučelja i prototipiranje." },
    { name: "GitHub", description: "platforma za upravljanje izvornim kodom i suradnju na projektima." },
    { name: "Hypertune", description: "platforma za upravljanje značajkama sustava." },
    { name: "MailerLite", description: "alat za slanje e-pošte i upravljanje pretplatnicima." },
    { name: "Resend", description: "platforma za slanje e-pošte i upravljanje pretplatnicima." },
    { name: "Stripe", description: "platforma za online plaćanja i naplatu." },
    { name: "Vercel Analytics", description: "alat za analitiku koji nam pomaže razumjeti kako korisnici koriste našu web stranicu." },
    { name: "Vercel Hosting", description: "platforma za hosting i distribuciju web stranica." }
];

export default function UvjetiKoristenjaPage() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Treće strane"
                    subHeader="Informacije o korištenim izvorima podataka trećih strana."
                />
                <StyledHtml>
                    <h2>Uvod</h2>
                    <p>
                        Ovi Uvjeti korištenja (u daljnjem tekstu: &quot;Uvjeti&quot;) primjenjuju se na korištenje Platforme Gredice (<a href="https://www.gredice.com">www.gredice.com</a>) i sve njezine usluge.
                    </p>
                    <h2>Treće strane</h2>
                    <p>
                        Platforma koristi sljedeće platforme trećih strana:
                    </p>
                    <ul>
                        {thirdPartyPlatforms.map((platform, index) => (
                            <li key={index}>
                                <strong>{platform.name}</strong>: {platform.description}
                            </li>
                        ))}
                    </ul>
                    <p>Zadržavamo pravo izmjene ovih informacija u bilo kojem trenutku, uključujući dodavanje ili uklanjanje platformi trećih strana. Ukoliko platforma nije navedena na ovoj stranici, molimo kontaktirajte nas na <a href="mailto:kontakt@gredice.com">kontakt@gredice.com</a>.</p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 28. Veljača 2025.
                </Typography>
            </Stack>
        </Container>
    );
}