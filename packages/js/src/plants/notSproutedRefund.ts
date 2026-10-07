export const notSproutedRefundMinimumDays = 15;

export function isNotSproutedRefundEligible(
    sowedAt: Date | string | null | undefined,
    changedAt: Date | string,
    hasSprouted = false,
) {
    if (!sowedAt || hasSprouted) return false;
    const elapsed = new Date(changedAt).getTime() - new Date(sowedAt).getTime();
    return elapsed >= notSproutedRefundMinimumDays * 24 * 60 * 60 * 1000;
}

export const notSproutedRefundPolicy =
    'Ako biljka nije proklijala, promijeni stanje u „Nije proklijala” nakon najmanje 15 dana od sijanja. Puni plaćeni iznos sadnje automatski vraćamo na tvoj saldo u suncokretima, jednom po sadnji. Povrat vrijedi samo za sadnje bez evidentiranog klijanja ili kasnije faze razvoja. Za sadnju plaćenu eurima povrat se obračunava po tečaju 1 € = 1.000 🌻. Ako na odabrani datum promjene nije prošlo 15 dana od sijanja, nema povrata. Biljke iz zalihe bez plaćene sadnje nemaju iznos za povrat.';

export function notSproutedRefundConfirmation(
    sowedAt: Date | string | null | undefined,
    changedAt: Date | string,
    hasSprouted = false,
) {
    if (hasSprouted) {
        return 'U povijesti ove sadnje evidentirano je da je biljka već proklijala ili dosegla kasniju fazu razvoja. Ova promjena stanja neće vratiti suncokrete.';
    }
    return isNotSproutedRefundEligible(sowedAt, changedAt, hasSprouted)
        ? 'Prošlo je najmanje 15 dana od sijanja. Puni plaćeni iznos sadnje vratit ćemo na tvoj saldo u suncokretima, ako za ovu sadnju povrat već nije izvršen. Sadnja iz zalihe bez plaćanja nema iznos za povrat.'
        : 'Na odabrani datum nije prošlo najmanje 15 dana od evidentiranog sijanja. Ova promjena stanja neće vratiti suncokrete. Pričekaj najmanje 15 dana od sijanja prije nego što prijaviš da biljka nije proklijala.';
}
