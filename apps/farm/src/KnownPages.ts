import type { Route } from 'next';

export const KnownPages = {
    Landing: '/',
    Greenhouse: '/greenhouse',
    RaisedBeds: '/raised-beds',
    RaisedBed: (raisedBedId: number) => `/raised-beds/${raisedBedId}` as Route,
    Schedule: '/schedule',
};
