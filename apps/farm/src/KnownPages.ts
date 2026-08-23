import type { Route } from 'next';

export const KnownPages = {
    Landing: '/' satisfies Route,
    Today: '/' satisfies Route,
    Greenhouse: '/greenhouse' satisfies Route,
    More: '/more' satisfies Route,
    Notifications: '/notifications' satisfies Route,
    Operations: '/operations' satisfies Route,
    Operation: (operationId: number) => `/operations/${operationId}` as Route,
    Payouts: '/payouts' satisfies Route,
    Plants: '/plants' satisfies Route,
    Plant: (plantSortId: number) => `/plants/${plantSortId}` as Route,
    RaisedBeds: '/raised-beds' satisfies Route,
    RaisedBed: (raisedBedId: number) => `/raised-beds/${raisedBedId}` as Route,
    Schedule: '/schedule' satisfies Route,
    Settings: '/settings' satisfies Route,
} as const;
