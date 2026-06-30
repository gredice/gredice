import { FIELD_SIZE_LABEL } from '@gredice/js/plants';
import { BlockImage } from '@gredice/ui/BlockImage';
import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import Image from 'next/image';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { KnownPages } from '../../src/KnownPages';

export const metadata: Metadata = {
    title: 'Podignuta gredica',
    description:
        'Kako funkcionira tvoja podignuta gredica u Gredicama: tlo, sadnja, održavanje, berba i dostava.',
};

export default function RaisedBedPage() {
    return (
        <Container maxWidth="md">
            <Stack>
                <PageHeader
                    visual={
                        <BlockImage
                            blockName="Raised_Bed"
                            width={160}
                            height={160}
                        />
                    }
                    header="Podignuta gredica"
                    subHeader="Tvoj prostor za uzgoj na partnerskom OPG-u, od pripreme tla do dostave ubranih plodova."
                    padded
                />
                <StyledHtml>
                    <p>
                        Podignuta gredica u Gredicama je tvoj prostor za uzgoj
                        povrća, začinskog bilja i cvijeća. Ti planiraš što želiš
                        posaditi u aplikaciji, partnerski OPG obavlja radnje na
                        gredici, a Gredice ti omogućuju praćenje stanja,
                        fotografije i dostavu ubranih plodova.
                    </p>
                    <h2>Najvažnije</h2>
                    <ul>
                        <li>
                            <strong>Gredica je samo tvoja:</strong> nije
                            dijeljena s drugim korisnicima i ima svoj kod za
                            lakše praćenje.
                        </li>
                        <li>
                            <strong>Standardna veličina je 2 x 1 m:</strong>{' '}
                            gredica ima 18 polja veličine {FIELD_SIZE_LABEL} za
                            planiranje sadnje.
                        </li>
                        <li>
                            <strong>Biljke biraš u aplikaciji:</strong>{' '}
                            aplikacija pomaže u odabiru kultura i prikazuje
                            raspored na tvojoj gredici.
                        </li>
                        <li>
                            <strong>Radnje obavlja partnerski OPG:</strong>{' '}
                            priprema tla, sadnja, održavanje i berba rade se na
                            lokaciji OPG-a s kojim surađujemo.
                        </li>
                        <li>
                            <strong>Plodovi dolaze do tebe:</strong> nakon berbe
                            možeš naručiti dostavu prema dostupnim terminima.
                        </li>
                    </ul>
                    <div className="grid grid-rows-[auto_1fr] grid-cols-1 sm:grid-rows-1 sm:grid-cols-[1fr_1fr] gap-8 relative">
                        <div>
                            <h2>Tvoja gredica u Gredicama</h2>
                            <p>
                                Svaka gredica dobiva svoj kod koji vidiš u
                                aplikaciji i na fotografijama s terena, kako bi
                                praćenje rasta i radnji kroz sezonu bilo
                                jednostavnije.
                            </p>
                            <p>
                                Standardna gredica ima 2 x 1 m i 18 polja za
                                sadnju. U aplikaciji je prikazana kao dva bloka
                                od 1 x 1 m, što olakšava planiranje i pregled.
                            </p>
                        </div>
                        <div>
                            <Image
                                src={
                                    'https://myegtvromcktt2y7.public.blob.vercel-storage.com/raised-beds/raised-beds-field-001-3BHUG42MQeRFFVQuvYh5FJSLk6lPGM.jpg'
                                }
                                width={1280}
                                height={800}
                                className="rounded-xl shadow-lg"
                                alt={'Podignuta gredica 2x1 m'}
                            />
                        </div>
                    </div>
                    <h2>Što Gredice rade za tvoju gredicu</h2>
                    <ul>
                        <li>
                            <strong>Tlo:</strong> pripremamo slojeve podignute
                            gredice za sadnju.
                        </li>
                        <li>
                            <strong>Sadnja:</strong> odabireš biljke u
                            aplikaciji, a sadnja se provodi na OPG-u.
                        </li>
                        <li>
                            <strong>Održavanje:</strong> obavljaju se radnje
                            poput zalijevanja, prihrane, zaštite i kontrole
                            korova.
                        </li>
                        <li>
                            <strong>Berba:</strong> kada su biljke spremne,
                            pokreće se berba za tvoju gredicu.
                        </li>
                        <li>
                            <strong>Dostava:</strong> ubrane plodove možeš
                            naručiti prema dostupnim terminima dostave.
                        </li>
                    </ul>
                    <div className="grid overflow-hidden grid-rows-[auto_1fr] grid-cols-1 sm:grid-rows-1 sm:grid-cols-[1fr_1fr] gap-8 relative">
                        <div>
                            <h3>Lokacija i veličina</h3>
                            <p>
                                Gredica se nalazi na partnerskom OPG-u u
                                Bosiljevu u Bjelovarsko-bilogorskoj županiji.
                                Ondje se obavljaju radnje na tvojoj gredici,
                                uključujući pripremu tla, sadnju, održavanje i
                                berbu.
                            </p>
                            <ul>
                                <li>
                                    <strong>Dimenzije:</strong> 2 m x 1 m x 20
                                    cm
                                </li>
                                <li>
                                    <strong>Površina:</strong> 2 m²
                                </li>
                                <li>
                                    <strong>Broj polja:</strong> 18
                                </li>
                            </ul>
                        </div>
                        <Image
                            src={
                                'https://myegtvromcktt2y7.public.blob.vercel-storage.com/raised-beds/3-built-2025-06-12-oydN81kGjjf0rGlF3CpQ5iqRN0QFdW.jpg'
                            }
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={'Podignuta gredica 2x1 m'}
                        />
                    </div>
                    <div className="grid grid-rows-[auto_1fr] grid-cols-1 sm:grid-rows-1 sm:grid-cols-[1fr_1fr] gap-8 relative">
                        <div>
                            <h3>Tlo i priprema</h3>
                            <p>
                                Sastav tla dio je usluge jer utječe na rast,
                                vlagu i hranjivost. Gredica se priprema u
                                slojevima kako bi biljke imale stabilan prostor
                                za razvoj.
                            </p>
                            <p>
                                U aplikaciji ne moraš upravljati zemljom ručno,
                                ali možeš pratiti radnje koje se odnose na tvoju
                                gredicu.
                            </p>
                        </div>
                        <Image
                            src={
                                'https://myegtvromcktt2y7.public.blob.vercel-storage.com/raised-beds/raised-beds-field-002-ONlEvebgrNCwJOCZdFI2bEXDgjfShz.jpg'
                            }
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={'Podignuta gredica 2x1 m'}
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
                        <div>
                            <h3>Sastav tla</h3>
                            <ol>
                                <li>
                                    <strong>Gornji sloj:</strong> organsko tlo
                                    koje se koristi za sadnju biljaka.
                                </li>
                                <li>
                                    <strong>Srednji sloj:</strong> mješavina
                                    koja podržava hranjivost i drenažu.
                                </li>
                                <li>
                                    <strong>Prirodno tlo:</strong> temelj na
                                    kojem se gredica postavlja.
                                </li>
                            </ol>
                        </div>
                        <div className="relative mx-auto aspect-[2/3] w-full max-w-80">
                            <Image
                                src="/assets/raised-beds/soil-composition.png"
                                fill
                                sizes="(min-width: 640px) 20rem, 100vw"
                                className="rounded-xl p-0 m-0 shadow-lg object-cover"
                                alt={'Sastav tla podignutih gredica'}
                            />
                            <div className="absolute left-1/2 top-[15%] bg-white/10 rounded-full py-1 px-4 pointer-events-none text-white/80 backdrop-blur text-center -translate-x-1/2 -translate-y-1/2">
                                <Stack>
                                    <span className="text-xl font-bold leading-none">
                                        10%
                                    </span>
                                    <span className="text-lg leading-none">
                                        Gornji sloj
                                    </span>
                                </Stack>
                            </div>
                            <div className="absolute left-1/2 top-[45%] bg-white/10 rounded-full py-1 px-4 pointer-events-none text-white/80 backdrop-blur text-center -translate-x-1/2 -translate-y-1/2">
                                <Stack>
                                    <span className="text-xl font-bold leading-none">
                                        90%
                                    </span>
                                    <span className="text-lg leading-none">
                                        Srednji sloj
                                    </span>
                                </Stack>
                            </div>
                            <div className="absolute left-1/2 top-[75%] bg-white/10 rounded-full py-1 px-4 pointer-events-none text-white/80 backdrop-blur text-center -translate-x-1/2 -translate-y-1/2">
                                <Stack>
                                    <span className="text-xl font-bold leading-none">
                                        Zemlja
                                    </span>
                                    <span className="text-lg leading-none">
                                        Prirodno tlo
                                    </span>
                                </Stack>
                            </div>
                        </div>
                    </div>
                    <h3>Sadnja biljaka</h3>
                    <p>
                        Gredica je podijeljena na polja veličine{' '}
                        {FIELD_SIZE_LABEL}. U svako polje stane različit broj
                        biljaka, ovisno o vrsti i razmaku sadnje. Zato je
                        planiranje u aplikaciji važno prije nego što se sadnja
                        provede na OPG-u.
                    </p>
                    <p>
                        Detalje o odabiru biljaka i pogodnostima možeš pronaći
                        na stranici o <a href={KnownPages.Sowing}>sjetvi</a>, a
                        dostupne kulture na stranici{' '}
                        <a href={KnownPages.Plants}>biljaka</a>.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-2">
                        <Image
                            src={
                                'https://myegtvromcktt2y7.public.blob.vercel-storage.com/plants/plant-closeup-001-OgsXPDLObcprJVGx1lsaF4eeae1eov.jpg'
                            }
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={'Mlada biljka u podignutoj gredici'}
                        />
                        <Image
                            src={
                                'https://myegtvromcktt2y7.public.blob.vercel-storage.com/plants/plant-closeup-003-wXZ0Wbe70URA2ZeqhtSYEsurNInBM3.jpg'
                            }
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={'Biljka u rastu u podignutoj gredici'}
                        />
                        <Image
                            src={
                                'https://myegtvromcktt2y7.public.blob.vercel-storage.com/plants/plant-closeup-002-3mIj5S8iEa1qKDmhferRTomx0OZRMX.jpg'
                            }
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={'Detalj biljke u podignutoj gredici'}
                        />
                    </div>
                    <h3>Održavanje i praćenje</h3>
                    <p>
                        Održavanje uključuje radnje koje biljke trebaju kroz
                        sezonu: zalijevanje, prihranu, kontrolu korova, zaštitu
                        i druge zahvate ovisno o stanju biljaka. Te radnje su
                        dio usluge, a u aplikaciji možeš pratiti što se događa s
                        tvojom gredicom.
                    </p>
                    <p>
                        Fotografije i statusi pomažu ti razumjeti kako vrt
                        napreduje bez odlaska na lokaciju OPG-a.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Image
                            src={
                                'https://myegtvromcktt2y7.public.blob.vercel-storage.com/plants/plant-growing-002-8ev5nCKH203QY9WX8C3AdUNND55xsM.jpg'
                            }
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={'Biljke u rastu u podignutoj gredici'}
                        />
                        <Image
                            src={
                                'https://myegtvromcktt2y7.public.blob.vercel-storage.com/plants/plant-growing-001-z0VGjFxT0SPRhiJdHFLMyA3hhz0uRd.jpg'
                            }
                            width={1280}
                            height={800}
                            className="rounded-xl shadow-lg"
                            alt={'Održavana podignuta gredica s biljkama'}
                        />
                    </div>
                    <h3>Berba i dostava</h3>
                    <p>
                        Kada su biljke spremne, berba se provodi za tvoju
                        gredicu. Nakon berbe možeš naručiti dostavu ubranih
                        plodova kroz Gredice prema dostupnim terminima.
                    </p>
                    <p>
                        Više o pravilima, zonama i terminima pronađi na stranici{' '}
                        <a href={KnownPages.Delivery}>dostava</a>. Ako imaš
                        dodatna pitanja, tu su{' '}
                        <a href={KnownPages.FAQ}>najčešća pitanja</a> i{' '}
                        <a href={KnownPages.Contact}>kontakt</a>.
                    </p>
                </StyledHtml>
                <Row spacing={4} className="mt-12">
                    <Typography level="body1">
                        Jesu li ti informacije o podignutim gredicama korisne?
                    </Typography>
                    <FeedbackModal topic="www/raised-beds" />
                </Row>
            </Stack>
        </Container>
    );
}
