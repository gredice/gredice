import Image from 'next/image';
import europeanUnionFlag from './assets/eu.svg';
import croatiaFlag from './assets/hr.svg';

export function PublicFooterOrigin() {
    return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex shrink-0 items-center gap-1.5">
                <Image
                    src={croatiaFlag}
                    alt="Hrvatska"
                    width={24}
                    height={18}
                    unoptimized
                />
                <Image
                    src={europeanUnionFlag}
                    alt="Europska unija"
                    width={24}
                    height={18}
                    unoptimized
                />
            </span>
            <span>S ljubavlju iz Hrvatske.</span>
        </div>
    );
}
