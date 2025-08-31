import type { Route } from 'next';

export const KnownPages = {
    Dashboard: '/admin',
    Directories: '/admin/directories',
    DirectoryEntityType: (entityTypeName: string) =>
        `/admin/directories/${entityTypeName}` as Route,
    DirectoryEntityTypeEdit: (entityTypeName: string) =>
        `/admin/directories/${entityTypeName}/edit` as Route,
    DirectoryEntityTypeCreate: '/admin/directories/entity-types/create',
    DirectoryEntityTypeAttributeDefinitions: (entityTypeName: string) =>
        `/admin/directories/${entityTypeName}/attribute-definitions` as Route,
    DirectoryEntityTypeAttributeDefinitionCategory: (
        entityTypeName: string,
        id: number,
    ) =>
        `/admin/directories/${entityTypeName}/attribute-definitions/categories/${id}` as Route,
    DirectoryEntityTypeAttributeDefinition: (
        entityTypeName: string,
        id: number,
    ) =>
        `/admin/directories/${entityTypeName}/attribute-definitions/${id}` as Route,
    DirectoryEntity: (entityTypeName: string, entityId: number) =>
        `/admin/directories/${entityTypeName}/${entityId}` as Route,
    DirectoryEntityPath: '/admin/directories/[entityType]/[entityId]',
    DirectoryCategoryCreate: '/admin/directories/categories/create',
    DirectoryCategoryEdit: (categoryId: number) =>
        `/admin/directories/categories/${categoryId}/edit` as Route,
    Users: '/admin/users',
    User: (userId: string) => `/admin/users/${userId}` as Route,
    Schedule: '/admin/schedule',
    Accounts: '/admin/accounts',
    Account: (accountId: string) => `/admin/accounts/${accountId}` as Route,
    Gardens: '/admin/gardens',
    Garden: (gardenId: number) => `/admin/gardens/${gardenId}` as Route,
    CommunicationInbox: '/admin/communication/inbox',
    Feedback: '/admin/feedback',
    Logout: '/admin/logout',
    RaisedBeds: '/admin/raised-beds',
    RaisedBed: (raisedBedId: number) =>
        `/admin/raised-beds/${raisedBedId}` as Route,
    Transactions: '/admin/transactions',
    Transaction: (transactionId: number) =>
        `/admin/transactions/${transactionId}` as Route,
    Invoices: '/admin/invoices',
    CreateInvoice: '/admin/invoices/create',
    Invoice: (invoiceId: number) => `/admin/invoices/${invoiceId}` as Route,
    Receipts: '/admin/receipts',
    Receipt: (receiptId: number) => `/admin/receipts/${receiptId}` as Route,
    ShoppingCarts: '/admin/shopping-carts',
    ShoppingCart: (cartId: number) =>
        `/admin/shopping-carts/${cartId}` as Route,
    Operations: '/admin/operations',
    Operation: (operationId: number) =>
        `/admin/operations/${operationId}` as Route,
    Sensors: '/admin/sensors',
    Cache: '/admin/cache',

    // Delivery management
    DeliverySlots: '/admin/delivery/slots',
    DeliveryRequests: '/admin/delivery/requests',

    // External links
    StripePayment: (paymentId: string) =>
        `https://dashboard.stripe.com/payments/${paymentId}`,
    GrediceOperations: `https://www.gredice.com/radnje`,
    GrediceOperation: (operationAlias: string) =>
        `https://www.gredice.com/radnje/${encodeURIComponent(operationAlias)}`,
} as const;
