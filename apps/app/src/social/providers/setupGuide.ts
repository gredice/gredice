import type { SocialProvider } from '@gredice/storage';

type SetupGuideDetail = {
    label: string;
    description: string;
};

export type SocialProviderFormFieldHelp = {
    providerAccountKey: string;
    label: string;
    handle: string;
    externalAccountId: string;
    defaultDestination: string;
    allowedDestinations: string;
    credentialReference: string;
    status: string;
};

export type SocialProviderSetupGuide = {
    provider: SocialProvider;
    setupSummary: string;
    destinationFormat: string;
    requiredAccess: string[];
    setupSteps: string[];
    credentialDetails: SetupGuideDetail[];
    formFields: SocialProviderFormFieldHelp;
    mediaNotes: string[];
    docsUrl: string;
};

function formFieldHelp({
    providerName,
    accountKeyExample,
    handle,
    externalAccountId,
    defaultDestination,
    allowedDestinations,
    credentialReference,
}: {
    providerName: string;
    accountKeyExample: string;
    handle: string;
    externalAccountId: string;
    defaultDestination: string;
    allowedDestinations: string;
    credentialReference: string;
}): SocialProviderFormFieldHelp {
    return {
        providerAccountKey: `Stabilni interni ključ za ovaj ${providerName} račun. Koristi mala slova, brojeve i crtice, npr. ${accountKeyExample}.`,
        label: `Kratak naziv koji admini vide u Gredice, npr. Gredice ${providerName}.`,
        handle,
        externalAccountId,
        defaultDestination,
        allowedDestinations,
        credentialReference,
        status: 'Aktivan dopušta objave. Onemogućen skriva račun iz slanja. Treba prijavu označava da token ili autorizacija treba obnovu.',
    };
}

