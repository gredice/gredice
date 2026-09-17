import type { SVGProps } from 'react';
import { GameIconFrame } from '../GameIcons/GameIconFrame';
import basket from './assets/package-basket.webp';
import master from './assets/package-master.webp';
import season from './assets/package-season.webp';
import small from './assets/package-small.webp';
import starter from './assets/package-starter.webp';

/** Package codes are stable catalogue identifiers; unknown packages use the small bundle. */
export function SunflowerPackageVisual({
    packageCode,
    ...props
}: SVGProps<SVGSVGElement> & { packageCode?: string }) {
    const artwork =
        packageCode === 'puna_gredica'
            ? starter
            : packageCode === 'vrtna_kosarica'
              ? basket
              : packageCode === 'mirna_sezona'
                ? season
                : packageCode === 'majstor_vrtlar'
                  ? master
                  : small;

    return (
        <GameIconFrame
            source={artwork}
            label="Paket suncokreta"
            data-sunflower-package-artwork={packageCode ?? 'generic'}
            {...props}
        />
    );
}
