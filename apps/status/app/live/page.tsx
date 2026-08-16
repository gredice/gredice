import type { Metadata } from 'next';
import { Logotype } from '../../components/Logotype';
import { getLiveActivitySnapshot } from '../../lib/live/getLiveActivitySnapshot';
import { LiveActivity } from './LiveActivity';
import styles from './live.module.css';

export const metadata: Metadata = {
    title: 'Živi puls',
    description: 'Vizualni puls svega što se upravo događa u Gredicama.',
    openGraph: {
        title: 'Živi puls | Gredice',
        description: 'Vizualni puls svega što se upravo događa u Gredicama.',
        images: [
            {
                alt: 'Gredice se upravo događaju.',
                height: 941,
                url: '/og-live.png',
                width: 1672,
            },
        ],
        type: 'website',
        url: '/live',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Živi puls | Gredice',
        description: 'Vizualni puls svega što se upravo događa u Gredicama.',
        images: ['/og-live.png'],
    },
};

export const revalidate = 30;

export default async function LivePage() {
    const snapshot = await getLiveActivitySnapshot();

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div className={styles.brand}>
                    <Logotype className={styles.logo} height={28} priority />
                    <span aria-hidden="true" className={styles.brandLine} />
                    <span className={styles.brandNote}>živi puls</span>
                </div>
                <div className={styles.liveMark}>
                    <span className={styles.liveDot} aria-hidden="true" />
                    sustav živi
                </div>
            </header>

            <section className={styles.experience}>
                <div className={styles.hero}>
                    <p className={styles.eyebrow}>Pogled u Gredice</p>
                    <h1>
                        Gredice se upravo
                        <span>događa.</span>
                    </h1>
                    <p className={styles.intro}>
                        Tragovi vrta, aplikacija i koda — spojeni u jedan živi
                        prizor.
                    </p>
                </div>

                <LiveActivity initialSnapshot={snapshot} />
            </section>

            <footer className={styles.footer}>
                <p>Stvarni tragovi iz posljednja tri sata.</p>
                <p className={styles.footerWhisper}>nastavlja se…</p>
            </footer>
        </main>
    );
}
