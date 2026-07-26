export function surveyStatusLabel(status: string) {
    return (
        {
            archived: 'Arhivirano',
            draft: 'Nacrt',
            expired: 'Isteklo',
            pending: 'Čeka',
            published: 'Objavljeno',
            sent: 'Poslano',
            started: 'Započeto',
            submitted: 'Predano',
        }[status] ?? status
    );
}

export function surveyStatusColor(
    status: string,
): 'success' | 'warning' | 'neutral' | 'primary' {
    if (status === 'published' || status === 'submitted' || status === 'sent') {
        return 'success';
    }
    if (status === 'draft' || status === 'pending' || status === 'started') {
        return 'warning';
    }
    if (status === 'archived' || status === 'expired') {
        return 'neutral';
    }
    return 'primary';
}
