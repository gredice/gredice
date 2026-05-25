import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { BaleHey } from './BaleHey';
import { BirdHouse } from './BirdHouse';
import { BlockGrass } from './BlockGrass';
import { BlockGrassAngle } from './BlockGrassAngle';
import { BlockGround } from './BlockGround';
import { BlockGroundAngle } from './BlockGroundAngle';
import { BlockSand } from './BlockSand';
import { BlockSandAngle } from './BlockSandAngle';
import { BlockSnow } from './BlockSnow';
import { BlockSnowAngle } from './BlockSnowAngle';
import { BlockSnowFalling } from './BlockSnowFalling';
import { Bucket } from './Bucket';
import { Bush } from './Bush';
import { Composter } from './Composter';
import { Fence } from './Fence';
import { GardenBox } from './GardenBox';
import { GiftBoxBlueWhite } from './GiftBoxBlueWhite';
import { GiftBoxGoldRed } from './GiftBoxGoldRed';
import { GiftBoxGreenGold } from './GiftBoxGreenGold';
import { GiftBoxPurpleSilver } from './GiftBoxPurpleSilver';
import { GiftBoxRedWhite } from './GiftBoxRedWhite';
import { GiftBoxWhiteGreen } from './GiftBoxWhiteGreen';
import { Pine } from './Pine';
import { PineAdvent } from './PineAdvent';
import { Pot } from './Pot';
import { RaisedBed } from './RaisedBed';
import { MulchCoconut } from './raisedBed/MulchCoconut';
import { MulchHey } from './raisedBed/MulchHey';
import { MulchWood } from './raisedBed/MulchWood';
import { Seed } from './raisedBed/Seed';
import { Stick } from './raisedBed/Stick';
import { Shade } from './Shade';
import { ShovelSmall } from './ShovelSmall';
import { Snowman } from './Snowman';
import { StoneLarge } from './StoneLarge';
import { StoneMedium } from './StoneMedium';
import { StoneSmall } from './StoneSmall';
import { Stool } from './Stool';
import { Tree } from './Tree';
import { Tulip } from './Tulip';
import { WateringCan } from './WateringCan';

export const entityNameMap: Record<
    string,
    React.ComponentType<EntityInstanceProps>
> = {
    Block_Ground: BlockGround,
    Block_Grass: BlockGrass,
    Block_Sand: BlockSand,
    Block_Ground_Angle: BlockGroundAngle,
    Block_Grass_Angle: BlockGrassAngle,
    Block_Sand_Angle: BlockSandAngle,
    Block_Snow: BlockSnow,
    Block_Snow_Angle: BlockSnowAngle,
    Block_Snow_Falling: BlockSnowFalling,
    Composter: Composter,
    Raised_Bed: RaisedBed,
    Shade: Shade,
    Fence: Fence,
    GardenBox: GardenBox,
    Stool: Stool,
    Bucket: Bucket,
    WateringCan: WateringCan,
    BirdHouse: BirdHouse,
    GiftBox_RedWhite: GiftBoxRedWhite,
    GiftBox_GreenGold: GiftBoxGreenGold,
    GiftBox_BlueWhite: GiftBoxBlueWhite,
    GiftBox_PurpleSilver: GiftBoxPurpleSilver,
    GiftBox_GoldRed: GiftBoxGoldRed,
    GiftBox_WhiteGreen: GiftBoxWhiteGreen,
    Bush: Bush,
    Tree: Tree,
    Pine: Pine,
    PineAdvent: PineAdvent,
    StoneSmall: StoneSmall,
    StoneMedium: StoneMedium,
    StoneLarge: StoneLarge,
    ShovelSmall: ShovelSmall,
    Snowman: Snowman,
    Tulip: Tulip,
    BaleHey: BaleHey,
    PotLowBowl: Pot,
    PotRoundedBowl: Pot,
    PotBulbousNeck: Pot,
    PotTallTapered: Pot,
    PotHourglass: Pot,
    PotStraightShortTub: Pot,
    PotNarrowFootBowl: Pot,
    PotSquatRidged: Pot,
    PotTallSlenderCone: Pot,
    PotWideLippedCup: Pot,

    // Raised bed items
    MulchHey: MulchHey,
    MulchCoconut: MulchCoconut,
    MulchWood: MulchWood,
    Stick: Stick,
    Seed: Seed,
};
