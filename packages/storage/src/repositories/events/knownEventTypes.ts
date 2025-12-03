export const knownEventTypes = {
    accounts: {
        create: 'account.create',
        assignUser: 'account.assignUser',
        earnSunflowers: 'account.earnSunflowers',
        spendSunflowers: 'account.spendSunflowers',
    },
    users: {
        create: 'user.create',
    },
    gardens: {
        create: 'garden.create',
        rename: 'garden.rename',
        delete: 'garden.delete',
        blockPlace: 'garden.blockPlace',
    },
    transactions: {
        create: 'transaction.create',
        update: 'transaction.update',
        delete: 'transaction.delete',
    },
    invoices: {
        create: 'invoice.create',
        update: 'invoice.update',
        delete: 'invoice.delete',
        paid: 'invoice.paid',
    },
    receipts: {
        create: 'receipt.create',
        update: 'receipt.update',
        fiscalize: 'receipt.fiscalize',
    },
    raisedBeds: {
        create: 'raisedBed.create',
        place: 'raisedBed.place',
        delete: 'raisedBed.delete',
        abandon: 'raisedBed.abandon',
    },
    raisedBedFields: {
        create: 'raisedBedField.create',
        delete: 'raisedBedField.delete',
        plantPlace: 'raisedBedField.plantPlace',
        plantSchedule: 'raisedBedField.plantSchedule',
        plantUpdate: 'raisedBedField.plantUpdate',
        plantReplaceSort: 'raisedBedField.plantReplaceSort',
    },
    operations: {
        schedule: 'operation.schedule',
        complete: 'operation.complete',
        fail: 'operation.fail',
        cancel: 'operation.cancel',
    },
    delivery: {
        requestCreated: 'delivery.request.created',
        requestSlotChanged: 'delivery.request.slot.changed',
        requestAddressChanged: 'delivery.request.address.changed',
        requestConfirmed: 'delivery.request.confirmed',
        requestPreparing: 'delivery.request.preparing',
        requestReady: 'delivery.request.ready',
        requestCancelled: 'delivery.request.cancelled',
        requestFulfilled: 'delivery.request.fulfilled',
        requestSurveySent: 'delivery.request.survey_sent',
        userCancelled: 'delivery.request.user_cancelled',
    },
    occasions: {
        adventCalendarOpen: 'occasion.advent.calendar.open',
    },
} as const;
