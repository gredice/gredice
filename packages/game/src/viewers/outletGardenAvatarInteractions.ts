export function shouldOpenOutletGardenOfferModal({
    avatarWalking,
    offerListOpen,
    selectedOfferId,
}: {
    avatarWalking: boolean;
    offerListOpen: boolean;
    selectedOfferId: number | null;
}) {
    return (!avatarWalking && offerListOpen) || selectedOfferId !== null;
}
