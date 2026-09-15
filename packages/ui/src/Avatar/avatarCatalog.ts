/// <reference types="next/image-types/global" />

import baldGardenerArtwork from './assets/bald-gardener.webp';
import beardedFarmerArtwork from './assets/bearded-farmer.webp';
import beekeeperArtwork from './assets/beekeeper.webp';
import botanistArtwork from './assets/botanist.webp';
import braidedGardenerArtwork from './assets/braided-gardener.webp';
import bumblebeeArtwork from './assets/bumblebee.webp';
import butterflyArtwork from './assets/butterfly.webp';
import femaleArtwork from './assets/farmer-female.webp';
import maleArtwork from './assets/farmer-male.webp';
import flowerGardenerArtwork from './assets/flower-gardener.webp';
import foxGardenerArtwork from './assets/fox-gardener.webp';
import gardenCatArtwork from './assets/garden-cat.webp';
import gardenChefArtwork from './assets/garden-chef.webp';
import gardenFrogArtwork from './assets/garden-frog.webp';
import gardenGnomeArtwork from './assets/garden-gnome.webp';
import gardenRobotArtwork from './assets/garden-robot.webp';
import grandmaGardenerArtwork from './assets/grandma-gardener.webp';
import grandpaGardenerArtwork from './assets/grandpa-gardener.webp';
import hedgehogArtwork from './assets/hedgehog.webp';
import ladybugArtwork from './assets/ladybug.webp';
import mushroomSpriteArtwork from './assets/mushroom-sprite.webp';
import orchardKeeperArtwork from './assets/orchard-keeper.webp';
import rabbitArtwork from './assets/rabbit.webp';
import rainGardenerArtwork from './assets/rain-gardener.webp';
import teenGardenerArtwork from './assets/teen-gardener.webp';
import winterGardenerArtwork from './assets/winter-gardener.webp';
import woodenRobotArtwork from './assets/wooden-robot.webp';
import youngFarmerBoyArtwork from './assets/young-farmer-boy.webp';
import youngFarmerGirlArtwork from './assets/young-farmer-girl.webp';

// Stable profile values: never persist build-specific imported asset URLs.
export const farmerAvatarUrls = {
    male: 'https://cdn.gredice.com/avatars/farmer-male.png',
    female: 'https://cdn.gredice.com/avatars/farmer-female.png',
};

export const avatarCategories = ['Vrtlari', 'Životinje', 'Maštoviti likovi'];

