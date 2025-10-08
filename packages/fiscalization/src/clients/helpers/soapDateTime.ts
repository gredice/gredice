/**
 * Formats a Date object into the specific string format required for Fiscalizacija SOAP requests.
 * e.g., "29.07.2025T18:46:23"
 */
export function soapDateTime(date: Date): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year}T${hours}:${minutes}:${seconds}`;
}
