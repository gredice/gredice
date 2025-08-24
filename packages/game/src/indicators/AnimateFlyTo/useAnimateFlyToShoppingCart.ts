import { type AnimationOptions, useAnimateFlyTo } from './useAnimateFlyTo';

export function useAnimateFlyToShoppingCart(options: AnimationOptions = {}) {
    const shoppingCartPositionX = window.innerWidth < 768 ? 30 : 20;
    const shoppingCartPositionY = window.innerWidth < 768 ? 90 : 70;
    return useAnimateFlyTo(
        shoppingCartPositionX,
        shoppingCartPositionY,
        options,
    );
}
