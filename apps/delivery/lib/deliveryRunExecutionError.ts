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
        default:
            return {
                code: error.code,
                message: 'Radnju nije moguće primijeniti na trenutačnu rutu.',
            };
    }
}