export const socialProviderSetupGuides = [
    {
        provider: 'reddit',
        setupSummary:
            'Pripremi Reddit aplikaciju, autoriziraj korisnika koji objavljuje i unesi subreddit bez r/ prefiksa.',
        destinationFormat: 'Subreddit bez r/, npr. gredice.',
        requiredAccess: [
            'Reddit aplikacija s client ID i client secret podacima',
            'Refresh token ili kratkotrajni access token sa submit scopeom',
            'User-Agent koji identificira Gredice i kontakt za podršku',
        ],
        setupSteps: [
            'Prijavi se na Reddit korisnikom koji će objavljivati i otvori stranicu za developer aplikacije.',
            'Kreiraj aplikaciju za Gredice, kopiraj client ID ispod naziva aplikacije i client secret iz detalja aplikacije.',
            'Pokreni OAuth autorizaciju za istu aplikaciju sa submit scopeom i spremi dobiveni refresh token. Access token koristi samo za kratko testiranje ako refresh token još nije spreman.',
            'Odaberi subreddit na koji Gredice smije objavljivati i provjeri da korisnik ima pravo objave prema pravilima subreddita.',
            'Spremi client ID, client secret, refresh token ili access token i User-Agent u interni zapis vjerodajnice pa naziv tog zapisa unesi u obrazac.',
        ],
        credentialDetails: [
            {
                label: 'Client ID',
                description:
                    'Javni identifikator Reddit aplikacije prikazan ispod naziva aplikacije.',
            },
            {
                label: 'Client secret',
                description:
                    'Tajna Reddit aplikacije iz detalja aplikacije. Ne lijepi je u obrazac.',
            },
            {
                label: 'Refresh token ili access token',
                description:
                    'OAuth token autoriziran za korisnika koji objavljuje. Za trajnu konfiguraciju koristi refresh token.',
            },
            {
                label: 'User-Agent',
                description:
                    'Opis aplikacije koji Reddit vidi u API pozivima, s nazivom Gredice i kontaktom.',
            },
        ],
        formFields: formFieldHelp({
            providerName: 'Reddit',
            accountKeyExample: 'brand-main',
            handle: 'Javni Reddit korisnik koji objavljuje, npr. u/gredice. Ovo je informativno polje.',
            externalAccountId:
                'Reddit korisničko ime ili ID aplikacije ako ga želiš imati uz konfiguraciju. Nije obavezno za slanje.',
            defaultDestination:
                'Glavni subreddit za objave. Unesi samo ime, npr. gredice, bez r/.',
            allowedDestinations:
                'Svaki dopušteni subreddit u novi red. Ostavi samo subreddite na koje ovaj račun smije objavljivati.',
            credentialReference:
                'Naziv internog zapisa vjerodajnice koji sadrži Reddit client ID, client secret, token i User-Agent. Ne unosi tajne vrijednosti ovdje.',
        }),
        mediaNotes: [
            'Direktni adapter podržava Reddit tekstualne i link objave.',
        ],
        docsUrl: 'https://www.reddit.com/dev/api/',
    },
    {
        provider: 'instagram',
        setupSummary:
            'Koristi Meta Graph API content publishing za Instagram professional account povezan s Meta aplikacijom.',
        destinationFormat:
            'Instagram professional account ID, npr. 17841400000000000.',
        requiredAccess: [
            'Meta aplikacija s Instagram API pristupom',
            'Access token odobren za Instagram content publishing',
            'Javni media URL-ovi koje Meta može dohvatiti bez redirekcije ili autentikacije',
        ],
        setupSteps: [
            'Provjeri da je Instagram račun Professional i da je povezan s Facebook Pageom ili Meta Business postavkama koje Gredice smije koristiti.',
            'U Meta aplikaciji omogući Instagram API i zatraži potrebne publishing dozvole za račun koji će objavljivati.',
            'Autoriziraj korisnika koji upravlja računom i generiraj dugotrajniji access token za taj Instagram professional account.',
            'U Graph API Exploreru ili Meta API pozivu pronađi Instagram professional account ID i provjeri da API može kreirati media container.',
            'Spremi access token u interni zapis vjerodajnice, a Instagram professional account ID unesi kao zadano odredište.',
        ],
        credentialDetails: [
            {
                label: 'Access token',
                description:
                    'Meta token autoriziran za Instagram publishing na odabranom professional accountu.',
            },
            {
                label: 'Graph API verzija',
                description:
                    'Verzija Meta Graph API-ja ako se razlikuje od zadane verzije koju koristi aplikacija.',
            },
            {
                label: 'Instagram professional account ID',
                description:
                    'Numeric ID računa na koji se šalju media container i media_publish zahtjevi.',
            },
        ],
        formFields: formFieldHelp({
            providerName: 'Instagram',
            accountKeyExample: 'brand-main',
            handle: 'Javni Instagram handle, npr. @gredice. Koristi se za prepoznavanje računa u adminu.',
            externalAccountId:
                'Instagram professional account ID iz Meta Graph API-ja. Unesi isti ID koji koristiš za objavu ako želiš audit trag.',
            defaultDestination:
                'Instagram professional account ID na koji se objave šalju.',
            allowedDestinations:
                'Jedan Instagram professional account ID po retku. Ako postoji samo jedan račun, ponovi zadano odredište.',
            credentialReference:
                'Naziv internog zapisa vjerodajnice koji sadrži Meta access token i opcionalnu Graph API verziju. Ne unosi token u obrazac.',
        }),
        mediaNotes: [
            'Slike, videi, reels, stories i carouseli objavljuju se kroz media container pa media_publish tijek.',
            'Video container može ostati u obradi kod Mete prije javnog prikaza.',
        ],
        docsUrl:
            'https://developers.facebook.com/docs/instagram-platform/content-publishing/',
    },
    {
        provider: 'facebook',
        setupSummary:
            'Koristi Meta Pages publishing s Page access tokenom za ciljanu Facebook Page.',
        destinationFormat: 'Facebook Page ID, npr. 1234567890.',
        requiredAccess: [
            'Meta aplikacija s Facebook Pages pristupom',
            'Page access token s Pages publishing dozvolama',
            'Page rola koja smije objavljivati',
        ],
        setupSteps: [
            'U Meta aplikaciji omogući Pages API pristup i zatraži dozvole potrebne za objavljivanje na Pageu.',
            'Autoriziraj Facebook korisnika koji ima admin ili content rolu na Pageu.',
            'Dohvati Page access token za ciljanu Page i kopiraj Page ID iz Meta Business Suitea, Page postavki ili Graph API Explorer rezultata.',
            'Objavi probnu privatnu ili niskorizičnu objavu na Pageu kako bi se potvrdile dozvole.',
            'Spremi Page access token u interni zapis vjerodajnice, a Page ID unesi kao zadano odredište.',
        ],
        credentialDetails: [
            {
                label: 'Page access token',
                description:
                    'Meta token koji objavljuje u ime odabrane Facebook Page.',
            },
            {
                label: 'Graph API verzija',
                description:
                    'Verzija Meta Graph API-ja ako treba odstupati od zadane verzije.',
            },
            {
                label: 'Facebook Page ID',
                description:
                    'Numeric ID Pagea koji se koristi u /feed, /photos i /videos endpointima.',
            },
        ],
        formFields: formFieldHelp({
            providerName: 'Facebook',
            accountKeyExample: 'brand-main',
            handle: 'Javni handle ili naziv Facebook Pagea, npr. @gredice. Ovo pomaže adminima prepoznati račun.',
            externalAccountId:
                'Facebook Page ID iz Meta Business Suitea ili Graph API-ja.',
            defaultDestination: 'Facebook Page ID na koji Gredice objavljuje.',
            allowedDestinations:
                'Svaki dopušteni Page ID u novi red. Drži popis uzak na Pageove za koje token ima pravo objave.',
            credentialReference:
                'Naziv internog zapisa vjerodajnice koji sadrži Page access token i opcionalnu Graph API verziju.',
        }),
        mediaNotes: [
            'Tekst i linkovi koriste Page feed endpoint.',
            'Slike koriste Page photos; više slika se povezuje kroz unpublished photo ID vrijednosti.',
            'Videi, reels i stories šalju se kroz Page video upload i prate kao provider submission.',
        ],
        docsUrl: 'https://developers.facebook.com/docs/pages-api/posts/',
    },
    {
        provider: 'google_business',
        setupSummary:
            'Koristi Google Business Profile Local Posts API za verificiranu Gredice lokaciju.',
        destinationFormat: 'accounts/{accountId}/locations/{locationId}.',
        requiredAccess: [
            'Google Cloud OAuth client s Business Profile API pristupom',
            'business.manage ili plus.business.manage OAuth scope',
            'Access token ili refresh-token vjerodajnice vlasnika profila',
        ],
        setupSteps: [
            'U Google Cloud projektu omogući Business Profile API-je potrebne za Local Posts.',
            'Kreiraj OAuth client i autoriziraj korisnika koji je vlasnik ili upravitelj Business Profile lokacije.',
            'Dohvati access token ili refresh token sa business.manage ili plus.business.manage scopeom.',
            'Listaj Business Profile accounte i lokacije te sastavi odredište u formatu accounts/{accountId}/locations/{locationId}.',
            'Spremi OAuth client podatke i token u interni zapis vjerodajnice, a puni account/location path unesi kao odredište.',
        ],
        credentialDetails: [
            {
                label: 'Access token ili refresh token',
                description:
                    'OAuth token vlasnika ili upravitelja Business Profile lokacije.',
            },
            {
                label: 'Client ID i client secret',
                description:
                    'Google OAuth client podaci potrebni ako aplikacija obnavlja access token iz refresh tokena.',
            },
            {
                label: 'Location path',
                description:
                    'Puni accounts/{accountId}/locations/{locationId} path za ciljanu lokaciju.',
            },
            {
                label: 'Language code',
                description:
                    'Jezik local posta, npr. hr, ako treba odstupati od zadane vrijednosti.',
            },
        ],
        formFields: formFieldHelp({
            providerName: 'Google Business',
            accountKeyExample: 'zagreb-location',
            handle: 'Naziv ili javni identifikator lokacije, npr. Gredice Zagreb. Ovo je informativno polje.',
            externalAccountId:
                'Google location ID ili puni accounts/{accountId}/locations/{locationId} path radi lakšeg audita.',
            defaultDestination:
                'Puni Google Business Profile path: accounts/{accountId}/locations/{locationId}.',
            allowedDestinations:
                'Svaka dopuštena lokacija u novi red u istom accounts/{accountId}/locations/{locationId} formatu.',
            credentialReference:
                'Naziv internog zapisa vjerodajnice koji sadrži Google OAuth token, a po potrebi client ID i client secret.',
        }),
        mediaNotes: [
            'LocalPost media podržava sourceUrl fotografije; video se ne dodaje kroz ovaj adapter.',
            'URL objave dodaju LEARN_MORE call to action.',
        ],
        docsUrl:
            'https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts/create',
    },
    {
        provider: 'x',
        setupSummary:
            'Koristi X API v2 Manage Posts i Media Upload s korisničkim OAuth tokenom za Gredice profil.',
        destinationFormat: 'Profil handle za permalink, npr. @gredice.',
        requiredAccess: [
            'X developer project i aplikacija s write pristupom',
            'OAuth korisnički access token s tweet.write i media.write mogućnostima',
            'API plan koji uključuje Manage Posts i media upload',
        ],
        setupSteps: [
            'U X Developer Portalu kreiraj projekt i aplikaciju za Gredice profil.',
            'Omogući write pristup i media upload mogućnosti koje odgovaraju tipovima objava koje Gredice šalje.',
            'Provedi korisnički OAuth tijek za profil koji će objavljivati i spremi access token za taj korisnik.',
            'Potvrdi javni handle profila jer se koristi za permalink nakon objave.',
            'Spremi access token u interni zapis vjerodajnice, a handle unesi kao odredište.',
        ],
        credentialDetails: [
            {
                label: 'Access token',
                description:
                    'Korisnički OAuth token profila koji objavljuje putem X API-ja.',
            },
            {
                label: 'Profile handle',
                description:
                    'Javni handle koji se koristi kao odredište i za izgradnju linka na objavu.',
            },
        ],
        formFields: formFieldHelp({
            providerName: 'X',
            accountKeyExample: 'brand-main',
            handle: 'Javni X handle, npr. @gredice.',
            externalAccountId:
                'X user ID ako ga imaš iz developer alata ili users/by/username odgovora. Nije obavezno za slanje.',
            defaultDestination:
                'Javni handle profila koji objavljuje, npr. @gredice.',
            allowedDestinations:
                'Svaki dopušteni handle u novi red. Najčešće je dovoljan samo @gredice.',
            credentialReference:
                'Naziv internog zapisa vjerodajnice koji sadrži X OAuth access token.',
        }),
        mediaNotes: [
            'Slike i videi preuzimaju se u apps/app, prenose na X media upload, finaliziraju i zatim povezuju s objavom.',
            'Obrada većih medija može ostaviti objavu retriable ako X ne završi obradu na vrijeme.',
        ],
        docsUrl: 'https://docs.x.com/x-api/posts/create-post',
    },
    {
        provider: 'tiktok',
        setupSummary:
            'Koristi TikTok Content Posting API Direct Post za autorizirani creator account.',
        destinationFormat: 'Operativna oznaka ili handle, npr. @gredice.',
        requiredAccess: [
            'TikTok developer app s Content Posting API proizvodom',
            'Direct Post uključen i auditiran za javnu vidljivost',
            'User access token autoriziran za video.publish i foto objave gdje je potrebno',
            'Verificirana media domena ili URL prefix za PULL_FROM_URL',
        ],
        setupSteps: [
            'U TikTok for Developers kreiraj aplikaciju i dodaj Content Posting API proizvod.',
            'Uključi Direct Post konfiguraciju i zatraži audit ako objave trebaju biti javne, jer neauditirani klijenti ostaju ograničeni na privatnu vidljivost.',
            'Verificiraj domenu ili URL prefix s kojeg TikTok povlači video i foto medije.',
            'Autoriziraj creator account i spremi user access token s potrebnim publishing scopeovima.',
            'Provjeri dostupne privacy level opcije za creatora i spremi odabranu vrijednost u interni zapis vjerodajnice.',
        ],
        credentialDetails: [
            {
                label: 'Access token',
                description:
                    'TikTok user token creatora koji je autorizirao Gredice aplikaciju.',
            },
            {
                label: 'Privacy level',
                description:
                    'Vrijednost koju TikTok vraća za creatora, npr. SELF_ONLY ili javna opcija nakon audita.',
            },
            {
                label: 'Media URL property',
                description:
                    'Verificirana domena ili URL prefix s kojeg TikTok smije povući medije.',
            },
            {
                label: 'Creator handle',
                description:
                    'Operativna oznaka računa koji je autorizirao token.',
            },
        ],
        formFields: formFieldHelp({
            providerName: 'TikTok',
            accountKeyExample: 'brand-main',
            handle: 'Javni TikTok handle, npr. @gredice.',
            externalAccountId:
                'TikTok open ID ili creator ID iz OAuth odgovora ako ga pratiš. Nije obavezno za slanje.',
            defaultDestination:
                'Operativna oznaka ili handle autoriziranog creatora, npr. @gredice. Objavu zapravo šalje token owner.',
            allowedDestinations:
                'Svaki dopušteni creator handle ili oznaka u novi red. Najčešće je dovoljan jedan.',
            credentialReference:
                'Naziv internog zapisa vjerodajnice koji sadrži TikTok access token i postavke privatnosti.',
        }),
        mediaNotes: [
            'Video i reel objave koriste video/init s PULL_FROM_URL.',
            'Image i carousel objave koriste content/init s DIRECT_POST i PHOTO.',
            'Neauditirani TikTok klijenti ograničeni su na privatnu vidljivost.',
        ],
        docsUrl:
            'https://developers.tiktok.com/doc/content-posting-api-get-started/',
    },
    {
        provider: 'threads',
        setupSummary:
            'Koristi Threads API container creation i threads_publish za autorizirani Threads profil.',
        destinationFormat: 'Threads user ID ili me za vlasnika tokena.',
        requiredAccess: [
            'Meta aplikacija s Threads API pristupom',
            'Access token s threads_basic i threads_content_publish dozvolama',
            'Javni image ili video URL-ovi kada objava ima medij',
        ],
        setupSteps: [
            'U Meta aplikaciji omogući Threads API pristup i zatraži publishing dozvole.',
            'Autoriziraj Threads profil koji će objavljivati i generiraj access token s threads_basic i threads_content_publish scopeovima.',
            'Dohvati Threads user ID za profil ili koristi me ako token uvijek predstavlja isti profil.',
            'Provjeri da javni media URL-ovi koje Gredice šalje mogu biti dohvatljivi bez autentikacije.',
            'Spremi access token u interni zapis vjerodajnice, a Threads user ID ili me unesi kao odredište.',
        ],
        credentialDetails: [
            {
                label: 'Access token',
                description:
                    'Meta/Threads token autoriziran za čitanje osnovnog profila i objavljivanje sadržaja.',
            },
            {
                label: 'Threads user ID',
                description:
                    'ID profila za threads i threads_publish endpoint, ili me kada se koristi vlasnik tokena.',
            },
        ],
        formFields: formFieldHelp({
            providerName: 'Threads',
            accountKeyExample: 'brand-main',
            handle: 'Javni Threads handle, npr. @gredice. Koristi se za prepoznavanje u adminu.',
            externalAccountId:
                'Threads user ID iz Threads API-ja. Ako koristiš me kao odredište, ovdje možeš spremiti stvarni ID radi audita.',
            defaultDestination:
                'Threads user ID ili me ako token owner uvijek objavljuje.',
            allowedDestinations:
                'Svaki dopušteni Threads user ID u novi red, ili me za token owner račun.',
            credentialReference:
                'Naziv internog zapisa vjerodajnice koji sadrži Threads access token.',
        }),
        mediaNotes: [
            'Tekst, link, image, video i carousel objave koriste Threads container pa publish tijek.',
            'Zakazivanje Threads objava rješava Gredice queue, ne Threads API.',
        ],
        docsUrl: 'https://developers.facebook.com/docs/threads/posts',
    },
    {
        provider: 'linkedin',
        setupSummary:
            'Koristi LinkedIn versioned Posts API s Images API ili Videos API uploadom za medije.',
        destinationFormat:
            'Author URN, npr. urn:li:organization:123456 ili urn:li:person:abc.',
        requiredAccess: [
            'LinkedIn aplikacija s odobrenim Community Management pristupom',
            'w_organization_social za organizacijske stranice ili w_member_social za osobne objave',
            'LinkedIn-Version header vrijednost u YYYYMM formatu',
        ],
        setupSteps: [
            'U LinkedIn Developer portalu provjeri da aplikacija ima Community Management pristup.',
            'Autoriziraj LinkedIn korisnika koji smije objavljivati za organizaciju ili osobni profil.',
            'Za organizacijsku stranicu pronađi organization ID i sastavi URN urn:li:organization:{id}. Za osobni profil koristi person URN ako objavljuješ kao član.',
            'Odaberi podržanu LinkedIn-Version vrijednost u YYYYMM formatu i potvrdi da endpointi prihvaćaju tu verziju.',
            'Spremi access token i API verziju u interni zapis vjerodajnice, a author URN unesi kao odredište.',
        ],
        credentialDetails: [
            {
                label: 'Access token',
                description:
                    'LinkedIn OAuth token s pravom objave za odabranu organizaciju ili člana.',
            },
            {
                label: 'API version',
                description:
                    'LinkedIn-Version header u YYYYMM formatu koji je podržan u trenutku konfiguracije.',
            },
            {
                label: 'Author URN',
                description:
                    'urn:li:organization:{id} ili urn:li:person:{id} vrijednost autora objave.',
            },
        ],
        formFields: formFieldHelp({
            providerName: 'LinkedIn',
            accountKeyExample: 'brand-main',
            handle: 'Javni naziv ili handle LinkedIn stranice/profila. Ovo je informativno polje.',
            externalAccountId:
                'LinkedIn organization ID ili person ID bez URN prefiksa ako ga želiš odvojeno pratiti.',
            defaultDestination:
                'Puni author URN, npr. urn:li:organization:123456.',
            allowedDestinations:
                'Svaki dopušteni author URN u novi red. Ne dodaj organizacije za koje token nema pravo objave.',
            credentialReference:
                'Naziv internog zapisa vjerodajnice koji sadrži LinkedIn access token i LinkedIn-Version vrijednost.',
        }),
        mediaNotes: [
            'Tekst i link objave idu direktno na /rest/posts.',
            'Jedna slika ili jedan video može se uploadati i povezati s organic objavom.',
            'Organic carousel publishing nije uključen jer LinkedIn dokumentira carousel kao sponsored-only.',
        ],
        docsUrl:
            'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-05',
    },
    {
        provider: 'whatsapp',
        setupSummary:
            'Koristi WhatsApp Cloud API Messages za direktne business poruke s konfiguriranog telefonskog broja.',
        destinationFormat:
            'WhatsApp broj primatelja u međunarodnom formatu bez +.',
        requiredAccess: [
            'Meta aplikacija s WhatsApp Business Platform Cloud API pristupom',
            'Permanentni ili dugotrajni access token',
            'WhatsApp Business phone number ID',
            'Odobreni templatei za proaktivne marketing poruke izvan customer-service prozora',
        ],
        setupSteps: [
            'U Meta aplikaciji dodaj WhatsApp proizvod i povezi WhatsApp Business Account.',
            'U WhatsApp Manageru pronađi phone number ID broja s kojeg Gredice šalje poruke.',
            'Kreiraj permanentni ili dugotrajni access token za sistemskog korisnika ili aplikaciju s pravom slanja poruka.',
            'Za proaktivne poruke pripremi i odobri templatee prije slanja izvan customer-service prozora.',
            'Spremi access token i phone number ID u interni zapis vjerodajnice, a broj primatelja unesi bez plus znaka.',
        ],
        credentialDetails: [
            {
                label: 'Access token',
                description:
                    'Meta token s pravom slanja WhatsApp Cloud API poruka.',
            },
            {
                label: 'Phone number ID',
                description:
                    'ID WhatsApp Business broja koji šalje poruke, nije prikazani telefonski broj.',
            },
            {
                label: 'Graph API verzija',
                description:
                    'Meta Graph API verzija ako treba odstupati od zadane.',
            },
            {
                label: 'Recipient phone number',
                description:
                    'Primateljev WhatsApp broj u međunarodnom formatu bez +.',
            },
        ],
        formFields: formFieldHelp({
            providerName: 'WhatsApp',
            accountKeyExample: 'brand-main',
            handle: 'Naziv business broja ili prikazani WhatsApp naziv. Ovo je informativno polje.',
            externalAccountId:
                'WhatsApp phone number ID iz WhatsApp Managera. Unesi ga za audit, a tajnu konfiguraciju drži u zapisu vjerodajnice.',
            defaultDestination:
                'Primateljev WhatsApp broj u međunarodnom formatu bez +, npr. 385911234567.',
            allowedDestinations:
                'Svaki dopušteni broj primatelja u novi red. Za testiranje koristi samo interne brojeve.',
            credentialReference:
                'Naziv internog zapisa vjerodajnice koji sadrži WhatsApp access token, phone number ID i opcionalnu Graph API verziju.',
        }),
        mediaNotes: [
            'Ovo su direktne WhatsApp Cloud API poruke, ne javni Status ili Channel publishing.',
            'Jedan image ili video URL može se poslati po poruci; tekstualne poruke su podržane za service-window komunikaciju.',
        ],
        docsUrl:
            'https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages',
    },
] satisfies SocialProviderSetupGuide[];

export function getSocialProviderSetupGuide(provider: SocialProvider) {
    return socialProviderSetupGuides.find(
        (guide) => guide.provider === provider,
    );
}