export const builtInAvatars = [
    {
        id: 'farmer-male',
        label: 'Farmer',
        category: 'Vrtlari',
        avatarUrl: farmerAvatarUrls.male,
        artwork: maleArtwork,
    },
    {
        id: 'farmer-female',
        label: 'Farmerka',
        category: 'Vrtlari',
        avatarUrl: farmerAvatarUrls.female,
        artwork: femaleArtwork,
    },
    {
        id: 'bearded-farmer',
        label: 'Bradati farmer',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/bearded-farmer.webp',
        artwork: beardedFarmerArtwork,
    },
    {
        id: 'grandpa-gardener',
        label: 'Djed vrtlar',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/grandpa-gardener.webp',
        artwork: grandpaGardenerArtwork,
    },
    {
        id: 'grandma-gardener',
        label: 'Baka vrtlarica',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/grandma-gardener.webp',
        artwork: grandmaGardenerArtwork,
    },
    {
        id: 'flower-gardener',
        label: 'Cvjetna vrtlarica',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/flower-gardener.webp',
        artwork: flowerGardenerArtwork,
    },
    {
        id: 'orchard-keeper',
        label: 'Čuvarica voćnjaka',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/orchard-keeper.webp',
        artwork: orchardKeeperArtwork,
    },
    {
        id: 'young-farmer-boy',
        label: 'Mali farmer',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/young-farmer-boy.webp',
        artwork: youngFarmerBoyArtwork,
    },
    {
        id: 'young-farmer-girl',
        label: 'Mala farmerka',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/young-farmer-girl.webp',
        artwork: youngFarmerGirlArtwork,
    },
    {
        id: 'teen-gardener',
        label: 'Mladi vrtlar',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/teen-gardener.webp',
        artwork: teenGardenerArtwork,
    },
    {
        id: 'braided-gardener',
        label: 'Vrtlarica s pletenicama',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/braided-gardener.webp',
        artwork: braidedGardenerArtwork,
    },
    {
        id: 'bald-gardener',
        label: 'Vrtlar s naočalama',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/bald-gardener.webp',
        artwork: baldGardenerArtwork,
    },
    {
        id: 'rain-gardener',
        label: 'Vrtlarica na kiši',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/rain-gardener.webp',
        artwork: rainGardenerArtwork,
    },
    {
        id: 'winter-gardener',
        label: 'Zimski vrtlar',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/winter-gardener.webp',
        artwork: winterGardenerArtwork,
    },
    {
        id: 'beekeeper',
        label: 'Pčelarica',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/beekeeper.webp',
        artwork: beekeeperArtwork,
    },
    {
        id: 'botanist',
        label: 'Botaničarka',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/botanist.webp',
        artwork: botanistArtwork,
    },
    {
        id: 'garden-chef',
        label: 'Vrtni kuhar',
        category: 'Vrtlari',
        avatarUrl: 'https://cdn.gredice.com/avatars/garden-chef.webp',
        artwork: gardenChefArtwork,
    },
    {
        id: 'garden-robot',
        label: 'Vrtni robot',
        category: 'Maštoviti likovi',
        avatarUrl: 'https://cdn.gredice.com/avatars/garden-robot.webp',
        artwork: gardenRobotArtwork,
    },
    {
        id: 'wooden-robot',
        label: 'Drveni robot',
        category: 'Maštoviti likovi',
        avatarUrl: 'https://cdn.gredice.com/avatars/wooden-robot.webp',
        artwork: woodenRobotArtwork,
    },
    {
        id: 'butterfly',
        label: 'Leptir',
        category: 'Životinje',
        avatarUrl: 'https://cdn.gredice.com/avatars/butterfly.webp',
        artwork: butterflyArtwork,
    },
    {
        id: 'bumblebee',
        label: 'Bumbar',
        category: 'Životinje',
        avatarUrl: 'https://cdn.gredice.com/avatars/bumblebee.webp',
        artwork: bumblebeeArtwork,
    },
    {
        id: 'ladybug',
        label: 'Bubamara',
        category: 'Životinje',
        avatarUrl: 'https://cdn.gredice.com/avatars/ladybug.webp',
        artwork: ladybugArtwork,
    },
    {
        id: 'garden-frog',
        label: 'Vrtna žabica',
        category: 'Životinje',
        avatarUrl: 'https://cdn.gredice.com/avatars/garden-frog.webp',
        artwork: gardenFrogArtwork,
    },
    {
        id: 'hedgehog',
        label: 'Ježić',
        category: 'Životinje',
        avatarUrl: 'https://cdn.gredice.com/avatars/hedgehog.webp',
        artwork: hedgehogArtwork,
    },
    {
        id: 'rabbit',
        label: 'Zeko',
        category: 'Životinje',
        avatarUrl: 'https://cdn.gredice.com/avatars/rabbit.webp',
        artwork: rabbitArtwork,
    },
    {
        id: 'garden-cat',
        label: 'Vrtna maca',
        category: 'Životinje',
        avatarUrl: 'https://cdn.gredice.com/avatars/garden-cat.webp',
        artwork: gardenCatArtwork,
    },
    {
        id: 'fox-gardener',
        label: 'Lisica vrtlarica',
        category: 'Životinje',
        avatarUrl: 'https://cdn.gredice.com/avatars/fox-gardener.webp',
        artwork: foxGardenerArtwork,
    },
    {
        id: 'mushroom-sprite',
        label: 'Duh gljive',
        category: 'Maštoviti likovi',
        avatarUrl: 'https://cdn.gredice.com/avatars/mushroom-sprite.webp',
        artwork: mushroomSpriteArtwork,
    },
    {
        id: 'garden-gnome',
        label: 'Vrtni patuljak',
        category: 'Maštoviti likovi',
        avatarUrl: 'https://cdn.gredice.com/avatars/garden-gnome.webp',
        artwork: gardenGnomeArtwork,
    },
];
