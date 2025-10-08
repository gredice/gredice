import type { FiskalizacijaPortType } from '../ports/FiskalizacijaPortType';

export interface FiskalizacijaService {
    readonly FiskalizacijaPortType: FiskalizacijaPortType;
}
