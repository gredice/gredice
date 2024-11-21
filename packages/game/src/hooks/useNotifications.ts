type NotificationItem = {
    id: string,
    title: string,
    description: string,
    timeStamp: Date,
    read: boolean
};

export function useNotifications(): {
    data: { notifications: NotificationItem[] },
    isLoading: boolean
} {
    return {
        data: {
            notifications: [
                // { id: '1', title: 'Obavijest 1', description: 'Opis obavijesti 1', timeStamp: new Date(), read: false },
                // { id: '2', title: 'Obavijest 2', description: 'Opis obavijesti 2', timeStamp: new Date(), read: false },
            ]
        },
        isLoading: false
    }
}
