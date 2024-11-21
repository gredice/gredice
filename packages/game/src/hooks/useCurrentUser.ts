export function useCurrentUser() {
    return {
        data: { user: { email: 'user@example.com', displayName: 'Korisnik 123', createdAt: new Date().getDate() } },
        isLoading: false
    }
}
