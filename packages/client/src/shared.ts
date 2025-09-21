export function getAppUrl() {
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'development') {
        return `http://api.gredice.local`;
    } else {
        return `https://api.gredice.com`;
    }
}

export function getAuthToken() {
    if (typeof localStorage === 'undefined') {
        return null;
    }

    return localStorage.getItem('gredice-token');
}

export function getAuthHeaders() {
    if (typeof localStorage === 'undefined') {
        return null;
    }

    return `Bearer ${getAuthToken()}`;
}
