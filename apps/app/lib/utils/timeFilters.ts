/**
 * Utility functions for handling time filters
 * Can be used in both server and client components
 */

export function getDateFromTimeFilter(filterValue: string): Date | undefined {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filterValue) {
        case 'today':
            return today;
        case 'yesterday':
            return new Date(today.getTime() - 24 * 60 * 60 * 1000);
        case 'last-7-days':
            return new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        case 'last-14-days':
            return new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
        case 'last-30-days':
            return new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        case 'last-90-days':
            return new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        case 'this-month':
            return new Date(now.getFullYear(), now.getMonth(), 1);
        case 'last-month':
            return new Date(now.getFullYear(), now.getMonth() - 1, 1);
        case 'this-year':
            return new Date(now.getFullYear(), 0, 1);
        case 'last-year':
            return new Date(now.getFullYear() - 1, 0, 1);
        default:
            return undefined;
    }
}
