import { DeliveryRunExecutionError } from '@gredice/storage';

export type DeliveryRunExecutionErrorDetails = {
    code: string;
    message: string;
};

export function deliveryRunExecutionErrorDetails(
    error: unknown,
): DeliveryRunExecutionErrorDetails | null {
    if (!(error instanceof DeliveryRunExecutionError)) return null;

    switch (error.code) {
        case 'pickup-dependency-pending':
            return {
                code: error.code,
                message:
                    'Najprije potvrdi preuzimanje svih uroda na trenutačnoj lokaciji.',
            };
        case 'route-order':
            return {
                code: error.code,
                message: 'Ova dostava još nije na redu rute.',
            };
        case 'active-run-not-found':
            return {
                code: error.code,
                message: 'Aktivna ruta više nije dostupna.',
            };
        case 'route-revision-conflict':
            return {
                code: error.code,
                message:
                    'Ruta je u međuvremenu promijenjena. Osvježi podatke i pokušaj ponovno.',
            };
        case 'exception-operation-conflict':
            return {
                code: error.code,
                message:
                    'Ova prijava problema već je korištena s drugim podacima. Provjeri osvježenu rutu i ponovno potvrdi odabir.',
            };
        case 'exception-transition-invalid':
            return {
                code: error.code,
                message:
                    'Stanje odabranog uroda promijenilo se. Provjeri osvježenu rutu i ponovno potvrdi odabir.',
            };
        default:
            return {
                code: error.code,
                message: 'Radnju nije moguće primijeniti na trenutačnu rutu.',
            };
    }
}
