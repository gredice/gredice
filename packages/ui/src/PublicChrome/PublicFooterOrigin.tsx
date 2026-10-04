import Image from 'next/image';
import europeanUnionFlag from './assets/eu.svg';
import croatiaFlag from './assets/hr.svg';

export function PublicFooterOrigin() {
    return (
        <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 text-center text-[13px] font-normal leading-5 text-foreground/70 @[48rem]/cms:justify-start">
            <span className="flex shrink-0 items-center gap-1">
                <Image
                    src={croatiaFlag}
                    alt="Hrvatska"
                    className="h-[18px] w-6"
                    width={24}
                    height={18}
                    unoptimized
                />
                <Image
                    src={europeanUnionFlag}
                    alt="Europska unija"
                    className="h-[18px] w-6"
                    width={24}
                    height={18}
                    unoptimized
                />
            </span>
            <span>S ljubavlju iz Hrvatske.</span>
        </div>
    );
}
