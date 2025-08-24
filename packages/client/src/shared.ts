export function getAppUrl() {
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'development') {
        return `http://localhost:3005`;
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
