import Image from 'next/image';
import europeanUnionFlag from './assets/eu.svg';
import croatiaFlag from './assets/hr.svg';

export function PublicFooterOrigin() {
    return (
        <div className="flex flex-col items-center gap-3 text-center text-[18px] font-medium leading-7 text-foreground @[48rem]/cms:flex-row @[48rem]/cms:gap-4 @[48rem]/cms:text-[20px]">
            <span className="flex shrink-0 items-center gap-2">
                <Image
                    src={croatiaFlag}
                    alt="Hrvatska"
                    className="h-[30px] w-10 @[48rem]/cms:h-9 @[48rem]/cms:w-12"
                    width={48}
                    height={36}
                    unoptimized
                />
                <Image
                    src={europeanUnionFlag}
                    alt="Europska unija"
                    className="h-[30px] w-10 @[48rem]/cms:h-9 @[48rem]/cms:w-12"
                    width={48}
                    height={36}
                    unoptimized
                />
            </span>
            <span>S ljubavlju iz Hrvatske.</span>
        </div>
    );
}
