import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { StyledHtml } from "../../components/shared/StyledHtml";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { FeedbackModal } from "../../components/shared/feedback/FeedbackModal";
import { Container } from "@signalco/ui-primitives/Container";
import { KnownPages } from "../../src/KnownPages";
import { BlockImage } from "../../components/blocks/BlockImage";
import Image from "next/image";

export default function RaisedBedPage() {
    return (
        <Container maxWidth="md">
            <Stack>
                <PageHeader
                    visual={(
                        <BlockImage
                            blockName="Raised_Bed"
                            width={160}
                            height={160} />
                    )}
                    header="Podignuta gredica"
                    subHeader="Sve što trebaš znati o podignutim gredicama i korištenju aplikacije Gredice za planiranje vrta."
                    padded />
                <StyledHtml>
                    <p>
                        Podignute vrtne gredice sve su popularniji način uzgoja povrća,
                        začinskog bilja i cvijeća, osobito u urbanim i ograničenim prostorima. Radi se o uzgoju
                        biljaka u povišenim strukturama koje su ispunjene zemljom i često ograđene drvom, kamenom
                        ili drugim materijalima. Ovakav pristup vrtlarstvu nudi brojne prednosti u odnosu na klasične
                        vrtove u tlu.
                    </p>
                    <p>
                        Jedna od glavnih prednosti podignutih gredica je bolja kontrola nad kvalitetom zemlje.
                        Možete kombinirati idealan supstrat za specifične kulture, čime poboljšavate plodnost tla i
                        smanjujete rizik od korova i bolesti. Osim toga, zemlja u podignutim gredicama se brže zagrijava
                        u proljeće, što omogućuje raniju sadnju i dužu vegetacijsku sezonu.
                    </p>
                    <p>
                        Podignute gredice su fleksibilno rješenje koje se može prilagoditi svakom prostoru - bilo da imate
                        veliki vrt, malu okućnicu ili samo balkon. Estetski su privlačne i mogu unijeti red i strukturu u
                        vaš zeleni kutak. Ukratko, podignute gredice omogućuju zdraviji, organiziraniji i produktivniji vrt.
                    </p>
                    <div className="grid grid-rows-[auto_1fr] grid-cols-1 sm:grid-rows-1 sm:grid-cols-[1fr_1fr] gap-8 relative">
                        <div>
                            <h2>
                                Tvoja podignuta gredica
                            </h2>
                            <p>
                                Sijanjem biljaka u gredice u aplikaciji Gredice možeš iskoristiti sve prednosti
                                podignutih gredica. Gredica u koju siješ je samo tvoja i nije dijeljena s drugim
                                korisnicima. To znači da možeš slobodno planirati i saditi biljke prema svojim
                                željama i potrebama.
                            </p>
                            <p>
                                Svaka gredica je jedinstvena i dobiva svoj kod koji možeš vidjeti na svim slikama
                                koje dobiješ putem aplikacije Gredice. Ovaj kod ti omogućuje da lako prepoznaš
                                svoju gredicu i pratiš njen rast i razvoj. Kod je ujedno vidljiv i u aplikaciji.
                            </p>
                        </div>
                        <div>
                            <Image
                                src={'https://myegtvromcktt2y7.public.blob.vercel-storage.com/raised-beds/raised-beds-field-001-3BHUG42MQeRFFVQuvYh5FJSLk6lPGM.jpg'}
                                width={1280}
                                height={800}
                                className="rounded-xl shadow-lg"
                                alt={"Podignuta gredica 2x1 m"}
                            />
                        </div>
                    </div>
                    <div className="grid overflo grid-rows-[auto_1fr] grid-cols-1 sm:grid-rows-1 sm:grid-cols-[1fr_1fr] gap-8 relative">
                        <div>
                            <h3>
                                Dimenzije i veličina
                            </h3>
                            <p>
                                Dimenzije tvoje podignute gredice su 2x1 metar, odnosno 2 m², što je idealno za sadnju
                                različitih biljaka. Ova veličina omogućava dovoljno prostora za rast i razvoj biljaka,
                                a istovremeno olakšava održavanje.
                            </p>
                            <ul>
                                <li><strong>Dimenzije:</strong> 2 m x 1 m x 20 cm</li>
                                <li><strong>Zapremina:</strong> 400 L (600 L zemlje)</li>
                                <li><strong>Površina:</strong> 2 m²</li>
                                <li><strong>Broj polja:</strong> 18</li>
                            </ul>
                            <p>
                                Gredica je unutar aplikacije prikazana kao dvije podignute gredice dimenzija 1x1 m,
                                što omogućava lakše upravljanje i pregledavanje. Usto, u planu nam je omogućiti korisnicima
                                da kreiraju gredice različitih dimenzija i oblika, ovisno o njihovim potrebama i prostoru.
                            </p>
                        </div>
                        <Image
                            src={'https://myegtvromcktt2y7.public.blob.vercel-storage.com/raised-beds/3-built-2025-06-12-oydN81kGjjf0rGlF3CpQ5iqRN0QFdW.jpg'}
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={"Podignuta gredica 2x1 m"}
                        />
                    </div>
                    <div className="grid grid-rows-[auto_1fr] grid-cols-1 sm:grid-rows-1 sm:grid-cols-[1fr_1fr] gap-8 relative">
                        <div>
                            <h3>Lokacija</h3>
                            <p>
                                Tvoja podignuta gredica će biti postavljena na lokaciji jednog od OPGa s kojim
                                surađujemo. OPG izvršavati radnje na gredici, uključujući sadnju, održavanje
                                i berbu, mi ćemo ti omogućiti da sve to pratiš putem aplikacije Gredice i dostaviti
                                svo povrće i plodove tvoje gredice na tvoju adresu.
                            </p>
                            <p>
                                Trenutno surađujemo sa jednim OPG-om, a planiramo proširiti suradnju s
                                drugim OPG-ima kako bismo ti omogućili veći izbor i fleksibilnost
                                u odabiru lokacije i vrsta biljaka koje želiš saditi.
                            </p>
                            <p>
                                OPG koji će brinuti o tvojoj gredici:
                            </p>
                            <ul>
                                <li>Bosiljevo, Bjelovarsko-bilogorska županija</li>
                            </ul>
                            <em>Uskoro više informacija o OPG-u na stranici OPGa</em>
                        </div>
                        <Image
                            src={'https://myegtvromcktt2y7.public.blob.vercel-storage.com/raised-beds/raised-beds-field-002-ONlEvebgrNCwJOCZdFI2bEXDgjfShz.jpg'}
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={"Podignuta gredica 2x1 m"}
                        />
                    </div>
                    <h3>Sastav tla</h3>
                    <div className="grid grid-cols-1 grid-rows-[auto_400px] sm:grid-rows-1 sm:grid-cols-[2fr_1fr] gap-4">
                        <div>
                            <p>
                                Sastav tla podignutih gredica važan je za uspješan rast biljaka.
                                Preporučuje se korištenje mješavine komposta, treseta i pijeska kako bi se osigurala
                                dobra drenaža i hranjivost tla.
                            </p>
                            <p>Tvoja podignuta gredica sastoji se od tri sloja:</p>
                            <ol>
                                <li><strong>Gornji sloj (10%):</strong> Organsko tlo koje se koristi za sadnju biljaka.</li>
                                <li><strong>Srednji sloj (90%):</strong> Mješavina komposta, treseta i pijeska koja osigurava hranjivost i drenažu tla.</li>
                                <li><strong>Zemlja:</strong> Prirodno tlo nedefiniranog sastava koje se koristi kao temelj gredice.</li>
                            </ol>
                        </div>
                        <div className="relative">
                            <Image
                                src="/assets/raised-beds/soil-composition.png"
                                fill
                                className="rounded-xl p-0 m-0 shadow-lg"
                                alt={"Sastav tla podignutih gredica"}
                            />
                            <div className="absolute left-1/2 top-[15%] bg-white/10 rounded-full py-1 px-4 pointer-events-none text-white/80 backdrop-blur text-center -translate-x-1/2">
                                <Stack>
                                    <span className="text-xl font-bold leading-none">10%</span>
                                    <span className="text-lg  leading-none">Gornji sloj</span>
                                </Stack>
                            </div>
                            <div className="absolute left-1/2 top-[45%] bg-white/10 rounded-full py-1 px-4 pointer-events-none text-white/80 backdrop-blur text-center -translate-x-1/2">
                                <Stack>
                                    <span className="text-xl font-bold leading-none">90%</span>
                                    <span className="text-lg  leading-none">Srednji sloj</span>
                                </Stack>
                            </div>
                            <div className="absolute left-1/2 top-[75%] bg-white/10 rounded-full py-1 px-4 pointer-events-none text-white/80 backdrop-blur text-center -translate-x-1/2">
                                <Stack>
                                    <span className="text-xl font-bold leading-none">Zemlja</span>
                                    <span className="text-lg  leading-none">Prirodno tlo</span>
                                </Stack>
                            </div>
                        </div>
                    </div>
                    <h3>Sadnja biljaka</h3>
                    <p>
                        Podignuta gredica podijeljena je na polja veličine 30x30 cm. Tako podignuta gredica od
                        2x1 m ima 18 polja za sadnju tvojih biljaka. U svako polje može stati određeni broj biljaka,
                        ovisno o vrsti, odnosno o razmaku sijanja/sadnje biljke.
                        Tako, na primjer, u jedno polje može stati 1 rajčica, 4 salate ili 16 mrkvi.
                    </p>
                    <p>
                        Sadnja se radi sijanjem sjemena odabranih biljaka putem <a href={KnownPages.GardenApp}>aplikacije Gredice</a>.
                        Aplikacija će ti pomoći da odabereš prave biljke za svoju gredicu.
                    </p>
                    <p>
                        Kada odabereš biljke koje želiš posaditi, aplikacija će ti pružiti sve potrebne
                        informacije o sadnji, uključujući preporučeno vrijeme sadnje, razmak između biljaka
                        i druge važne detalje.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-2">
                        <Image
                            src={'https://myegtvromcktt2y7.public.blob.vercel-storage.com/plants/plant-closeup-001-OgsXPDLObcprJVGx1lsaF4eeae1eov.jpg'}
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={"Podignuta gredica 2x1 m"}
                        />
                        <Image
                            src={'https://myegtvromcktt2y7.public.blob.vercel-storage.com/plants/plant-closeup-003-wXZ0Wbe70URA2ZeqhtSYEsurNInBM3.jpg'}
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={"Podignuta gredica 2x1 m"}
                        />
                        <Image
                            src={'https://myegtvromcktt2y7.public.blob.vercel-storage.com/plants/plant-closeup-002-3mIj5S8iEa1qKDmhferRTomx0OZRMX.jpg'}
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={"Podignuta gredica 2x1 m"}
                        />
                    </div>
                    <p>
                        Imaj na umu da nije nužno pratiti sve preporuke vezane uz sadnju biljaka.
                        Možeš eksperimentirati s različitim biljkama i njihovim kombinacijama
                        kako bi pronašao ono što najbolje odgovara tvom vrtu i tvojim željama jer imaš
                        potpunu kontrolu nad svojim podignutim gredicama i radnjama na njima.
                    </p>
                    <p>
                        Sve informacije i pojedinim biljkama i biljakama koje su dostupne možeš pronaći
                        na stranicama <a href={KnownPages.Plants}>biljaka</a> i u <a href={KnownPages.GardenApp}>aplikaciji Gredice</a>.
                    </p>
                    <h3>Održavanje podignutih gredica</h3>
                    <p>
                        Održavanje podignutih gredica uključuje redovito zalijevanje, dodavanje hranjivih
                        tvari i kontrolu korova.
                    </p>
                    <p>
                        Preporučuje se korištenje malča kako bi se smanjila potreba za zalijevanjem i kontrolom korova.
                        Također, za neke biljke može biti korisno koristiti potporne strukture
                        kako bi se spriječilo njihovo savijanje ili lomljenje.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <Image
                            src={'https://myegtvromcktt2y7.public.blob.vercel-storage.com/plants/plant-growing-002-8ev5nCKH203QY9WX8C3AdUNND55xsM.jpg'}
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={"Podignuta gredica 2x1 m"}
                        />
                        <Image
                            src={'https://myegtvromcktt2y7.public.blob.vercel-storage.com/plants/plant-growing-001-z0VGjFxT0SPRhiJdHFLMyA3hhz0uRd.jpg'}
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={"Podignuta gredica 2x1 m"}
                        />
                    </div>
                    <p>
                        Također, važno je redovito provjeravati stanje tla i biljaka kako bi se osiguralo da su
                        biljke zdrave i da rastu prema očekivanjima.
                    </p>
                    <p>
                        Možeš pratiti stanje svojih podignutih gredica u aplikaciji Gredice, gdje možeš
                        vidjeti sve informacije o svojim gredicama, uključujući stanje tla, zalijevanje,
                        sadnju i berbu biljaka.
                    </p>
                    <p>
                        Dobit ćeš i obavijesti o važnim događajima vezanim uz tvoje gredice, kao što su
                        vrijeme sadnje, zalijevanja i berbe biljaka, te ostale važne informacije
                        koje će ti pomoći u održavanju i uspješnom uzgoju biljaka.
                    </p>
                    <p>
                        Periodično ćemo ti poslati slike tvojih podignutih gredica kako bi mogao pratiti
                        njihov rast i razvoj. Ako želiš, možeš podijeliti te slike s prijateljima i obitelji
                        kako bi ih inspirirao na uzgoj vlastitih biljaka.
                    </p>
                    <p>
                        Sve informacije o održavanju pojedinih biljaka možeš pronaći na stranicama <a href={KnownPages.Plants}>biljaka</a> i u aplikaciji Gredice.
                    </p>
                    <h3>Berba</h3>
                    <p>
                        Berba biljaka iz podignutih gredica može biti vrlo zadovoljavajuća. Kada su biljke
                        spremne za berbu, obično ćeš primijetiti promjene u njihovom izgledu, poput boje,
                        veličine i teksture.
                    </p>
                    <p>
                        Berbu možeš naručiti putem <a href={KnownPages.GardenApp}>aplikacije Gredice</a>, gdje ćeš dobiti obavijest kada su
                        tvoje biljke spremne za berbu. Također, možeš pratiti stanje
                        svojih biljaka i planirati berbu prema njihovoj zrelosti.
                    </p>
                    <p>
                        Berbom automatski započinje proces dostave povrća i drugih plodova tvoje gredice.
                        Putem aplikacije možeš naručiti dostavu, a mi ćemo se pobrinuti da
                        sve stigne na tvoju adresu u najkraćem mogućem roku i što svježije.
                    </p>
                    <p>
                        Više informacija o dostavi možeš pronaći na našoj stranici <a href={KnownPages.Delivery}>dostava</a>.
                    </p>
                    <h2>
                        Kako ti možemo pomoći?
                    </h2>
                    <p>
                        Ako imaš dodatnih pitanja ili trebaš pomoć oko podignutih gredica,
                        slobodno nas <a href={KnownPages.Contact}>kontaktiraj</a>.
                    </p>
                    <p>
                        Također, možeš posjetiti našu stranicu s <a href={KnownPages.FAQ}>najčešćim pitanjima (FAQ)</a> gdje možeš pronaći
                        odgovore na mnoge upite vezane uz podignute gredice.
                    </p>
                </StyledHtml>
                <Row spacing={2} className="mt-12">
                    <Typography level="body1">Jesu li ti informacije o podignutim gredicama korisne?</Typography>
                    <FeedbackModal topic="www/raised-beds" />
                </Row>
            </Stack>
        </Container>
    );
}