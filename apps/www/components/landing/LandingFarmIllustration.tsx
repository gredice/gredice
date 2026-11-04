import { MapPin } from '@gredice/ui/icons';
import Image from 'next/image';
import PartnerFarmVisual from '../../assets/PartnerFarmVisual.webp';

/** Partner farm (OPG) artwork beside the "Upoznaj OPG" copy on the landing page. */
export function LandingFarmIllustration() {
    return (
        <div className="relative flex h-52 w-full items-center justify-center overflow-hidden rounded-xl bg-brand/10 px-3 pt-11 pb-2 sm:w-80 sm:shrink-0">
            <Image
                src={PartnerFarmVisual}
                alt="Ilustracija partnerskog OPG-a s podignutim gredicama"
                className="size-full object-contain"
                sizes="(min-width: 640px) 320px, 100vw"
            />
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-white px-2.5 py-1 text-xs font-semibold text-green-900">
                <MapPin aria-hidden className="size-3.5" />
                OPG Bosiljevo
            </span>
        </div>
    );
}
