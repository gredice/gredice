import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { BaleHey } from './BaleHey';
import { BeachBall } from './BeachBall';
import { BeachChair } from './BeachChair';
import { BeachTowelStriped } from './BeachTowelStriped';
import { BeachUmbrella } from './BeachUmbrella';
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
import {
    BlockGrassCorner,
    BlockGroundCorner,
    BlockSandCorner,
    BlockSnowCorner,
} from './BlockTerrainCorner';
import {
    BlockGrassReverseCorner,
    BlockGroundReverseCorner,
    BlockSandReverseCorner,
    BlockSnowReverseCorner,
} from './BlockTerrainReverseCorner';
import { BlockWater } from './BlockWater';
import { Bucket } from './Bucket';
import { Bush } from './Bush';
import { Cactus } from './Cactus';
import { CatPillow } from './CatPillow';
import { Composter } from './Composter';
import { DeadTree } from './DeadTree';
import { DesertStone } from './DesertStone';
import { DogHouse } from './DogHouse';
import { Fence } from './Fence';
import { FireflyJar } from './FireflyJar';
import { GardenBox } from './GardenBox';
import { GiftBoxBlueWhite } from './GiftBoxBlueWhite';
import { GiftBoxGoldRed } from './GiftBoxGoldRed';
import { GiftBoxGreenGold } from './GiftBoxGreenGold';
import { GiftBoxPurpleSilver } from './GiftBoxPurpleSilver';
import { GiftBoxRedWhite } from './GiftBoxRedWhite';
import { GiftBoxWhiteGreen } from './GiftBoxWhiteGreen';
import { IceCreamCart } from './IceCreamCart';
import { InflatablePoolSmall } from './InflatablePoolSmall';
import { LemonadeStand } from './LemonadeStand';
import { LiquidPreparationBottle } from './LiquidPreparationBottle';
import { PaintRoller } from './PaintRoller';
import { PalmTree } from './PalmTree';
import { Pine } from './Pine';
import { PineAdvent } from './PineAdvent';
import { Pot } from './Pot';
import { RaisedBed } from './RaisedBed';
import { MulchCoconut } from './raisedBed/MulchCoconut';
import { MulchHey } from './raisedBed/MulchHey';
import { MulchWood } from './raisedBed/MulchWood';
import { Seed } from './raisedBed/Seed';
import { Stick } from './raisedBed/Stick';
import { SandcastleSmallA } from './SandcastleSmall';
import { Shade } from './Shade';
import { ShovelSmall } from './ShovelSmall';
import { Snowman } from './Snowman';
import { StoneLarge } from './StoneLarge';
import { StoneMedium } from './StoneMedium';
import { StoneSmall } from './StoneSmall';
import { Stool } from './Stool';
import { SummerHat } from './SummerHat';
import { Sunflower } from './Sunflower';
import { Tree } from './Tree';
import { Tulip } from './Tulip';
import { WateringCan } from './WateringCan';
import { WaterWell } from './WaterWell';

export const entityNameMap = {
    Block_Ground: BlockGround,
    Block_Grass: BlockGrass,
    Block_Sand: BlockSand,
    Block_Water: BlockWater,
    Block_Ground_Angle: BlockGroundAngle,
    Block_Grass_Angle: BlockGrassAngle,
    Block_Sand_Angle: BlockSandAngle,
    Block_Ground_Corner: BlockGroundCorner,
    Block_Grass_Corner: BlockGrassCorner,
    Block_Sand_Corner: BlockSandCorner,
    Block_Ground_Reverse_Corner: BlockGroundReverseCorner,
    Block_Grass_Reverse_Corner: BlockGrassReverseCorner,
    Block_Sand_Reverse_Corner: BlockSandReverseCorner,
    Block_Snow: BlockSnow,
    Block_Snow_Angle: BlockSnowAngle,
    Block_Snow_Corner: BlockSnowCorner,
    Block_Snow_Reverse_Corner: BlockSnowReverseCorner,
    Block_Snow_Falling: BlockSnowFalling,
    Composter: Composter,
    Raised_Bed: RaisedBed,
    Shade: Shade,
    BeachUmbrella: BeachUmbrella,
    Fence: Fence,
    GardenBox: GardenBox,
    Stool: Stool,
    Bucket: Bucket,
    WateringCan: WateringCan,
    LiquidPreparationBottlePestControl: LiquidPreparationBottle,
    LiquidPreparationBottleAphidControl: LiquidPreparationBottle,
    LiquidPreparationBottleSlugControl: LiquidPreparationBottle,
    LiquidPreparationBottleTomatoEggplantResistance: LiquidPreparationBottle,
    LiquidPreparationBottleFertilizer: LiquidPreparationBottle,
    LiquidPreparationBottleDiseaseControl: LiquidPreparationBottle,
    LiquidPreparationBottleWeevilControl: LiquidPreparationBottle,
    LiquidPreparationBottleVoleControl: LiquidPreparationBottle,
    LiquidPreparationBottleBeetleControl: LiquidPreparationBottle,
    PaintRoller: PaintRoller,
    WaterWell: WaterWell,
    LemonadeStand: LemonadeStand,
    IceCreamCart: IceCreamCart,
    SummerHat: SummerHat,
    BeachTowelStriped: BeachTowelStriped,
    InflatablePoolSmall: InflatablePoolSmall,
    BeachChair: BeachChair,
    PalmTree: PalmTree,
    BeachBall: BeachBall,
    SandcastleSmallA: SandcastleSmallA,
    BirdHouse: BirdHouse,
    CatPillow: CatPillow,
    Cat_Pillow: CatPillow,
    DogHouse: DogHouse,
    FireflyJar: FireflyJar,
    GiftBox_RedWhite: GiftBoxRedWhite,
    GiftBox_GreenGold: GiftBoxGreenGold,
    GiftBox_BlueWhite: GiftBoxBlueWhite,
    GiftBox_PurpleSilver: GiftBoxPurpleSilver,
    GiftBox_GoldRed: GiftBoxGoldRed,
    GiftBox_WhiteGreen: GiftBoxWhiteGreen,
    Bush: Bush,
    Tree: Tree,
    Pine: Pine,
    DeadTreeTall: DeadTree,
    DeadTreeStump: DeadTree,
    PineAdvent: PineAdvent,
    StoneSmall: StoneSmall,
    StoneMedium: StoneMedium,
    StoneLarge: StoneLarge,
    DesertStoneSmall: DesertStone,
    DesertStoneMedium: DesertStone,
    DesertStoneLarge: DesertStone,
    ShovelSmall: ShovelSmall,
    Snowman: Snowman,
    Tulip: Tulip,
    Sunflower: Sunflower,
    CactusBarrel: Cactus,
    CactusColumnCluster: Cactus,
    CactusPricklyPear: Cactus,
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
} satisfies Record<string, React.ComponentType<EntityInstanceProps>>;

export type EntityName = keyof typeof entityNameMap;
