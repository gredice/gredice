export function plantFieldStatusEmoji(status: string | undefined) {
    switch (status) {
        case 'new':
            return '🆕';
        case 'planned':
            return '🗓️';
        case 'pendingVerification':
            return '🔍';
        case 'sowed':
            return '🫘';
        case 'sprouted':
            return '🌱';
        case 'firstFlowers':
            return '🌸';
        case 'firstFruitSet':
            return '🍅';
        case 'notSprouted':
            return '❌';
        case 'died':
            return '💀';
        case 'ready':
            return '🥕';
        case 'harvested':
            return '🌾';
        case 'removed':
            return '🗑️';
        default:
            return '❔';
    }
}
