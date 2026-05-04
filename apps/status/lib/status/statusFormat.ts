export function formatTimestamp(value: string | null) {
    if (!value) {
        return 'Čeka se';
    }

    const date = new Date(value);

    if (Number.isNaN(date.valueOf())) {
        return 'Čeka se';
    }

    return new Intl.DateTimeFormat('hr-HR', {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        timeZone: 'UTC',
        timeZoneName: 'short',
        year: 'numeric',
    }).format(date);
}

export function formatDuration(value: number | null) {
    if (value == null) {
        return 'Čeka se';
    }

    return `${Math.round(value)} ms`;
}
