import type { Metadata } from 'next';
import { Logotype } from '../../components/Logotype';
import { getLiveActivitySnapshot } from '../../lib/live/getLiveActivitySnapshot';
import { LiveActivity } from './LiveActivity';
import styles from './live.module.css';

export const metadata: Metadata = {
    title: 'Živi vrt',
    description: 'Vizualni puls svega što se upravo događa u Gredicama.',
    openGraph: {
        title: 'Živi vrt | Gredice',
        description: 'Vizualni puls svega što se upravo događa u Gredicama.',
        images: [
            {
                alt: 'Vrt se upravo događa.',
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
        title: 'Živi vrt | Gredice',
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
                    <span className={styles.brandNote}>živi vrt</span>
                </div>
                <div className={styles.liveMark}>
                    <span className={styles.liveDot} aria-hidden="true" />
                    pratimo vrt
                </div>
            </header>

            <section className={styles.experience}>
                <div className={styles.hero}>
                    <p className={styles.eyebrow}>Pogled u Gredice</p>
                    <h1>
                        Vrt se upravo
                        <span>događa.</span>
                    </h1>
                    <p className={styles.intro}>
                        Tragovi sadnje, vode, vremena i ljudi — spojeni u jedan
                        živi prizor.
                    </p>
                </div>

                <LiveActivity initialSnapshot={snapshot} />
            </section>

            <footer className={styles.footer}>
                <p>Stvarni događaji iz posljednja tri sata.</p>
                <p className={styles.footerWhisper}>nastavlja se…</p>
            </footer>
        </main>
    );
}
