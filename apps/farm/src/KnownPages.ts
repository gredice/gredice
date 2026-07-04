import type { Route } from 'next';

export const KnownPages = {
    Landing: '/',
    Greenhouse: '/greenhouse',
    Notifications: '/notifications',
    RaisedBeds: '/raised-beds',
    RaisedBed: (raisedBedId: number) => `/raised-beds/${raisedBedId}` as Route,
    Schedule: '/schedule',
};
