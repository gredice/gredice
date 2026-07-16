/**
 * Removes driver-only fulfillment notes before an account-owned request leaves
 * the customer API boundary. Customer-safe handoff data is already reduced to
 * a bounded receipt by the storage projection.
 */
export function customerDeliveryRequest<
    TRequest extends { deliveryNotes?: unknown },
>(request: TRequest) {
    const { deliveryNotes: _driverOnlyNotes, ...customerRequest } = request;
    return customerRequest;
}
