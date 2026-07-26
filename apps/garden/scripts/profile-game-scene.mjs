import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const defaultBaseUrl = 'http://localhost:3001';
const defaultOutDir = resolve(appRoot, 'test-results/game-profile');
const gameProfileWeatherTransitionEventName =
    'gredice:game-profile-weather-transition';
const gameProfileCloseupCommandEventName =
    'gredice:game-profile-closeup-command';
const gameProfilePlacementCommandEventName =
    'gredice:game-profile-placement-command';
const gameProfileOutlineCommandEventName =
    'gredice:game-profile-outline-command';
const adaptiveHighQualityProfileControlEventName =
    'gredice:adaptive-high-profile-control';
const highTargetExpectedGeneratedPlantFieldCount = 54;
const highTargetExpectedGeneratedPlantInstanceCount = 537;
const highTargetOperationVisualExpectedGeneratedPlantFieldCount = 34;
const highTargetOperationVisualExpectedGeneratedPlantInstanceCount = 286;
const highTargetOperationVisualExpectedFieldInstanceCount = 396;
const highTargetOperationVisualExpectedMulchInstanceCount = 54;
const highTargetOperationVisualHighlightObjectCount = 2;
const highTargetOperationVisualLegacyObjectCount = 452;
const highTargetOperationVisualRenderedObjectLimit = 64;
const chromiumGraphicsBackends = ['angle-metal', 'auto', 'default'];

const coreScenarios = [
    {
        name: 'game-baseline-desktop',
        path: '/debug/profile/game?mode=baseline&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'game',
    },
    {
        name: 'game-baseline-mobile',
        path: '/debug/profile/game?mode=baseline&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameMobile',
    },
    {
        name: 'game-details-desktop',
        path: '/debug/profile/game?mode=details&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDetails',
    },
    {
        name: 'game-rain-mobile',
        path: '/debug/profile/game?mode=rain&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'weatherMobile',
    },
    {
        name: 'game-snow-mobile',
        path: '/debug/profile/game?mode=snow&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'weatherMobile',
    },
    {
        name: 'plants-desktop',
        path: '/debug/plants',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'plants',
    },
];

const denseScenarios = [
    {
        name: 'game-dense-25x25-desktop',
        path: '/debug/profile/game?mode=details&profile=dense&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDense',
    },
    {
        name: 'game-dense-25x25-high-desktop',
        path: '/debug/profile/game?mode=details&profile=dense&quality=high',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseHigh',
    },
    {
        name: 'game-dense-25x25-controls-desktop',
        path: '/debug/profile/game?mode=details&profile=dense&controls=1&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDense',
    },
    {
        name: 'game-dense-25x25-camera-motion',
        path: '/debug/profile/game?mode=details&profile=dense&controls=1&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseMotion',
        motion: 'pan-zoom-rotate',
    },
    {
        name: 'game-dense-25x25-rain-desktop',
        path: '/debug/profile/game?mode=rain&profile=dense&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseWeather',
    },
    {
        name: 'game-dense-25x25-snow-desktop',
        path: '/debug/profile/game?mode=snow&profile=dense&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseWeather',
    },
    {
        name: 'game-dense-25x25-cloudy-desktop',
        path: '/debug/profile/game?mode=cloudy&profile=dense&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseWeather',
    },
    {
        name: 'game-dense-25x25-windy-desktop',
        path: '/debug/profile/game?mode=windy&profile=dense&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseWeather',
    },
    {
        name: 'game-plant-heavy-25x25-desktop',
        path: '/debug/profile/game?mode=details&profile=plant-heavy&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDensePlants',
    },
];

const highTargetScenarios = [
    {
        name: 'game-high-target-clear-idle-desktop',
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        repeat: 3,
    },
    {
        name: 'game-high-target-camera-motion-desktop',
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        motion: 'pan-zoom-rotate',
        repeat: 3,
    },
    {
        name: 'game-high-target-hover-selection-desktop',
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        interaction: 'hover-scan',
        repeat: 3,
    },
    {
        name: 'game-high-target-placement-desktop',
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1&placement=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        placementProfile: {
            action: 'run',
            staggerMs: 120,
        },
        repeat: 3,
    },
    {
        name: 'game-high-target-rain-desktop',
        path: '/debug/profile/game?mode=rain&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        repeat: 3,
    },
    {
        name: 'game-high-target-snow-desktop',
        path: '/debug/profile/game?mode=snow&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        repeat: 3,
    },
];

const highTargetOperationVisualScenarios = [
    {
        name: 'game-high-target-operation-visuals-desktop',
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1&operationVisuals=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        repeat: 3,
    },
];

const outlineScenarios = [
    {
        name: 'game-high-target-connected-raised-bed-outline-desktop',
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1&outline=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        outlineProfile: {
            action: 'show',
            raisedBedId: 2,
        },
        repeat: 3,
    },
];

const adaptiveHighScenarios = [
    {
        name: 'game-high-target-adaptive-pair-fixed-camera-motion-desktop',
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        comparisonPair: 'adaptive-camera-motion',
        comparisonRole: 'fixed',
        motion: 'pan-zoom-rotate',
        repeat: 3,
    },
    {
        name: 'game-high-target-adaptive-camera-motion-desktop',
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1&adaptiveHigh=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        comparisonPair: 'adaptive-camera-motion',
        comparisonRole: 'adaptive',
        motion: 'pan-zoom-rotate',
        profileControl: true,
        repeat: 3,
    },
    {
        name: 'game-high-target-adaptive-motion-recovery-desktop',
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1&adaptiveHigh=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        motion: 'pan-zoom-rotate-then-idle',
        motionMs: 650,
        profileControl: true,
        profileControlRecovery: true,
        sampleMs: 7_500,
        repeat: 3,
    },
    {
        name: 'game-high-target-adaptive-runtime-gpu-source-desktop',
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1&adaptiveHigh=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        externalGpuTimer: false,
        runtimeGpuSource: true,
        repeat: 3,
    },
    {
        name: 'game-high-target-adaptive-placement-desktop',
        path: '/debug/profile/game?mode=details&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1&placement=1&adaptiveHigh=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        placementProfile: {
            action: 'run',
            staggerMs: 120,
        },
        profileControl: true,
        repeat: 3,
    },
    {
        name: 'game-high-target-adaptive-rain-desktop',
        path: '/debug/profile/game?mode=rain&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1&adaptiveHigh=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        repeat: 3,
    },
    {
        name: 'game-high-target-adaptive-snow-desktop',
        path: '/debug/profile/game?mode=snow&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1&adaptiveHigh=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        repeat: 3,
    },
    {
        name: 'game-high-target-adaptive-cloudy-desktop',
        path: '/debug/profile/game?mode=cloudy&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1&adaptiveHigh=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        repeat: 3,
    },
    {
        name: 'game-high-target-adaptive-windy-plants-desktop',
        path: '/debug/profile/game?mode=windy&profile=high-target&quality=high&controls=1&details=1&hud=0&debugHud=0&blockGeometryMerging=1&adaptiveHigh=1',
        viewport: { width: 1280, height: 720 },
        dpr: 2,
        isMobile: false,
        budget: 'gameHighTarget',
        repeat: 3,
    },
];

const denseMobileScenarios = [
    {
        name: 'game-dense-25x25-baseline-mobile',
        path: '/debug/profile/game?mode=baseline&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseMobile',
    },
    {
        name: 'game-dense-25x25-details-mobile',
        path: '/debug/profile/game?mode=details&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseMobile',
    },
    {
        name: 'game-dense-25x25-camera-motion-mobile',
        path: '/debug/profile/game?mode=details&profile=dense&controls=1&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseMotionMobile',
        motion: 'pan-zoom-rotate',
    },
    {
        name: 'game-dense-25x25-rain-mobile',
        path: '/debug/profile/game?mode=rain&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
    },
    {
        name: 'game-dense-25x25-snow-mobile',
        path: '/debug/profile/game?mode=snow&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
    },
    {
        name: 'game-dense-25x25-cloudy-mobile',
        path: '/debug/profile/game?mode=cloudy&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
    },
    {
        name: 'game-dense-25x25-windy-mobile',
        path: '/debug/profile/game?mode=windy&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
    },
    {
        name: 'game-plant-heavy-25x25-mobile',
        path: '/debug/profile/game?mode=details&profile=plant-heavy&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDensePlantsMobile',
    },
];

const placementScenarios = [
    {
        name: 'game-dense-25x25-placement-desktop',
        path: '/debug/profile/game?mode=details&profile=dense&quality=medium&placement=1',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseMotion',
        placementProfile: {
            action: 'run',
            staggerMs: 120,
        },
    },
];

const constrainedAutoQualityDevice = {
    autoQualityDeviceClass: 'constrained',
    navigatorMetrics: {
        deviceMemory: 4,
        hardwareConcurrency: 4,
    },
};

const standardAutoQualityDevice = {
    autoQualityDeviceClass: 'standard',
    navigatorMetrics: {
        deviceMemory: 8,
        hardwareConcurrency: 8,
    },
};

const plantCloseupScenarios = [
    {
        name: 'game-plant-heavy-closeup-desktop',
        path: '/debug/profile/game?mode=details&profile=plant-heavy&quality=medium&controls=0&details=1&hud=0&debugHud=0&closeupRaisedBedId=29',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDensePlants',
        plantCloseup: {
            repeat: 5,
            raisedBedId: 29,
        },
    },
    {
        name: 'game-plant-heavy-closeup-mobile',
        path: '/debug/profile/game?mode=details&profile=plant-heavy&quality=auto&controls=0&details=1&hud=0&debugHud=0&closeupRaisedBedId=29',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDensePlantsMobile',
        plantCloseup: {
            repeat: 5,
            raisedBedId: 29,
        },
        ...constrainedAutoQualityDevice,
    },
];

const autoQualityScenarios = [
    {
        name: 'game-auto-quality-standard-desktop',
        path: '/debug/profile/game?mode=baseline&quality=auto',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'game',
        ...standardAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-medium-dense-mobile',
        path: '/debug/profile/game?mode=baseline&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-auto-dense-mobile',
        path: '/debug/profile/game?mode=baseline&profile=dense&quality=auto',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-medium-dense-rain-mobile',
        path: '/debug/profile/game?mode=rain&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-auto-dense-rain-mobile',
        path: '/debug/profile/game?mode=rain&profile=dense&quality=auto',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-medium-dense-snow-mobile',
        path: '/debug/profile/game?mode=snow&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-auto-dense-snow-mobile',
        path: '/debug/profile/game?mode=snow&profile=dense&quality=auto',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-medium-dense-cloudy-mobile',
        path: '/debug/profile/game?mode=cloudy&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-auto-dense-cloudy-mobile',
        path: '/debug/profile/game?mode=cloudy&profile=dense&quality=auto',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
];

const rewardScenarios = [
    {
        name: 'game-operation-rewards-matrix-desktop',
        path: '/debug/profile/game?mode=details&profile=operation-rewards&controls=1&quality=medium&legend=0',
        viewport: { width: 1440, height: 1200 },
        dpr: 1,
        isMobile: false,
        budget: 'gameRewards',
    },
];

const weatherTransitionScenarios = [
    {
        name: 'game-weather-clear-to-cloudy-mobile',
        path: '/debug/profile/game?mode=baseline&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'weatherMobile',
        weatherTransition: 'clear-to-cloudy',
    },
    {
        name: 'game-weather-cloudy-to-clear-mobile',
        path: '/debug/profile/game?mode=cloudy&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'weatherMobile',
        weatherTransition: 'cloudy-to-clear',
    },
    {
        name: 'game-weather-rain-to-clear-mobile',
        path: '/debug/profile/game?mode=rain&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'weatherMobile',
        weatherTransition: 'rain-to-clear',
    },
];

const scenarioSets = {
    'adaptive-high': adaptiveHighScenarios,
    'auto-quality': autoQualityScenarios,
    core: coreScenarios,
    dense: denseScenarios,
    'dense-mobile': denseMobileScenarios,
    'high-target': highTargetScenarios,
    'high-target-operation-visuals': highTargetOperationVisualScenarios,
    outline: outlineScenarios,
    placement: placementScenarios,
    'plant-closeup': plantCloseupScenarios,
    rewards: rewardScenarios,
    'weather-transitions': weatherTransitionScenarios,
};

const budgets = {
    game: {
        p95FrameMs: 16.7,
        maxFrameMs: 100,
        longTaskCount: 0,
        drawCallsPerFrame: 250,
        trianglesPerFrame: 800000,
        jsHeapMb: 180,
    },
    gameMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 150,
        longTaskCount: 1,
        drawCallsPerFrame: 250,
        trianglesPerFrame: 800000,
        jsHeapMb: 180,
    },
    gameDetails: {
        p95FrameMs: 33.3,
        maxFrameMs: 150,
        longTaskCount: 1,
        drawCallsPerFrame: 350,
        trianglesPerFrame: 1200000,
        jsHeapMb: 220,
    },
    weatherMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 180,
        longTaskCount: 2,
        drawCallsPerFrame: 320,
        trianglesPerFrame: 1000000,
        jsHeapMb: 220,
    },
    plants: {
        p95FrameMs: 33.3,
        maxFrameMs: 180,
        longTaskCount: 2,
        drawCallsPerFrame: 450,
        trianglesPerFrame: 1600000,
        jsHeapMb: 260,
    },
    gameDense: {
        p95FrameMs: 50,
        maxFrameMs: 220,
        longTaskCount: 4,
        drawCallsPerFrame: 1200,
        trianglesPerFrame: 4000000,
        jsHeapMb: 360,
    },
    gameDenseHigh: {
        p95FrameMs: 66.7,
        maxFrameMs: 260,
        longTaskCount: 6,
        drawCallsPerFrame: 1400,
        trianglesPerFrame: 5000000,
        jsHeapMb: 420,
    },
    gameHighTarget: {
        p95FrameMs: 33.3,
        maxFrameMs: 180,
        longTaskCount: 2,
        drawCallsPerRenderedFrame: 600,
        gpuElapsedP95Ms: 33.3,
        trianglesPerRenderedFrame: 3000000,
        jsHeapMb: 320,
    },
    gameDenseMotion: {
        p95FrameMs: 66.7,
        maxFrameMs: 260,
        longTaskCount: 6,
        drawCallsPerFrame: 1400,
        trianglesPerFrame: 5000000,
        jsHeapMb: 420,
    },
    gameDenseWeather: {
        p95FrameMs: 66.7,
        maxFrameMs: 280,
        longTaskCount: 8,
        drawCallsPerFrame: 1500,
        trianglesPerFrame: 5500000,
        jsHeapMb: 440,
    },
    gameDensePlants: {
        p95FrameMs: 83.3,
        maxFrameMs: 320,
        longTaskCount: 10,
        drawCallsPerFrame: 1800,
        trianglesPerFrame: 7000000,
        jsHeapMb: 520,
    },
    gameDenseMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 220,
        longTaskCount: 4,
        drawCallsPerFrame: 1200,
        trianglesPerFrame: 4000000,
        jsHeapMb: 360,
    },
    gameDenseMotionMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 260,
        longTaskCount: 6,
        drawCallsPerFrame: 1400,
        trianglesPerFrame: 5000000,
        jsHeapMb: 420,
    },
    gameDenseWeatherMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 280,
        longTaskCount: 8,
        drawCallsPerFrame: 1500,
        trianglesPerFrame: 5500000,
        jsHeapMb: 440,
    },
    gameDensePlantsMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 320,
        longTaskCount: 10,
        drawCallsPerFrame: 1800,
        trianglesPerFrame: 7000000,
        jsHeapMb: 520,
    },
    gameRewards: {
        p95FrameMs: 1000,
        maxFrameMs: 1200,
        longTaskCount: 12,
        drawCallsPerFrame: 2400,
        trianglesPerFrame: 6500000,
        jsHeapMb: 500,
    },
};

function parseArgs(argv) {
    const options = {
        allowLegacyOperationVisuals:
            process.env.GAME_PROFILE_ALLOW_LEGACY_OPERATION_VISUALS === '1',
        baseUrl: process.env.GAME_PROFILE_BASE_URL ?? defaultBaseUrl,
        build: process.env.GAME_PROFILE_BUILD === '1',
        closeupRepeat: process.env.GAME_PROFILE_CLOSEUP_REPEAT
            ? Number(process.env.GAME_PROFILE_CLOSEUP_REPEAT)
            : null,
        closeupTimeoutMs: Number(
            process.env.GAME_PROFILE_CLOSEUP_TIMEOUT_MS ?? 30000,
        ),
        failOnBudget: process.env.GAME_PROFILE_FAIL_ON_BUDGET === '1',
        graphicsBackend: process.env.GAME_PROFILE_GRAPHICS_BACKEND ?? 'auto',
        outDir: process.env.GAME_PROFILE_OUT_DIR
            ? resolve(appRoot, process.env.GAME_PROFILE_OUT_DIR)
            : defaultOutDir,
        sampleMs: Number(process.env.GAME_PROFILE_SAMPLE_MS ?? 5000),
        scenarios: (process.env.GAME_PROFILE_SCENARIOS ?? '')
            .split(',')
            .map((scenario) => scenario.trim())
            .filter(Boolean),
        scenarioSet: process.env.GAME_PROFILE_SCENARIO_SET ?? 'core',
        screenshots: process.env.GAME_PROFILE_SCREENSHOTS === '1',
        soakMs: Number(process.env.GAME_PROFILE_SOAK_MS ?? 0),
        startServer: process.env.GAME_PROFILE_START_SERVER === '1',
        warmupMs: Number(process.env.GAME_PROFILE_WARMUP_MS ?? 5000),
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];

        switch (arg) {
            case '--allow-legacy-operation-visuals':
                options.allowLegacyOperationVisuals = true;
                break;
            case '--':
                break;
            case '--base-url':
                options.baseUrl = next;
                index += 1;
                break;
            case '--build':
                options.build = true;
                break;
            case '--closeup-timeout-ms':
                options.closeupTimeoutMs = Number(next);
                index += 1;
                break;
            case '--closeup-repeat':
                options.closeupRepeat = Number(next);
                index += 1;
                break;
            case '--fail-on-budget':
                options.failOnBudget = true;
                break;
            case '--graphics-backend':
                options.graphicsBackend = next;
                index += 1;
                break;
            case '--help':
                options.help = true;
                break;
            case '--out-dir':
                options.outDir = resolve(appRoot, next);
                index += 1;
                break;
            case '--sample-ms':
                options.sampleMs = Number(next);
                index += 1;
                break;
            case '--scenario':
                options.scenarios.push(
                    ...next
                        .split(',')
                        .map((scenario) => scenario.trim())
                        .filter(Boolean),
                );
                index += 1;
                break;
            case '--scenario-set':
                options.scenarioSet = next;
                index += 1;
                break;
            case '--screenshots':
                options.screenshots = true;
                break;
            case '--start-server':
                options.startServer = true;
                break;
            case '--soak-ms':
                options.soakMs = Number(next);
                index += 1;
                break;
            case '--warmup-ms':
                options.warmupMs = Number(next);
                index += 1;
                break;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!Number.isFinite(options.sampleMs) || options.sampleMs <= 0) {
        throw new Error('Sample duration must be a positive number.');
    }
    if (!chromiumGraphicsBackends.includes(options.graphicsBackend)) {
        throw new Error(
            `Graphics backend must be one of: ${chromiumGraphicsBackends.join(', ')}.`,
        );
    }
    if (
        !Number.isFinite(options.closeupTimeoutMs) ||
        options.closeupTimeoutMs <= 0
    ) {
        throw new Error('Close-up timeout must be a positive number.');
    }

    if (
        options.closeupRepeat !== null &&
        (!Number.isInteger(options.closeupRepeat) || options.closeupRepeat <= 0)
    ) {
        throw new Error('Close-up repeat count must be a positive integer.');
    }

    if (!Number.isFinite(options.soakMs) || options.soakMs < 0) {
        throw new Error('Soak duration must be zero or a positive number.');
    }

    if (!Number.isFinite(options.warmupMs) || options.warmupMs < 0) {
        throw new Error('Warmup duration must be zero or a positive number.');
    }

    return options;
}

function printHelp(options) {
    console.log(
        [
            'Usage: pnpm run profile:game -- [options]',
            '',
            'Options:',
            '  --allow-legacy-operation-visuals',
            '                         Measure the pre-batching operation scene without waiting for batch telemetry.',
            `  --base-url <url>       Garden server URL. Current: ${options.baseUrl}`,
            '  --build                Run pnpm run build before profiling.',
            `  --closeup-repeat <n>   Override close-up scenario repeats. Current: ${options.closeupRepeat ?? 'scenario default'}`,
            `  --closeup-timeout-ms <ms> Maximum wait for close-up detail. Current: ${options.closeupTimeoutMs}`,
            '  --start-server         Start pnpm start before profiling. Requires a built app.',
            '                         Uses the port from --base-url or GAME_PROFILE_BASE_URL.',
            `  --graphics-backend <backend> auto, default, or angle-metal (macOS only). Current: ${options.graphicsBackend}`,
            '  --out-dir <path>       Report directory. Default: test-results/game-profile',
            '  --warmup-ms <ms>       Warmup wait after canvas appears. Default: 5000',
            '  --soak-ms <ms>         Run the scene before sampling. Default: 0',
            '  --sample-ms <ms>       requestAnimationFrame sample window. Default: 5000',
            `  --scenario-set <set>    core, dense, dense-mobile, high-target, high-target-operation-visuals, adaptive-high, outline, placement, plant-closeup, auto-quality, rewards, weather-transitions, all, or comma-separated names. Current: ${options.scenarioSet}`,
            '  --scenario <name>       Profile exact scenario name(s). Repeat or use commas.',
            '  --screenshots           Save a PNG screenshot for each scenario.',
            '  --fail-on-budget       Exit non-zero when a budget check fails.',
            '  --help                 Show this help.',
            '',
            'Environment aliases:',
            '  GAME_PROFILE_ALLOW_LEGACY_OPERATION_VISUALS=1,',
            '  GAME_PROFILE_BASE_URL, GAME_PROFILE_BUILD=1,',
            '  GAME_PROFILE_CLOSEUP_REPEAT, GAME_PROFILE_CLOSEUP_TIMEOUT_MS,',
            '  GAME_PROFILE_GRAPHICS_BACKEND,',
            '  GAME_PROFILE_START_SERVER=1,',
            '  GAME_PROFILE_WARMUP_MS, GAME_PROFILE_SOAK_MS,',
            '  GAME_PROFILE_SAMPLE_MS, GAME_PROFILE_OUT_DIR,',
            '  GAME_PROFILE_SCENARIO_SET, GAME_PROFILE_SCENARIOS,',
            '  GAME_PROFILE_SCREENSHOTS=1,',
            '  GAME_PROFILE_FAIL_ON_BUDGET=1',
            '',
        ].join('\n'),
    );
}

function allScenarios() {
    return [
        ...adaptiveHighScenarios,
        ...coreScenarios,
        ...denseScenarios,
        ...denseMobileScenarios,
        ...highTargetScenarios,
        ...highTargetOperationVisualScenarios,
        ...outlineScenarios,
        ...placementScenarios,
        ...plantCloseupScenarios,
        ...autoQualityScenarios,
        ...rewardScenarios,
        ...weatherTransitionScenarios,
    ];
}

function resolveScenarios(scenarioSet, scenarioNames = []) {
    const tokens = scenarioNames.length
        ? scenarioNames
        : scenarioSet
              .split(',')
              .map((token) => token.trim())
              .filter(Boolean);
    const selected =
        tokens.length > 0
            ? tokens
            : [process.env.GAME_PROFILE_SCENARIO_SET ?? 'core'];
    const scenarios = [];
    const seen = new Set();
    const knownScenarios = allScenarios();

    for (const token of selected) {
        const candidates =
            token === 'all'
                ? knownScenarios
                : (scenarioSets[token] ??
                  knownScenarios.filter((scenario) => scenario.name === token));

        if (!candidates.length) {
            throw new Error(
                `Unknown scenario set or scenario: ${token}. Use core, dense, dense-mobile, high-target, high-target-operation-visuals, adaptive-high, outline, placement, plant-closeup, auto-quality, rewards, weather-transitions, all, or one of: ${knownScenarios.map((scenario) => scenario.name).join(', ')}.`,
            );
        }

        for (const scenario of candidates) {
            if (!seen.has(scenario.name)) {
                scenarios.push(scenario);
                seen.add(scenario.name);
            }
        }
    }

    return scenarios;
}

function getScenarioRequest(path) {
    const url = new URL(path, 'http://profile.local');
    return {
        adaptiveHigh: url.searchParams.get('adaptiveHigh') ?? '0',
        blockGeometryMerging:
            url.searchParams.get('blockGeometryMerging') ?? 'default',
        controls: url.searchParams.get('controls') ?? '0',
        closeupRaisedBedId:
            Number.parseInt(
                url.searchParams.get('closeupRaisedBedId') ?? '',
                10,
            ) || null,
        details: url.searchParams.get('details') ?? '1',
        debugHud: url.searchParams.get('debugHud') ?? '0',
        gardenProfile: url.searchParams.get('profile') ?? 'default',
        hud: url.searchParams.get('hud') ?? '0',
        mode: url.searchParams.get('mode') ?? 'baseline',
        operationVisuals: url.searchParams.get('operationVisuals') ?? '0',
        outline: url.searchParams.get('outline') ?? '0',
        placement: url.searchParams.get('placement') ?? '0',
        quality: url.searchParams.get('quality') ?? 'auto',
    };
}

function installNavigatorMetrics({ deviceMemory, hardwareConcurrency }) {
    Object.defineProperties(globalThis.navigator, {
        deviceMemory: {
            configurable: true,
            get: () => deviceMemory,
        },
        hardwareConcurrency: {
            configurable: true,
            get: () => hardwareConcurrency,
        },
    });
}

function installBrowserMetrics({ externalGpuTimer = true } = {}) {
    if (globalThis.__gameProfileMetrics) {
        return;
    }

    globalThis.__gameProfileMetrics = {
        drawCalls: 0,
        instancedDrawCalls: 0,
        lastRenderedRafTick: -1,
        renderedFrames: 0,
        submittedTriangles: 0,
    };
    globalThis.__gameProfileLongTasks = [];

    let rafTick = 0;
    const gpuTimer = {
        active: null,
        complete: false,
        context: null,
        disjoint: false,
        extension: null,
        generation: 0,
        pending: [],
        reason: 'no WebGL2 draw observed',
        recording: false,
        samples: [],
        supported: null,
    };
    const pollGpuQueries = () => {
        const gl = gpuTimer.context;
        const extension = gpuTimer.extension;
        if (!gl || !extension) {
            return;
        }

        if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
            gpuTimer.disjoint = true;
            gpuTimer.samples = [];
            gpuTimer.reason = 'GPU timer query results became disjoint';
            for (const entry of gpuTimer.pending) {
                gl.deleteQuery(entry.query);
            }
            gpuTimer.pending = [];
            return;
        }
        gpuTimer.pending = gpuTimer.pending.filter((entry) => {
            if (!gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) {
                return true;
            }
            const elapsedNanoseconds = gl.getQueryParameter(
                entry.query,
                gl.QUERY_RESULT,
            );
            if (
                entry.generation === gpuTimer.generation &&
                !gpuTimer.disjoint &&
                Number.isFinite(elapsedNanoseconds)
            ) {
                gpuTimer.samples.push(elapsedNanoseconds / 1_000_000);
            }
            gl.deleteQuery(entry.query);
            return false;
        });
    };
    const endGpuQuery = () => {
        const gl = gpuTimer.context;
        const extension = gpuTimer.extension;
        if (!gl || !extension || !gpuTimer.active) {
            return;
        }
        gl.endQuery(extension.TIME_ELAPSED_EXT);
        gpuTimer.pending.push(gpuTimer.active);
        gpuTimer.active = null;
    };
    const beginGpuFrame = (gl) => {
        if (!gpuTimer.recording || gpuTimer.disjoint) {
            return;
        }
        if (
            typeof WebGL2RenderingContext === 'undefined' ||
            !(gl instanceof WebGL2RenderingContext)
        ) {
            if (gpuTimer.supported === null) {
                gpuTimer.supported = false;
                gpuTimer.reason = 'WebGL2 is unavailable';
            }
            return;
        }
        if (!gpuTimer.context) {
            gpuTimer.context = gl;
            gpuTimer.extension = gl.getExtension(
                'EXT_disjoint_timer_query_webgl2',
            );
            gpuTimer.supported = Boolean(gpuTimer.extension);
            gpuTimer.reason = gpuTimer.extension
                ? null
                : 'EXT_disjoint_timer_query_webgl2 is unavailable';
        }
        if (!gpuTimer.extension || gpuTimer.context !== gl) {
            return;
        }
        if (gpuTimer.active) {
            return;
        }

        pollGpuQueries();
        if (gpuTimer.disjoint) {
            return;
        }
        if (
            gl.getQuery(
                gpuTimer.extension.TIME_ELAPSED_EXT,
                gl.CURRENT_QUERY,
            ) !== null
        ) {
            gpuTimer.reason =
                'Another GPU elapsed-time query is currently active';
            return;
        }
        const query = gl.createQuery();
        if (!query) {
            gpuTimer.supported = false;
            gpuTimer.reason = 'Unable to allocate a WebGL timer query';
            return;
        }
        gl.beginQuery(gpuTimer.extension.TIME_ELAPSED_EXT, query);
        gpuTimer.reason = null;
        gpuTimer.active = {
            generation: gpuTimer.generation,
            query,
        };
        queueMicrotask(endGpuQuery);
    };
    const stopGpuTimer = () => {
        gpuTimer.recording = false;
        endGpuQuery();
    };
    const externalGpuTimerController = {
        async finish() {
            stopGpuTimer();
            const generation = gpuTimer.generation;
            const deadline = performance.now() + 2_000;
            const pendingForGeneration = () =>
                gpuTimer.pending.some(
                    (entry) => entry.generation === generation,
                );

            while (pendingForGeneration() && !gpuTimer.disjoint) {
                pollGpuQueries();
                if (!pendingForGeneration() || performance.now() >= deadline) {
                    break;
                }
                await new Promise((resolveFrame) =>
                    requestAnimationFrame(resolveFrame),
                );
            }
            pollGpuQueries();
            gpuTimer.complete =
                gpuTimer.supported === true &&
                !gpuTimer.disjoint &&
                !pendingForGeneration();
            if (
                gpuTimer.supported === true &&
                !gpuTimer.disjoint &&
                pendingForGeneration()
            ) {
                gpuTimer.reason =
                    'Timed out while draining GPU timer query results';
            } else if (
                gpuTimer.supported === true &&
                gpuTimer.complete &&
                gpuTimer.samples.length === 0
            ) {
                gpuTimer.reason = 'No GPU render-pass samples were recorded';
            }
        },
        reset() {
            gpuTimer.recording = false;
            endGpuQuery();
            pollGpuQueries();
            gpuTimer.generation += 1;
            gpuTimer.complete = false;
            gpuTimer.disjoint = false;
            gpuTimer.samples = [];
            gpuTimer.reason =
                gpuTimer.supported === false
                    ? gpuTimer.reason
                    : 'no WebGL2 draw observed';
            gpuTimer.recording = true;
        },
        snapshot() {
            pollGpuQueries();
            const sorted = [...gpuTimer.samples].sort((a, b) => a - b);
            const totalMs = sorted.reduce((total, value) => total + value, 0);
            const supported = gpuTimer.supported === true;
            const valid =
                supported &&
                gpuTimer.complete &&
                !gpuTimer.disjoint &&
                sorted.length > 0;
            return {
                complete: gpuTimer.complete,
                disjoint: gpuTimer.disjoint,
                elapsedMaxMs: sorted.at(-1) ?? null,
                elapsedP95Ms:
                    sorted[
                        Math.min(
                            sorted.length - 1,
                            Math.max(0, Math.ceil(sorted.length * 0.95) - 1),
                        )
                    ] ?? null,
                elapsedTotalMs: sorted.length > 0 ? totalMs : null,
                reason: gpuTimer.reason,
                sampleCount: sorted.length,
                supported,
                valid,
            };
        },
        stop: stopGpuTimer,
    };
    if (externalGpuTimer) {
        globalThis.__gameProfileGpuTimer = externalGpuTimerController;
    }
    const trackRafTick = () => {
        rafTick += 1;
        pollGpuQueries();
        requestAnimationFrame(trackRafTick);
    };
    requestAnimationFrame(trackRafTick);

    const recordLongTasks = (entries) => {
        for (const entry of entries) {
            globalThis.__gameProfileLongTasks.push({
                duration: entry.duration,
                startTime: entry.startTime,
            });
        }
    };
    try {
        globalThis.__gameProfileLongTaskObserver = new PerformanceObserver(
            (list) => recordLongTasks(list.getEntries()),
        );
        globalThis.__gameProfileLongTaskObserver.observe({
            type: 'longtask',
            buffered: true,
        });
    } catch (error) {
        globalThis.__gameProfileLongTaskObserverError = String(error);
    }
    globalThis.__gameProfileReadLongTasks = (startedAt, endedAt) => {
        recordLongTasks(
            globalThis.__gameProfileLongTaskObserver?.takeRecords() ?? [],
        );
        return globalThis.__gameProfileLongTasks
            .filter(
                (entry) =>
                    entry.startTime >= startedAt && entry.startTime <= endedAt,
            )
            .map((entry) => entry.duration);
    };

    const addTriangles = (gl, mode, count, instances = 1) => {
        let triangles = 0;
        if (mode === gl.TRIANGLES) {
            triangles = count / 3;
        } else if (mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN) {
            triangles = Math.max(0, count - 2);
        }

        globalThis.__gameProfileMetrics.submittedTriangles +=
            triangles * Math.max(1, instances || 1);
    };

    const patch = (prototype, name, measure) => {
        if (!prototype?.[name] || prototype[name].__gameProfilePatched) {
            return;
        }

        const original = prototype[name];
        prototype[name] = function patchedDrawCall(...args) {
            const metrics = globalThis.__gameProfileMetrics;
            beginGpuFrame(this);
            if (metrics.lastRenderedRafTick !== rafTick) {
                metrics.lastRenderedRafTick = rafTick;
                metrics.renderedFrames += 1;
            }
            measure(this, args);
            return original.apply(this, args);
        };
        prototype[name].__gameProfilePatched = true;
    };
    const patchGpuRenderPassStart = (prototype, name) => {
        if (!prototype?.[name] || prototype[name].__gameProfilePatched) {
            return;
        }

        const original = prototype[name];
        prototype[name] = function patchedRenderPassStart(...args) {
            beginGpuFrame(this);
            return original.apply(this, args);
        };
        prototype[name].__gameProfilePatched = true;
    };

    const patchContext = (Context) => {
        if (!Context) {
            return;
        }

        for (const name of [
            'clear',
            'clearBufferfi',
            'clearBufferfv',
            'clearBufferiv',
            'clearBufferuiv',
        ]) {
            patchGpuRenderPassStart(Context.prototype, name);
        }
        patch(Context.prototype, 'drawArrays', (gl, args) => {
            globalThis.__gameProfileMetrics.drawCalls += 1;
            addTriangles(gl, args[0], args[2]);
        });
        patch(Context.prototype, 'drawElements', (gl, args) => {
            globalThis.__gameProfileMetrics.drawCalls += 1;
            addTriangles(gl, args[0], args[1]);
        });
        patch(Context.prototype, 'drawArraysInstanced', (gl, args) => {
            globalThis.__gameProfileMetrics.drawCalls += 1;
            globalThis.__gameProfileMetrics.instancedDrawCalls += 1;
            addTriangles(gl, args[0], args[2], args[3]);
        });
        patch(Context.prototype, 'drawElementsInstanced', (gl, args) => {
            globalThis.__gameProfileMetrics.drawCalls += 1;
            globalThis.__gameProfileMetrics.instancedDrawCalls += 1;
            addTriangles(gl, args[0], args[1], args[4]);
        });
    };

    patchContext(globalThis.WebGLRenderingContext);
    patchContext(globalThis.WebGL2RenderingContext);
}

function beginInteractiveProfileSample() {
    const metrics = globalThis.__gameProfileMetrics;
    if (metrics) {
        metrics.drawCalls = 0;
        metrics.instancedDrawCalls = 0;
        metrics.lastRenderedRafTick = -1;
        metrics.renderedFrames = 0;
        metrics.submittedTriangles = 0;
    }
    globalThis.__gameProfileLongTasks = [];
    globalThis.__gameProfileGpuTimer?.reset();

    const startedAt = performance.now();
    const sample = {
        intervals: [],
        lastFrameAt: startedAt,
        running: true,
        startedAt,
    };
    globalThis.__gameProfileInteractiveSample = sample;
    const step = (timestamp) => {
        if (!sample.running) {
            return;
        }
        sample.intervals.push(timestamp - sample.lastFrameAt);
        sample.lastFrameAt = timestamp;
        requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

async function finishInteractiveProfileSample() {
    const sample = globalThis.__gameProfileInteractiveSample;
    if (!sample) {
        throw new Error('No interactive game profile sample is active.');
    }
    sample.running = false;
    const sampleEndedAt = performance.now();

    const canvas = document.querySelector('canvas');
    const metrics = globalThis.__gameProfileMetrics;
    const frameIntervals = sample.intervals.slice(1);
    const sortedIntervals = [...frameIntervals].sort((a, b) => a - b);
    const percentile = (value) =>
        sortedIntervals[
            Math.min(
                sortedIntervals.length - 1,
                Math.floor(sortedIntervals.length * value),
            )
        ] ?? 0;
    const averageFrameMs =
        frameIntervals.reduce((sum, value) => sum + value, 0) /
        Math.max(1, frameIntervals.length);
    const drawCalls = metrics?.drawCalls ?? 0;
    const instancedDrawCalls = metrics?.instancedDrawCalls ?? 0;
    const renderedFrames = metrics?.renderedFrames ?? 0;
    const submittedTriangles = Math.round(metrics?.submittedTriangles ?? 0);
    const rafFrames = frameIntervals.length;
    const elapsedSeconds = (sampleEndedAt - sample.startedAt) / 1000;
    const safeElapsedSeconds = Math.max(Number.EPSILON, elapsedSeconds);
    const safeRafFrames = Math.max(1, rafFrames);
    const safeRenderedFrames = Math.max(1, renderedFrames);
    const nonGpuSample = {
        averageFrameMs,
        canvas: canvas
            ? {
                  clientHeight: canvas.clientHeight,
                  clientWidth: canvas.clientWidth,
                  height: canvas.height,
                  width: canvas.width,
              }
            : null,
        drawCalls,
        drawCallsPerFrame: drawCalls / safeRafFrames,
        drawCallsPerRafFrame: drawCalls / safeRafFrames,
        drawCallsPerRenderedFrame:
            renderedFrames > 0 ? drawCalls / safeRenderedFrames : 0,
        drawCallsPerSecond: drawCalls / safeElapsedSeconds,
        elapsedMs: elapsedSeconds * 1000,
        fps: rafFrames / safeElapsedSeconds,
        frames: rafFrames,
        instancedDrawCalls,
        jsHeapMb: performance.memory
            ? performance.memory.usedJSHeapSize / 1024 / 1024
            : null,
        maxFrameMs: sortedIntervals.at(-1) ?? 0,
        p50FrameMs: percentile(0.5),
        p95FrameMs: percentile(0.95),
        p99FrameMs: percentile(0.99),
        renderedFps: renderedFrames / safeElapsedSeconds,
        renderedFrames,
        submittedTriangles,
        trianglesPerFrame: submittedTriangles / safeRafFrames,
        trianglesPerRafFrame: submittedTriangles / safeRafFrames,
        trianglesPerRenderedFrame:
            renderedFrames > 0 ? submittedTriangles / safeRenderedFrames : 0,
        trianglesPerSecond: submittedTriangles / safeElapsedSeconds,
    };
    globalThis.__gameProfileGpuTimer?.stop();
    globalThis.__gameProfileInteractiveSample = null;

    return {
        ...nonGpuSample,
        sampleWindow: {
            endedAt: sampleEndedAt,
            startedAt: sample.startedAt,
        },
    };
}

async function drainProfileSample(sampleWindow) {
    await globalThis.__gameProfileGpuTimer?.finish();
    await new Promise((resolveDrain) => setTimeout(resolveDrain, 0));
    const longTasks =
        globalThis.__gameProfileReadLongTasks?.(
            sampleWindow.startedAt,
            sampleWindow.endedAt,
        ) ?? [];
    const gpu = globalThis.__gameProfileGpuTimer?.snapshot() ?? {
        complete: false,
        disjoint: false,
        elapsedMaxMs: null,
        elapsedP95Ms: null,
        elapsedTotalMs: null,
        reason: 'GPU timer instrumentation was not installed',
        sampleCount: 0,
        supported: false,
        valid: false,
    };

    return {
        gpu,
        longTasks,
    };
}

function mergeProfileSampleDrain(sampleAtEndpoint, drainedSample) {
    const { sampleWindow: _sampleWindow, ...sample } = sampleAtEndpoint;
    const longTasks = drainedSample.longTasks ?? [];

    return {
        ...sample,
        gpu: drainedSample.gpu,
        longTaskCount: longTasks.length,
        longTaskMaxMs: Math.max(0, ...longTasks),
        longTaskTotalMs: longTasks.reduce((sum, value) => sum + value, 0),
    };
}

async function finalizeProfileSampleAtEndpoint({
    cdp,
    page,
    sampleAtEndpoint,
}) {
    const endpointMetrics = await cdp.send('Performance.getMetrics');
    const drainedSample = await page.evaluate(
        drainProfileSample,
        sampleAtEndpoint.sampleWindow,
    );

    return {
        endpointMetrics,
        sample: mergeProfileSampleDrain(sampleAtEndpoint, drainedSample),
    };
}

async function wait(milliseconds) {
    await new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function startAdaptiveHighProfileControl(page) {
    const dispatched = await page.evaluate(
        (eventName) =>
            globalThis.dispatchEvent(
                new CustomEvent(eventName, {
                    detail: { action: 'start' },
                }),
            ),
        adaptiveHighQualityProfileControlEventName,
    );
    await page.waitForFunction(
        () => {
            const profile = globalThis.__grediceGameProfile;
            const canvas = document.querySelector('canvas');
            const effectiveDpr =
                canvas instanceof HTMLCanvasElement &&
                canvas.clientWidth > 0 &&
                canvas.clientHeight > 0
                    ? Math.min(
                          canvas.width / canvas.clientWidth,
                          canvas.height / canvas.clientHeight,
                      )
                    : null;
            return (
                profile?.adaptiveHighProfileControlActive === true &&
                profile.adaptiveHighLevel === 0 &&
                profile.adaptiveHighDprCap === 2 &&
                effectiveDpr !== null &&
                Math.abs(effectiveDpr - 2) <= 0.01
            );
        },
        undefined,
        { timeout: 10_000 },
    );
    return dispatched;
}

function isOutlineProfileTelemetryReady(
    profile,
    {
        activeTargetCount = 2,
        styleGroupCount = 1,
        targetBlockId = 'profile-raised-bed:2:0',
        targetRaisedBedId = 2,
    } = {},
) {
    return (
        profile?.hoverOutlineActiveTargetCount === activeTargetCount &&
        profile.hoverOutlineStyleGroupCount === styleGroupCount &&
        profile.hoverOutlineProfileTargetBlockId === targetBlockId &&
        profile.hoverOutlineProfileTargetRaisedBedId === targetRaisedBedId
    );
}

async function dispatchOutlineProfileCommand(page, command) {
    const dispatched = await page.evaluate(
        ({ detail, eventName }) =>
            globalThis.dispatchEvent(
                new CustomEvent(eventName, {
                    detail,
                }),
            ),
        {
            detail: command,
            eventName: gameProfileOutlineCommandEventName,
        },
    );
    const expected = {
        activeTargetCount: 2,
        styleGroupCount: 1,
        targetBlockId: `profile-raised-bed:${command.raisedBedId.toString()}:0`,
        targetRaisedBedId: command.raisedBedId,
    };
    await page.waitForFunction(
        ({
            activeTargetCount,
            styleGroupCount,
            targetBlockId,
            targetRaisedBedId,
        }) => {
            const profile = globalThis.__grediceGameProfile;
            return (
                profile?.hoverOutlineActiveTargetCount === activeTargetCount &&
                profile.hoverOutlineStyleGroupCount === styleGroupCount &&
                profile.hoverOutlineProfileTargetBlockId === targetBlockId &&
                profile.hoverOutlineProfileTargetRaisedBedId ===
                    targetRaisedBedId
            );
        },
        expected,
        { timeout: 20_000 },
    );

    return {
        dispatched,
        telemetryAvailable: true,
    };
}

function resolveChromiumGraphicsBackend(
    platform = process.platform,
    backend = 'auto',
) {
    if (!chromiumGraphicsBackends.includes(backend)) {
        throw new Error(
            `Graphics backend must be one of: ${chromiumGraphicsBackends.join(', ')}.`,
        );
    }
    if (backend === 'auto') {
        return platform === 'darwin' ? 'angle-metal' : 'default';
    }
    if (backend === 'angle-metal' && platform !== 'darwin') {
        throw new Error('The angle-metal graphics backend requires macOS.');
    }

    return backend;
}

function resolveChromiumGraphicsArgs(
    platform = process.platform,
    backend = 'auto',
) {
    if (resolveChromiumGraphicsBackend(platform, backend) !== 'angle-metal') {
        return [];
    }

    return ['--use-gl=angle', '--use-angle=metal'];
}

async function runScenarioMotion(page, scenario, sampleMs) {
    if (
        scenario.motion !== 'pan-zoom-rotate' &&
        scenario.motion !== 'pan-zoom-rotate-then-idle' &&
        scenario.interaction !== 'hover-scan'
    ) {
        await wait(sampleMs);
        return;
    }

    const canvasBox = await page.locator('canvas').first().boundingBox();
    if (!canvasBox) {
        await wait(sampleMs);
        return;
    }

    const centerX = canvasBox.x + canvasBox.width * 0.52;
    const centerY = canvasBox.y + canvasBox.height * 0.52;
    const startedAt = Date.now();
    if (scenario.interaction === 'hover-scan') {
        const points = [
            [-0.08, -0.04],
            [0, 0],
            [0.08, -0.04],
            [0.08, 0.06],
            [0, 0.08],
            [-0.08, 0.06],
        ];
        await page.mouse.move(centerX, centerY);
        await page.mouse.click(centerX, centerY);
        let pointIndex = 0;
        while (Date.now() - startedAt < sampleMs - 80) {
            const [offsetX, offsetY] = points[pointIndex] ?? [0, 0];
            await page.mouse.move(
                centerX + canvasBox.width * offsetX,
                centerY + canvasBox.height * offsetY,
                { steps: 8 },
            );
            pointIndex = (pointIndex + 1) % points.length;
            await wait(80);
        }
        const remainingMs = sampleMs - (Date.now() - startedAt);
        if (remainingMs > 0) {
            await wait(remainingMs);
        }
        return;
    }

    let direction = 1;
    const motionMs =
        scenario.motion === 'pan-zoom-rotate-then-idle'
            ? Math.min(sampleMs, scenario.motionMs ?? 650)
            : sampleMs;

    while (Date.now() - startedAt < motionMs - 120) {
        const panKey = direction > 0 ? 'ArrowLeft' : 'ArrowRight';
        await page.keyboard.down(panKey);
        await wait(120);
        await page.keyboard.up(panKey);
        await page.mouse.wheel(0, direction > 0 ? -420 : 360);
        await page.keyboard.press(direction > 0 ? 'KeyQ' : 'KeyW');
        direction *= -1;
        await wait(120);
    }

    const remainingMs = sampleMs - (Date.now() - startedAt);
    if (remainingMs > 0) {
        await wait(remainingMs);
    }
}

async function isReachable(baseUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    try {
        const response = await fetch(baseUrl, {
            cache: 'no-store',
            signal: controller.signal,
        });
        return response.status < 500;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

async function waitForServer(baseUrl, timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (await isReachable(baseUrl)) {
            return;
        }
        await wait(500);
    }

    throw new Error(`Timed out waiting for ${baseUrl}`);
}

function resolveServerPort(baseUrl) {
    const url = new URL(baseUrl);
    if (url.port) {
        return url.port;
    }

    return url.protocol === 'https:' ? '443' : '80';
}

function runPackageScript(script) {
    return new Promise((resolveRun, rejectRun) => {
        const child = spawn('pnpm', ['run', script], {
            cwd: appRoot,
            env: process.env,
            stdio: 'inherit',
        });

        child.on('error', rejectRun);
        child.on('exit', (code, signal) => {
            if (code === 0) {
                resolveRun();
                return;
            }

            rejectRun(
                new Error(
                    `pnpm run ${script} exited with ${signal ? `signal ${signal}` : `code ${code}`}.`,
                ),
            );
        });
    });
}

function startServer(baseUrl) {
    const port = resolveServerPort(baseUrl);
    let stopping = false;
    const child = spawn('pnpm', ['start'], {
        cwd: appRoot,
        env: {
            ...process.env,
            GREDICE_GARDEN_START_PORT: port,
            PORT: port,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    const logs = [];
    const collect = (chunk) => {
        logs.push(chunk.toString());
        if (logs.length > 80) {
            logs.shift();
        }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    const exited = new Promise((resolveExit) => {
        child.on('exit', (code) => {
            if (!stopping && code && code !== 0) {
                console.error(`Profile server exited with code ${code}.`);
                console.error(logs.join(''));
            }

            resolveExit();
        });
    });

    return {
        async stop() {
            stopping = true;
            if (!child.killed) {
                child.kill('SIGTERM');
            }
            await exited;
        },
    };
}

function metricsByName(payload) {
    return Object.fromEntries(
        payload.metrics.map((metric) => [metric.name, metric.value]),
    );
}

function diffCdpMetrics(before, after) {
    return {
        jsHeapMb: round((after.JSHeapUsedSize ?? 0) / 1024 / 1024, 1),
        layoutDuration: round(
            (after.LayoutDuration ?? 0) - (before.LayoutDuration ?? 0),
            4,
        ),
        scriptDuration: round(
            (after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0),
            4,
        ),
        taskDuration: round(
            (after.TaskDuration ?? 0) - (before.TaskDuration ?? 0),
            4,
        ),
    };
}

async function readGameProfileRuntime(page) {
    return page.evaluate(() => {
        const metadata = globalThis.__grediceGameProfile;
        return metadata && typeof metadata === 'object' ? metadata : null;
    });
}

async function dispatchCloseupCommand(page, detail) {
    await page.evaluate(
        ({ command, eventName }) => {
            globalThis.dispatchEvent(
                new CustomEvent(eventName, { detail: command }),
            );
        },
        {
            command: detail,
            eventName: gameProfileCloseupCommandEventName,
        },
    );
}

async function captureProfileScreenshot(page, outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await page.screenshot({
        path: outputPath,
        animations: 'disabled',
        fullPage: false,
    });
    return outputPath;
}

async function waitForProfileSession(page, raisedBedId, timeoutMs) {
    await page.waitForFunction(
        (expectedRaisedBedId) => {
            const profile =
                globalThis.__grediceGameProfile?.generatedPlantProfile;
            return Boolean(
                profile?.active &&
                    profile.selectedRaisedBedId === expectedRaisedBedId,
            );
        },
        raisedBedId,
        { timeout: timeoutMs },
    );
}

async function waitForPendingOrDetailed(page, timeoutMs) {
    await page.waitForFunction(
        () => {
            const profile =
                globalThis.__grediceGameProfile?.generatedPlantProfile;
            return Boolean(
                profile?.error ||
                    (profile?.selected.pendingNearFields ?? 0) > 0 ||
                    typeof profile?.milestonesMs.fullyDetailed === 'number',
            );
        },
        undefined,
        { timeout: timeoutMs },
    );
}

async function waitForDetailedAndSettled(page, timeoutMs) {
    await page.waitForFunction(
        () => {
            const profile =
                globalThis.__grediceGameProfile?.generatedPlantProfile;
            return Boolean(
                profile?.error ||
                    (profile?.camera.settled &&
                        profile.milestonesMs.fullyDetailed !== null),
            );
        },
        undefined,
        { timeout: timeoutMs },
    );
}

async function waitForNormalCamera(page, timeoutMs) {
    await page.waitForFunction(
        () => {
            const profile =
                globalThis.__grediceGameProfile?.generatedPlantProfile;
            return Boolean(
                profile &&
                    profile.camera.view === 'normal' &&
                    !profile.camera.active,
            );
        },
        undefined,
        { timeout: timeoutMs },
    );
}

async function runPlantCloseupPass({
    cdp,
    options,
    page,
    phase,
    raisedBedId,
    screenshotDirectory,
    scenarioName,
}) {
    const transitionCdpBefore = metricsByName(
        await cdp.send('Performance.getMetrics'),
    );
    await page.evaluate(beginInteractiveProfileSample);
    await dispatchCloseupCommand(page, {
        action: 'open',
        raisedBedId,
    });
    await waitForProfileSession(page, raisedBedId, options.closeupTimeoutMs);

    let pendingScreenshotPath = null;
    let pendingProfile = null;
    let timedOut = false;
    try {
        await waitForPendingOrDetailed(page, options.closeupTimeoutMs);
        pendingProfile = (await readGameProfileRuntime(page))
            ?.generatedPlantProfile;
        const pending = await page.evaluate(
            () =>
                (globalThis.__grediceGameProfile?.generatedPlantProfile
                    ?.selected.pendingNearFields ?? 0) > 0,
        );
        if (pending && phase === 'cold') {
            pendingScreenshotPath = await captureProfileScreenshot(
                page,
                resolve(
                    screenshotDirectory,
                    `${scenarioName}-${phase}-pending-near.png`,
                ),
            );
        }
        await waitForDetailedAndSettled(page, options.closeupTimeoutMs);
    } catch {
        timedOut = true;
    }

    const transitionAtEndpoint = await page.evaluate(
        finishInteractiveProfileSample,
    );
    const transitionCompletion = await finalizeProfileSampleAtEndpoint({
        cdp,
        page,
        sampleAtEndpoint: transitionAtEndpoint,
    });
    const transition = roundSample(
        normalizeRenderWork(transitionCompletion.sample),
    );
    const transitionCdpAfter = metricsByName(
        transitionCompletion.endpointMetrics,
    );
    const transitionProfile = (await readGameProfileRuntime(page))
        ?.generatedPlantProfile;
    const ready =
        !transitionProfile?.error &&
        transitionProfile?.camera.settled === true &&
        transitionProfile?.milestonesMs.fullyDetailed !== null;
    let detailedScreenshotPath = null;
    if (ready) {
        detailedScreenshotPath = await captureProfileScreenshot(
            page,
            resolve(
                screenshotDirectory,
                `${scenarioName}-${phase}-detailed.png`,
            ),
        );
    }

    if (options.soakMs > 0) {
        await wait(options.soakMs);
    }
    const steadyCdpBefore = metricsByName(
        await cdp.send('Performance.getMetrics'),
    );
    await page.evaluate(beginInteractiveProfileSample);
    await wait(options.sampleMs);
    const steadyAtEndpoint = await page.evaluate(
        finishInteractiveProfileSample,
    );
    const steadyCompletion = await finalizeProfileSampleAtEndpoint({
        cdp,
        page,
        sampleAtEndpoint: steadyAtEndpoint,
    });
    const steady = roundSample(normalizeRenderWork(steadyCompletion.sample));
    const steadyCdpAfter = metricsByName(steadyCompletion.endpointMetrics);
    const steadyProfile = (await readGameProfileRuntime(page))
        ?.generatedPlantProfile;

    return {
        detailOutcome: transitionProfile?.error
            ? 'error'
            : ready
              ? 'ready'
              : timedOut
                ? 'timed-out'
                : 'incomplete',
        profile: transitionProfile ?? null,
        progressiveCheckpoints: {
            pendingOrFirstDetail: pendingProfile ?? null,
            settled: transitionProfile ?? null,
        },
        screenshots: {
            detailed: detailedScreenshotPath,
            pendingNear: pendingScreenshotPath,
        },
        steady: {
            cdp: diffCdpMetrics(steadyCdpBefore, steadyCdpAfter),
            profile: steadyProfile ?? transitionProfile ?? null,
            sample: steady,
        },
        transition: {
            cdp: diffCdpMetrics(transitionCdpBefore, transitionCdpAfter),
            sample: transition,
        },
    };
}

async function measurePlantCloseup({ cdp, options, page, scenario }) {
    const screenshotDirectory = resolve(
        options.outDir,
        'screenshots',
        scenario.name,
    );
    const normalScreenshotPath = await captureProfileScreenshot(
        page,
        resolve(screenshotDirectory, `${scenario.name}-normal.png`),
    );
    const common = {
        cdp,
        options,
        page,
        raisedBedId: scenario.plantCloseup.raisedBedId,
        screenshotDirectory,
        scenarioName: scenario.name,
    };
    const cold = await runPlantCloseupPass({
        ...common,
        phase: 'cold',
    });

    await dispatchCloseupCommand(page, { action: 'close' });
    await waitForNormalCamera(page, options.closeupTimeoutMs);
    await wait(250);

    const warm = await runPlantCloseupPass({
        ...common,
        phase: 'warm',
    });
    const runtime = await readGameProfileRuntime(page);
    await dispatchCloseupCommand(page, { action: 'close' });

    return {
        cold,
        normalScreenshotPath,
        runtime,
        warm,
    };
}

async function measureScenario(browser, baseUrl, scenario, options) {
    const context = await browser.newContext({
        deviceScaleFactor: scenario.dpr,
        hasTouch: scenario.isMobile,
        isMobile: scenario.isMobile,
        viewport: scenario.viewport,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const apiErrors = [];
    const consoleMessages = [];
    const pageErrors = [];

    await cdp.send('Performance.enable');
    if (scenario.navigatorMetrics) {
        await page.addInitScript(
            installNavigatorMetrics,
            scenario.navigatorMetrics,
        );
    }
    await page.addInitScript(installBrowserMetrics, {
        externalGpuTimer: scenario.externalGpuTimer !== false,
    });

    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
            const location = message.location();
            consoleMessages.push({
                type: message.type(),
                text: message.text().slice(0, 300),
                url: location.url || null,
            });
        }
    });
    page.on('pageerror', (error) => {
        pageErrors.push(error.message.slice(0, 300));
    });
    page.on('response', (response) => {
        const responseUrl = response.url();
        if (
            response.status() >= 400 &&
            new URL(responseUrl).pathname.includes('/api/')
        ) {
            apiErrors.push({
                status: response.status(),
                url: responseUrl,
            });
        }
    });

    const url = new URL(scenario.path, baseUrl).toString();
    const navigationStart = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const domContentLoadedMs = Date.now() - navigationStart;
    await page.waitForSelector('canvas', {
        state: 'attached',
        timeout: 60000,
    });
    await page.waitForFunction(
        () => {
            const canvas = document.querySelector('canvas');
            return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
        },
        { timeout: 60000 },
    );
    await page.evaluate(
        () =>
            new Promise((resolveFrame) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(resolveFrame),
                ),
            ),
    );
    const canvasReadyMs = Date.now() - navigationStart;
    const request = getScenarioRequest(scenario.path);
    if (request.gardenProfile === 'high-target') {
        await page.waitForFunction(
            ({
                expectedFieldCount,
                expectedFieldVisualInstanceCount,
                expectedInstanceCount,
                expectedMulchInstanceCount,
                allowLegacyOperationVisuals,
                operationVisuals,
            }) => {
                const profile = globalThis.__grediceGameProfile;
                return Boolean(
                    profile?.qualityTier === 'high' &&
                        profile.generatedPlantFieldCount ===
                            expectedFieldCount &&
                        profile.generatedPlantExpectedInstanceCount ===
                            expectedInstanceCount &&
                        profile.generatedPlantInstanceCount ===
                            profile.generatedPlantExpectedInstanceCount &&
                        profile.generatedPlantVisibleFieldCount ===
                            expectedFieldCount &&
                        profile.generatedPlantVisibleInstanceCount ===
                            expectedInstanceCount &&
                        (!operationVisuals ||
                            allowLegacyOperationVisuals ||
                            (profile.raisedBedFieldVisualInstanceCount ===
                                expectedFieldVisualInstanceCount &&
                                profile.raisedBedMulchInstanceCount ===
                                    expectedMulchInstanceCount)),
                );
            },
            {
                expectedFieldCount:
                    request.operationVisuals === '1'
                        ? highTargetOperationVisualExpectedGeneratedPlantFieldCount
                        : highTargetExpectedGeneratedPlantFieldCount,
                expectedFieldVisualInstanceCount:
                    highTargetOperationVisualExpectedFieldInstanceCount,
                expectedInstanceCount:
                    request.operationVisuals === '1'
                        ? highTargetOperationVisualExpectedGeneratedPlantInstanceCount
                        : highTargetExpectedGeneratedPlantInstanceCount,
                expectedMulchInstanceCount:
                    highTargetOperationVisualExpectedMulchInstanceCount,
                allowLegacyOperationVisuals:
                    options.allowLegacyOperationVisuals,
                operationVisuals: request.operationVisuals === '1',
            },
            { timeout: 60000 },
        );
    }

    await page.evaluate(
        (warmupMs) =>
            new Promise((resolveWarmup) => setTimeout(resolveWarmup, warmupMs)),
        options.warmupMs,
    );
    if (options.soakMs > 0) {
        await wait(options.soakMs);
    }
    const adaptiveHighProfileControlStarted = scenario.profileControl
        ? await startAdaptiveHighProfileControl(page)
        : false;
    const outlineProfileRequest = scenario.outlineProfile ?? null;
    const outlineProfileState = outlineProfileRequest
        ? await dispatchOutlineProfileCommand(page, outlineProfileRequest)
        : {
              dispatched: false,
              telemetryAvailable: false,
          };
    const profileMetadata = await page.evaluate(() => {
        const element = document.querySelector('[data-game-profile-mode]');
        if (!(element instanceof HTMLElement)) {
            return null;
        }
        const deviceMemory = Reflect.get(window.navigator, 'deviceMemory');

        return {
            adaptiveHigh: element.dataset.gameProfileAdaptiveHigh ?? null,
            autoQualityMetrics: {
                coarsePointer:
                    typeof window.matchMedia === 'function' &&
                    window.matchMedia('(pointer: coarse)').matches,
                coreCount: window.navigator.hardwareConcurrency,
                dpr: window.devicePixelRatio,
                memoryGb:
                    typeof deviceMemory === 'number' ? deviceMemory : null,
                narrowViewport: window.innerWidth <= 640,
            },
            blockGeometryMerging:
                element.dataset.gameProfileBlockGeometryMerging ?? null,
            controls: element.dataset.gameProfileControls ?? null,
            closeupRaisedBedId:
                Number.parseInt(
                    element.dataset.gameProfileCloseupRaisedBedId ?? '',
                    10,
                ) || null,
            details: element.dataset.gameProfileDetails ?? null,
            debugHud: element.dataset.gameProfileDebugHud ?? null,
            gardenProfile: element.dataset.gameProfileGardenProfile ?? null,
            hud: element.dataset.gameProfileHud ?? null,
            mode: element.dataset.gameProfileMode ?? null,
            operationVisuals:
                element.dataset.gameProfileOperationVisuals ?? null,
            outline: element.dataset.gameProfileOutline ?? null,
            quality: element.dataset.gameProfileQuality ?? null,
        };
    });
    const environment = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const gl =
            canvas instanceof HTMLCanvasElement
                ? canvas.getContext('webgl2')
                : null;
        const rendererInfo = gl?.getExtension('WEBGL_debug_renderer_info');

        return {
            renderer:
                gl && rendererInfo
                    ? gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)
                    : null,
            userAgent: window.navigator.userAgent,
            vendor:
                gl && rendererInfo
                    ? gl.getParameter(rendererInfo.UNMASKED_VENDOR_WEBGL)
                    : null,
        };
    });
    if (scenario.plantCloseup) {
        const closeup = await measurePlantCloseup({
            cdp,
            options,
            page,
            scenario,
        });
        const sample = closeup.cold.steady.sample;
        const request = getScenarioRequest(scenario.path);
        await context.close();

        return {
            apiErrors: apiErrors.slice(0, 8),
            budget: evaluateBudget(sample, budgets[scenario.budget]),
            closeup: {
                cold: closeup.cold,
                normalScreenshotPath: closeup.normalScreenshotPath,
                raisedBedId: scenario.plantCloseup.raisedBedId,
                warm: closeup.warm,
            },
            consoleMessages: consoleMessages.slice(0, 8),
            cdp: closeup.cold.transition.cdp,
            domContentLoadedMs,
            environment,
            canvasReadyMs,
            pageErrors,
            path: scenario.path,
            requested: {
                adaptiveHigh:
                    profileMetadata?.adaptiveHigh ?? request.adaptiveHigh,
                autoQualityDeviceClass:
                    scenario.autoQualityDeviceClass ?? 'unspecified',
                autoQualityMetrics: profileMetadata?.autoQualityMetrics ?? null,
                blockGeometryMerging:
                    profileMetadata?.blockGeometryMerging ??
                    request.blockGeometryMerging,
                closeupRaisedBedId:
                    profileMetadata?.closeupRaisedBedId ??
                    request.closeupRaisedBedId,
                controls: profileMetadata?.controls ?? request.controls,
                details: profileMetadata?.details ?? request.details,
                debugHud: profileMetadata?.debugHud ?? request.debugHud,
                dpr: scenario.dpr,
                gardenProfile:
                    profileMetadata?.gardenProfile ?? request.gardenProfile,
                hud: profileMetadata?.hud ?? request.hud,
                isMobile: scenario.isMobile,
                mode: profileMetadata?.mode ?? request.mode,
                motion: 'raised-bed-closeup',
                operationVisuals:
                    profileMetadata?.operationVisuals ??
                    request.operationVisuals,
                outline: profileMetadata?.outline ?? request.outline,
                outlineProfile: 'none',
                quality: profileMetadata?.quality ?? request.quality,
                viewport: scenario.viewport,
                weatherTransition: 'none',
            },
            runtime: closeup.runtime,
            sample,
            screenshotPath:
                closeup.cold.screenshots.detailed ??
                closeup.normalScreenshotPath,
            url,
            name: scenario.name,
        };
    }

    const beforeMetrics = await cdp.send('Performance.getMetrics');
    const before = Object.fromEntries(
        beforeMetrics.metrics.map((metric) => [metric.name, metric.value]),
    );

    const sampleMs = scenario.sampleMs ?? options.sampleMs;
    const weatherTransitionRequest = scenario.weatherTransition ?? null;
    const placementProfileRequest = scenario.placementProfile ?? null;
    const samplePromise = page.evaluate(
        async (sampleOptions) => {
            const {
                adaptiveHighProfileControlEventName,
                adaptiveHighProfileControlRecovery,
                adaptiveHighProfileControlStarted,
                outlineProfileDispatched,
                outlineProfileTelemetryAvailable,
                placementProfileEventName,
                placementProfileRequest,
                sampleMs,
                weatherTransitionEventName,
                weatherTransitionRequest,
            } = sampleOptions;
            const canvas = document.querySelector('canvas');
            const metrics = globalThis.__gameProfileMetrics;
            if (metrics) {
                metrics.drawCalls = 0;
                metrics.instancedDrawCalls = 0;
                metrics.lastRenderedRafTick = -1;
                metrics.renderedFrames = 0;
                metrics.submittedTriangles = 0;
            }
            globalThis.__gameProfileLongTasks = [];
            globalThis.__gameProfileGpuTimer?.reset();

            const intervals = [];
            const start = performance.now();
            let last = start;
            let adaptiveHighDprCapMin = null;
            let adaptiveHighGpuSourceObserved = false;
            let adaptiveHighInteractionObserved = false;
            let adaptiveHighLevelMax = null;
            let adaptiveHighProfileControlObserved = false;
            let effectiveDprMin = null;
            const readProfileNumber = (field) => {
                const value = globalThis.__grediceGameProfile?.[field];
                return typeof value === 'number' ? value : null;
            };
            const readEffectiveDpr = () => {
                if (
                    !canvas ||
                    canvas.clientWidth <= 0 ||
                    canvas.clientHeight <= 0
                ) {
                    return null;
                }
                return Math.min(
                    canvas.width / canvas.clientWidth,
                    canvas.height / canvas.clientHeight,
                );
            };
            const recordEffectiveDpr = () => {
                const effectiveDpr = readEffectiveDpr();
                if (effectiveDpr === null) {
                    return;
                }
                effectiveDprMin =
                    effectiveDprMin === null
                        ? effectiveDpr
                        : Math.min(effectiveDprMin, effectiveDpr);
            };
            const recordAdaptiveHighState = () => {
                const profile = globalThis.__grediceGameProfile;
                const dprCap =
                    typeof profile?.adaptiveHighDprCap === 'number'
                        ? profile.adaptiveHighDprCap
                        : null;
                const level =
                    typeof profile?.adaptiveHighLevel === 'number'
                        ? profile.adaptiveHighLevel
                        : null;
                if (dprCap !== null) {
                    adaptiveHighDprCapMin =
                        adaptiveHighDprCapMin === null
                            ? dprCap
                            : Math.min(adaptiveHighDprCapMin, dprCap);
                }
                if (level !== null) {
                    adaptiveHighLevelMax =
                        adaptiveHighLevelMax === null
                            ? level
                            : Math.max(adaptiveHighLevelMax, level);
                }
                adaptiveHighInteractionObserved ||=
                    profile?.adaptiveHighInteractionActive === true;
                adaptiveHighGpuSourceObserved ||=
                    profile?.adaptiveHighSampleSource === 'gpu';
                adaptiveHighProfileControlObserved ||=
                    profile?.adaptiveHighProfileControlActive === true;
            };
            recordEffectiveDpr();
            recordAdaptiveHighState();
            const adaptiveHighDeclineCountAtStart = readProfileNumber(
                'adaptiveHighDeclineCount',
            );
            const adaptiveHighDprCapAtStart =
                readProfileNumber('adaptiveHighDprCap');
            const adaptiveHighLevelAtStart =
                readProfileNumber('adaptiveHighLevel');
            const adaptiveHighRecoveryCountAtStart = readProfileNumber(
                'adaptiveHighRecoveryCount',
            );
            const adaptiveHighProfileControlSampleCountAtStart =
                readProfileNumber('adaptiveHighProfileControlSampleCount');
            const adaptiveHighTransitionCountAtStart = readProfileNumber(
                'adaptiveHighTransitionCount',
            );
            const cloudAttenuationUpdateCountAtStart = readProfileNumber(
                'cloudAttenuationUpdateCount',
            );
            const interactionResolvedTargetCountAtStart =
                typeof globalThis.__grediceGameProfile
                    ?.instancedInteractionResolvedTargetCount === 'number'
                    ? globalThis.__grediceGameProfile
                          .instancedInteractionResolvedTargetCount
                    : null;
            const actorGroundingShadowUpdateCountAtStart =
                typeof globalThis.__grediceGameProfile
                    ?.actorGroundingShadowUpdateCount === 'number'
                    ? globalThis.__grediceGameProfile
                          .actorGroundingShadowUpdateCount
                    : null;
            const animatedCasterShadowRefreshCountAtStart =
                typeof globalThis.__grediceGameProfile
                    ?.animatedCasterShadowRefreshCount === 'number'
                    ? globalThis.__grediceGameProfile
                          .animatedCasterShadowRefreshCount
                    : null;
            const primaryShadowRefreshCountAtStart =
                typeof globalThis.__grediceGameProfile
                    ?.primaryShadowRefreshCount === 'number'
                    ? globalThis.__grediceGameProfile.primaryShadowRefreshCount
                    : null;
            const placementShadowDeferredChangeCountAtStart =
                typeof globalThis.__grediceGameProfile
                    ?.placementShadowDeferredChangeCount === 'number'
                    ? globalThis.__grediceGameProfile
                          .placementShadowDeferredChangeCount
                    : null;
            const placementShadowFlushCountAtStart =
                typeof globalThis.__grediceGameProfile
                    ?.placementShadowFlushCount === 'number'
                    ? globalThis.__grediceGameProfile.placementShadowFlushCount
                    : null;
            const rainParticleCountAtStart =
                typeof globalThis.__grediceGameProfile?.rainParticleCount ===
                'number'
                    ? globalThis.__grediceGameProfile.rainParticleCount
                    : null;
            const rainMountedAtStart = (rainParticleCountAtStart ?? 0) > 0;
            let rainUnmountMs = null;
            const weatherTransitionDispatched = weatherTransitionRequest
                ? globalThis.dispatchEvent(
                      new CustomEvent(weatherTransitionEventName, {
                          detail: { request: weatherTransitionRequest },
                      }),
                  )
                : false;
            const placementProfileDispatched = placementProfileRequest
                ? globalThis.dispatchEvent(
                      new CustomEvent(placementProfileEventName, {
                          detail: placementProfileRequest,
                      }),
                  )
                : false;

            let profileRecoveryFinished = !adaptiveHighProfileControlRecovery;
            const sampleWindowPromise = new Promise((resolveSample) => {
                const step = (now) => {
                    intervals.push(now - last);
                    last = now;
                    recordAdaptiveHighState();
                    recordEffectiveDpr();
                    const rainParticleCount =
                        globalThis.__grediceGameProfile?.rainParticleCount;
                    if (
                        rainMountedAtStart &&
                        rainUnmountMs === null &&
                        rainParticleCount === 0
                    ) {
                        rainUnmountMs = now - start;
                    }
                    if (now - start >= sampleMs && profileRecoveryFinished) {
                        resolveSample();
                        return;
                    }
                    requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            });
            const profileRecoveryPromise = adaptiveHighProfileControlRecovery
                ? (async () => {
                      const waitForControl = (milliseconds) =>
                          new Promise((resolveControlWait) =>
                              setTimeout(resolveControlWait, milliseconds),
                          );
                      const interactionDeadline =
                          performance.now() + Math.max(sampleMs * 2, 15_000);
                      const interactionQuietMs = 750;
                      let interactionIdleSinceMs = null;
                      while (true) {
                          const profile = globalThis.__grediceGameProfile;
                          const declined =
                              (profile?.adaptiveHighLevel ?? 0) >= 1 &&
                              (profile?.adaptiveHighDeclineCount ?? 0) >= 1;
                          if (
                              declined &&
                              profile?.adaptiveHighInteractionActive === false
                          ) {
                              interactionIdleSinceMs ??= performance.now();
                              if (
                                  performance.now() - interactionIdleSinceMs >=
                                  interactionQuietMs
                              ) {
                                  break;
                              }
                          } else {
                              interactionIdleSinceMs = null;
                          }
                          if (performance.now() >= interactionDeadline) {
                              return;
                          }
                          await waitForControl(25);
                      }

                      const controlledSampleCount = 22;
                      const controlledSampleIntervalMs = 250;
                      const controlledStartedAt = performance.now();
                      for (
                          let sampleIndex = 0;
                          sampleIndex < controlledSampleCount;
                          sampleIndex += 1
                      ) {
                          globalThis.dispatchEvent(
                              new CustomEvent(
                                  adaptiveHighProfileControlEventName,
                                  {
                                      detail: {
                                          action: 'sample',
                                          normalizedLoad: 0.7,
                                          source: 'frame',
                                      },
                                  },
                              ),
                          );
                          const nextSampleAt =
                              controlledStartedAt +
                              (sampleIndex + 1) * controlledSampleIntervalMs;
                          const remainingMs = nextSampleAt - performance.now();
                          if (remainingMs > 0) {
                              await waitForControl(remainingMs);
                          }
                      }
                      if (typeof adaptiveHighDprCapAtStart === 'number') {
                          const canvasDeadline = performance.now() + 5_000;
                          while (
                              Math.abs(
                                  (readEffectiveDpr() ?? 0) -
                                      adaptiveHighDprCapAtStart,
                              ) > 0.01 &&
                              performance.now() < canvasDeadline
                          ) {
                              await waitForControl(25);
                          }
                      }
                  })().finally(() => {
                      profileRecoveryFinished = true;
                  })
                : Promise.resolve();
            await Promise.all([sampleWindowPromise, profileRecoveryPromise]);

            const sampleEndedAt = performance.now();
            const frameIntervals = intervals.slice(1);
            const sortedIntervals = [...frameIntervals].sort((a, b) => a - b);
            const percentile = (value) =>
                sortedIntervals[
                    Math.min(
                        sortedIntervals.length - 1,
                        Math.floor(sortedIntervals.length * value),
                    )
                ] ?? 0;
            const averageFrameMs =
                frameIntervals.reduce((sum, value) => sum + value, 0) /
                Math.max(1, frameIntervals.length);
            const drawCalls = metrics?.drawCalls ?? 0;
            const instancedDrawCalls = metrics?.instancedDrawCalls ?? 0;
            const renderedFrames = metrics?.renderedFrames ?? 0;
            const submittedTriangles = Math.round(
                metrics?.submittedTriangles ?? 0,
            );
            const rafFrames = frameIntervals.length;
            const elapsedSeconds = (sampleEndedAt - start) / 1000;
            const safeElapsedSeconds = Math.max(Number.EPSILON, elapsedSeconds);
            const safeRafFrames = Math.max(1, rafFrames);
            const safeRenderedFrames = Math.max(1, renderedFrames);
            const interactionResolvedTargetCountAtEnd =
                typeof globalThis.__grediceGameProfile
                    ?.instancedInteractionResolvedTargetCount === 'number'
                    ? globalThis.__grediceGameProfile
                          .instancedInteractionResolvedTargetCount
                    : null;
            const actorGroundingShadowUpdateCountAtEnd =
                typeof globalThis.__grediceGameProfile
                    ?.actorGroundingShadowUpdateCount === 'number'
                    ? globalThis.__grediceGameProfile
                          .actorGroundingShadowUpdateCount
                    : null;
            const animatedCasterShadowRefreshCountAtEnd =
                typeof globalThis.__grediceGameProfile
                    ?.animatedCasterShadowRefreshCount === 'number'
                    ? globalThis.__grediceGameProfile
                          .animatedCasterShadowRefreshCount
                    : null;
            const primaryShadowRefreshCountAtEnd =
                typeof globalThis.__grediceGameProfile
                    ?.primaryShadowRefreshCount === 'number'
                    ? globalThis.__grediceGameProfile.primaryShadowRefreshCount
                    : null;
            const placementShadowDeferredChangeCountAtEnd =
                typeof globalThis.__grediceGameProfile
                    ?.placementShadowDeferredChangeCount === 'number'
                    ? globalThis.__grediceGameProfile
                          .placementShadowDeferredChangeCount
                    : null;
            const placementShadowFlushCountAtEnd =
                typeof globalThis.__grediceGameProfile
                    ?.placementShadowFlushCount === 'number'
                    ? globalThis.__grediceGameProfile.placementShadowFlushCount
                    : null;
            recordAdaptiveHighState();
            const adaptiveHighDeclineCountAtEnd = readProfileNumber(
                'adaptiveHighDeclineCount',
            );
            const adaptiveHighDprCapAtEnd =
                readProfileNumber('adaptiveHighDprCap');
            const adaptiveHighLevelAtEnd =
                readProfileNumber('adaptiveHighLevel');
            const adaptiveHighRecoveryCountAtEnd = readProfileNumber(
                'adaptiveHighRecoveryCount',
            );
            const adaptiveHighProfileControlSampleCountAtEnd =
                readProfileNumber('adaptiveHighProfileControlSampleCount');
            const adaptiveHighTransitionCountAtEnd = readProfileNumber(
                'adaptiveHighTransitionCount',
            );
            const cloudAttenuationUpdateCountAtEnd = readProfileNumber(
                'cloudAttenuationUpdateCount',
            );
            const nonGpuSample = {
                adaptiveHighDeclineCountDelta:
                    adaptiveHighDeclineCountAtStart === null ||
                    adaptiveHighDeclineCountAtEnd === null
                        ? null
                        : adaptiveHighDeclineCountAtEnd -
                          adaptiveHighDeclineCountAtStart,
                adaptiveHighDeclineObserved:
                    (adaptiveHighLevelAtStart !== null &&
                        adaptiveHighLevelMax !== null &&
                        adaptiveHighLevelMax > adaptiveHighLevelAtStart) ||
                    (adaptiveHighDprCapAtStart !== null &&
                        adaptiveHighDprCapMin !== null &&
                        adaptiveHighDprCapMin < adaptiveHighDprCapAtStart),
                adaptiveHighDprCapAtEnd,
                adaptiveHighDprCapAtStart,
                adaptiveHighDprCapMin,
                adaptiveHighGpuSourceObserved,
                adaptiveHighInteractionObserved,
                adaptiveHighLevelAtEnd,
                adaptiveHighLevelAtStart,
                adaptiveHighLevelMax,
                adaptiveHighRecoveryCountDelta:
                    adaptiveHighRecoveryCountAtStart === null ||
                    adaptiveHighRecoveryCountAtEnd === null
                        ? null
                        : adaptiveHighRecoveryCountAtEnd -
                          adaptiveHighRecoveryCountAtStart,
                adaptiveHighProfileControlObserved,
                adaptiveHighProfileControlSampleCountDelta:
                    adaptiveHighProfileControlSampleCountAtStart === null ||
                    adaptiveHighProfileControlSampleCountAtEnd === null
                        ? null
                        : adaptiveHighProfileControlSampleCountAtEnd -
                          adaptiveHighProfileControlSampleCountAtStart,
                adaptiveHighProfileControlStarted,
                adaptiveHighTransitionCountDelta:
                    adaptiveHighTransitionCountAtStart === null ||
                    adaptiveHighTransitionCountAtEnd === null
                        ? null
                        : adaptiveHighTransitionCountAtEnd -
                          adaptiveHighTransitionCountAtStart,
                actorGroundingShadowUpdateCountDelta:
                    actorGroundingShadowUpdateCountAtStart === null ||
                    actorGroundingShadowUpdateCountAtEnd === null
                        ? null
                        : actorGroundingShadowUpdateCountAtEnd -
                          actorGroundingShadowUpdateCountAtStart,
                animatedCasterShadowRefreshCountDelta:
                    animatedCasterShadowRefreshCountAtStart === null ||
                    animatedCasterShadowRefreshCountAtEnd === null
                        ? null
                        : animatedCasterShadowRefreshCountAtEnd -
                          animatedCasterShadowRefreshCountAtStart,
                averageFrameMs,
                canvas: canvas
                    ? {
                          clientHeight: canvas.clientHeight,
                          clientWidth: canvas.clientWidth,
                          height: canvas.height,
                          width: canvas.width,
                      }
                    : null,
                drawCalls,
                drawCallsPerFrame: drawCalls / safeRafFrames,
                drawCallsPerRafFrame: drawCalls / safeRafFrames,
                drawCallsPerRenderedFrame:
                    renderedFrames > 0 ? drawCalls / safeRenderedFrames : 0,
                drawCallsPerSecond: drawCalls / safeElapsedSeconds,
                cloudAttenuationUpdateCountDelta:
                    cloudAttenuationUpdateCountAtStart === null ||
                    cloudAttenuationUpdateCountAtEnd === null
                        ? null
                        : cloudAttenuationUpdateCountAtEnd -
                          cloudAttenuationUpdateCountAtStart,
                effectiveDprAtEnd: readEffectiveDpr(),
                effectiveDprMin,
                elapsedMs: elapsedSeconds * 1000,
                fps: rafFrames / safeElapsedSeconds,
                frames: rafFrames,
                instancedDrawCalls,
                instancedInteractionResolvedTargetCountDelta:
                    interactionResolvedTargetCountAtStart === null ||
                    interactionResolvedTargetCountAtEnd === null
                        ? null
                        : Math.max(
                              0,
                              interactionResolvedTargetCountAtEnd -
                                  interactionResolvedTargetCountAtStart,
                          ),
                jsHeapMb: performance.memory
                    ? performance.memory.usedJSHeapSize / 1024 / 1024
                    : null,
                maxFrameMs: sortedIntervals.at(-1) ?? 0,
                p50FrameMs: percentile(0.5),
                p95FrameMs: percentile(0.95),
                p99FrameMs: percentile(0.99),
                outlineProfileDispatched,
                outlineProfileTelemetryAvailable,
                placementProfileDispatched,
                placementShadowDeferredChangeCountDelta:
                    placementShadowDeferredChangeCountAtStart === null ||
                    placementShadowDeferredChangeCountAtEnd === null
                        ? null
                        : placementShadowDeferredChangeCountAtEnd -
                          placementShadowDeferredChangeCountAtStart,
                placementShadowFlushCountDelta:
                    placementShadowFlushCountAtStart === null ||
                    placementShadowFlushCountAtEnd === null
                        ? null
                        : placementShadowFlushCountAtEnd -
                          placementShadowFlushCountAtStart,
                primaryShadowRefreshCountAtStart,
                primaryShadowRefreshCountDelta:
                    primaryShadowRefreshCountAtStart === null ||
                    primaryShadowRefreshCountAtEnd === null
                        ? null
                        : primaryShadowRefreshCountAtEnd -
                          primaryShadowRefreshCountAtStart,
                rainMountedAtStart,
                rainParticleCountAtEnd:
                    typeof globalThis.__grediceGameProfile
                        ?.rainParticleCount === 'number'
                        ? globalThis.__grediceGameProfile.rainParticleCount
                        : null,
                rainParticleCountAtStart,
                rainUnmountMs,
                reportedDpr: globalThis.devicePixelRatio,
                renderedFps: renderedFrames / safeElapsedSeconds,
                renderedFrames,
                submittedTriangles,
                trianglesPerFrame: submittedTriangles / safeRafFrames,
                trianglesPerRafFrame: submittedTriangles / safeRafFrames,
                trianglesPerRenderedFrame:
                    renderedFrames > 0
                        ? submittedTriangles / safeRenderedFrames
                        : 0,
                trianglesPerSecond: submittedTriangles / safeElapsedSeconds,
                weatherTransitionDispatched,
                weatherTransitionRequest,
            };
            globalThis.__gameProfileGpuTimer?.stop();

            return {
                ...nonGpuSample,
                sampleWindow: {
                    endedAt: sampleEndedAt,
                    startedAt: start,
                },
            };
        },
        {
            adaptiveHighProfileControlEventName:
                adaptiveHighQualityProfileControlEventName,
            adaptiveHighProfileControlRecovery:
                scenario.profileControlRecovery === true,
            adaptiveHighProfileControlStarted,
            outlineProfileDispatched: outlineProfileState.dispatched,
            outlineProfileTelemetryAvailable:
                outlineProfileState.telemetryAvailable,
            placementProfileEventName: gameProfilePlacementCommandEventName,
            placementProfileRequest,
            sampleMs,
            weatherTransitionEventName: gameProfileWeatherTransitionEventName,
            weatherTransitionRequest,
        },
    );
    const sampleCompletionPromise = samplePromise.then((sampleAtEndpoint) =>
        finalizeProfileSampleAtEndpoint({
            cdp,
            page,
            sampleAtEndpoint,
        }),
    );
    const motionPromise =
        scenario.motion || scenario.interaction
            ? runScenarioMotion(page, scenario, sampleMs)
            : Promise.resolve();
    const [sampleCompletion] = await Promise.all([
        sampleCompletionPromise,
        motionPromise,
    ]);
    const sample = normalizeRenderWork(sampleCompletion.sample);
    const after = Object.fromEntries(
        sampleCompletion.endpointMetrics.metrics.map((metric) => [
            metric.name,
            metric.value,
        ]),
    );

    const runtime = await page.evaluate(() => {
        const metadata = globalThis.__grediceGameProfile;
        if (!metadata || typeof metadata !== 'object') {
            return null;
        }
        const booleanOrNull = (value) =>
            typeof value === 'boolean' ? value : null;
        const numberOrNull = (value) =>
            typeof value === 'number' ? value : null;
        const stringOrNull = (value) =>
            typeof value === 'string' ? value : null;

        return {
            adaptiveHighAmbientFps: numberOrNull(
                metadata.adaptiveHighAmbientFps,
            ),
            adaptiveHighCloudUpdateMs: numberOrNull(
                metadata.adaptiveHighCloudUpdateMs,
            ),
            adaptiveHighDeclineCount: numberOrNull(
                metadata.adaptiveHighDeclineCount,
            ),
            adaptiveHighDprCap: numberOrNull(metadata.adaptiveHighDprCap),
            adaptiveHighEnabled: booleanOrNull(metadata.adaptiveHighEnabled),
            adaptiveHighEwmaMs: numberOrNull(metadata.adaptiveHighEwmaMs),
            adaptiveHighFactor: numberOrNull(metadata.adaptiveHighFactor),
            adaptiveHighGpuTimerDisjointCount: numberOrNull(
                metadata.adaptiveHighGpuTimerDisjointCount,
            ),
            adaptiveHighGpuTimerPendingCount: numberOrNull(
                metadata.adaptiveHighGpuTimerPendingCount,
            ),
            adaptiveHighGpuTimerSupported: booleanOrNull(
                metadata.adaptiveHighGpuTimerSupported,
            ),
            adaptiveHighInteractionActive: booleanOrNull(
                metadata.adaptiveHighInteractionActive,
            ),
            adaptiveHighLevel: numberOrNull(metadata.adaptiveHighLevel),
            adaptiveHighLevelDwellMs: numberOrNull(
                metadata.adaptiveHighLevelDwellMs,
            ),
            adaptiveHighLoad: numberOrNull(metadata.adaptiveHighLoad),
            adaptiveHighOscillationCount: numberOrNull(
                metadata.adaptiveHighOscillationCount,
            ),
            adaptiveHighProfileControlActive: booleanOrNull(
                metadata.adaptiveHighProfileControlActive,
            ),
            adaptiveHighProfileControlEnabled: booleanOrNull(
                metadata.adaptiveHighProfileControlEnabled,
            ),
            adaptiveHighProfileControlSampleCount: numberOrNull(
                metadata.adaptiveHighProfileControlSampleCount,
            ),
            adaptiveHighReason: stringOrNull(metadata.adaptiveHighReason),
            adaptiveHighRecoveryCount: numberOrNull(
                metadata.adaptiveHighRecoveryCount,
            ),
            adaptiveHighSampleMs: numberOrNull(metadata.adaptiveHighSampleMs),
            adaptiveHighSampleSource: stringOrNull(
                metadata.adaptiveHighSampleSource,
            ),
            adaptiveHighTransitionCount: numberOrNull(
                metadata.adaptiveHighTransitionCount,
            ),
            actorGroundingShadowBatchCount:
                typeof metadata.actorGroundingShadowBatchCount === 'number'
                    ? metadata.actorGroundingShadowBatchCount
                    : null,
            actorGroundingShadowCapacity:
                typeof metadata.actorGroundingShadowCapacity === 'number'
                    ? metadata.actorGroundingShadowCapacity
                    : null,
            actorGroundingShadowCount:
                typeof metadata.actorGroundingShadowCount === 'number'
                    ? metadata.actorGroundingShadowCount
                    : null,
            actorGroundingShadowDroppedCount:
                typeof metadata.actorGroundingShadowDroppedCount === 'number'
                    ? metadata.actorGroundingShadowDroppedCount
                    : null,
            actorGroundingShadowPrimaryCasterCount:
                typeof metadata.actorGroundingShadowPrimaryCasterCount ===
                'number'
                    ? metadata.actorGroundingShadowPrimaryCasterCount
                    : null,
            actorGroundingShadowUpdateCount:
                typeof metadata.actorGroundingShadowUpdateCount === 'number'
                    ? metadata.actorGroundingShadowUpdateCount
                    : null,
            actorGroundingShadowVisibleCount:
                typeof metadata.actorGroundingShadowVisibleCount === 'number'
                    ? metadata.actorGroundingShadowVisibleCount
                    : null,
            animatedCasterShadowRefreshCount:
                typeof metadata.animatedCasterShadowRefreshCount === 'number'
                    ? metadata.animatedCasterShadowRefreshCount
                    : null,
            cloudAttenuationMaskResolution:
                typeof metadata.cloudAttenuationMaskResolution === 'number'
                    ? metadata.cloudAttenuationMaskResolution
                    : null,
            cloudAttenuationMaterialCount:
                typeof metadata.cloudAttenuationMaterialCount === 'number'
                    ? metadata.cloudAttenuationMaterialCount
                    : null,
            cloudAttenuationUpdateCount:
                typeof metadata.cloudAttenuationUpdateCount === 'number'
                    ? metadata.cloudAttenuationUpdateCount
                    : null,
            cloudAttenuationUpdateMs:
                typeof metadata.cloudAttenuationUpdateMs === 'number'
                    ? metadata.cloudAttenuationUpdateMs
                    : null,
            cloudProjectedShadowCount:
                typeof metadata.cloudProjectedShadowCount === 'number'
                    ? metadata.cloudProjectedShadowCount
                    : null,
            cloudRealShadowCasterCount:
                typeof metadata.cloudRealShadowCasterCount === 'number'
                    ? metadata.cloudRealShadowCasterCount
                    : null,
            cloudVisualCount:
                typeof metadata.cloudVisualCount === 'number'
                    ? metadata.cloudVisualCount
                    : null,
            dprCap:
                typeof metadata.dprCap === 'number' ? metadata.dprCap : null,
            groundDecorationAtlasEstimatedGpuBytes:
                typeof metadata.groundDecorationAtlasEstimatedGpuBytes ===
                'number'
                    ? metadata.groundDecorationAtlasEstimatedGpuBytes
                    : null,
            groundDecorationAtlasPageCount:
                typeof metadata.groundDecorationAtlasPageCount === 'number'
                    ? metadata.groundDecorationAtlasPageCount
                    : null,
            groundDecorationChunkCount:
                typeof metadata.groundDecorationChunkCount === 'number'
                    ? metadata.groundDecorationChunkCount
                    : null,
            groundDecorationCount:
                typeof metadata.groundDecorationCount === 'number'
                    ? metadata.groundDecorationCount
                    : null,
            groundDecorationDensity:
                typeof metadata.groundDecorationDensity === 'number'
                    ? metadata.groundDecorationDensity
                    : null,
            groundDecorationVisibleCount:
                typeof metadata.groundDecorationVisibleCount === 'number'
                    ? metadata.groundDecorationVisibleCount
                    : null,
            hoverOutlineActiveTargetCount: numberOrNull(
                metadata.hoverOutlineActiveTargetCount,
            ),
            hoverOutlineAllocatedHeight: numberOrNull(
                metadata.hoverOutlineAllocatedHeight,
            ),
            hoverOutlineAllocatedPixelCount: numberOrNull(
                metadata.hoverOutlineAllocatedPixelCount,
            ),
            hoverOutlineAllocatedWidth: numberOrNull(
                metadata.hoverOutlineAllocatedWidth,
            ),
            hoverOutlineAllocationEstimatedBytes: numberOrNull(
                metadata.hoverOutlineAllocationEstimatedBytes,
            ),
            hoverOutlineCompositePassCount: numberOrNull(
                metadata.hoverOutlineCompositePassCount,
            ),
            hoverOutlineCropClippedCount: numberOrNull(
                metadata.hoverOutlineCropClippedCount,
            ),
            hoverOutlineCropPixelCount: numberOrNull(
                metadata.hoverOutlineCropPixelCount,
            ),
            hoverOutlineDrawingBufferPixelCount: numberOrNull(
                metadata.hoverOutlineDrawingBufferPixelCount,
            ),
            hoverOutlineFormat: stringOrNull(metadata.hoverOutlineFormat),
            hoverOutlineHorizontalPassCount: numberOrNull(
                metadata.hoverOutlineHorizontalPassCount,
            ),
            hoverOutlineKernelSampleCount: numberOrNull(
                metadata.hoverOutlineKernelSampleCount,
            ),
            hoverOutlineMaskPassCount: numberOrNull(
                metadata.hoverOutlineMaskPassCount,
            ),
            hoverOutlineMaxKernelSampleCount: numberOrNull(
                metadata.hoverOutlineMaxKernelSampleCount,
            ),
            hoverOutlinePipeline: stringOrNull(metadata.hoverOutlinePipeline),
            hoverOutlineProfileCommandAction: stringOrNull(
                metadata.hoverOutlineProfileCommandAction,
            ),
            hoverOutlineProfileTargetBlockId: stringOrNull(
                metadata.hoverOutlineProfileTargetBlockId,
            ),
            hoverOutlineProfileTargetRaisedBedId: numberOrNull(
                metadata.hoverOutlineProfileTargetRaisedBedId,
            ),
            hoverOutlineRenderTargetCount: numberOrNull(
                metadata.hoverOutlineRenderTargetCount,
            ),
            hoverOutlineRoiRatio: numberOrNull(metadata.hoverOutlineRoiRatio),
            hoverOutlineStyleGroupCount: numberOrNull(
                metadata.hoverOutlineStyleGroupCount,
            ),
            hoverOutlineThickness: numberOrNull(metadata.hoverOutlineThickness),
            generatedLSystemCacheEntryCount:
                typeof metadata.generatedLSystemCacheEntryCount === 'number'
                    ? metadata.generatedLSystemCacheEntryCount
                    : null,
            generatedLSystemCacheEstimatedBytes:
                typeof metadata.generatedLSystemCacheEstimatedBytes === 'number'
                    ? metadata.generatedLSystemCacheEstimatedBytes
                    : null,
            generatedLSystemCacheEvictionCount:
                typeof metadata.generatedLSystemCacheEvictionCount === 'number'
                    ? metadata.generatedLSystemCacheEvictionCount
                    : null,
            generatedLSystemCacheHitCount:
                typeof metadata.generatedLSystemCacheHitCount === 'number'
                    ? metadata.generatedLSystemCacheHitCount
                    : null,
            generatedLSystemCacheMaxEntryCount:
                typeof metadata.generatedLSystemCacheMaxEntryCount === 'number'
                    ? metadata.generatedLSystemCacheMaxEntryCount
                    : null,
            generatedLSystemCacheMaxEstimatedBytes:
                typeof metadata.generatedLSystemCacheMaxEstimatedBytes ===
                'number'
                    ? metadata.generatedLSystemCacheMaxEstimatedBytes
                    : null,
            generatedLSystemCacheMissCount:
                typeof metadata.generatedLSystemCacheMissCount === 'number'
                    ? metadata.generatedLSystemCacheMissCount
                    : null,
            generatedLSystemCacheOversizeSkipCount:
                typeof metadata.generatedLSystemCacheOversizeSkipCount ===
                'number'
                    ? metadata.generatedLSystemCacheOversizeSkipCount
                    : null,
            generatedLSystemCachePeakEstimatedBytes:
                typeof metadata.generatedLSystemCachePeakEstimatedBytes ===
                'number'
                    ? metadata.generatedLSystemCachePeakEstimatedBytes
                    : null,
            generatedLSystemCacheWriteCount:
                typeof metadata.generatedLSystemCacheWriteCount === 'number'
                    ? metadata.generatedLSystemCacheWriteCount
                    : null,
            generatedPlantBatchCount:
                typeof metadata.generatedPlantBatchCount === 'number'
                    ? metadata.generatedPlantBatchCount
                    : null,
            generatedPlantFieldCount:
                typeof metadata.generatedPlantFieldCount === 'number'
                    ? metadata.generatedPlantFieldCount
                    : null,
            generatedPlantExpectedInstanceCount:
                typeof metadata.generatedPlantExpectedInstanceCount === 'number'
                    ? metadata.generatedPlantExpectedInstanceCount
                    : null,
            generatedPlantInstanceCount:
                typeof metadata.generatedPlantInstanceCount === 'number'
                    ? metadata.generatedPlantInstanceCount
                    : null,
            generatedPlantVisibleFieldCount:
                typeof metadata.generatedPlantVisibleFieldCount === 'number'
                    ? metadata.generatedPlantVisibleFieldCount
                    : null,
            generatedPlantVisibleInstanceCount:
                typeof metadata.generatedPlantVisibleInstanceCount === 'number'
                    ? metadata.generatedPlantVisibleInstanceCount
                    : null,
            operationVisualHighlightProfileDispatched: booleanOrNull(
                metadata.operationVisualHighlightProfileDispatched,
            ),
            operationVisualHighlightProfileTargetFieldId: numberOrNull(
                metadata.operationVisualHighlightProfileTargetFieldId,
            ),
            operationVisualHighlightProfileTargetGardenId: numberOrNull(
                metadata.operationVisualHighlightProfileTargetGardenId,
            ),
            operationVisualHighlightProfileTargetPositionIndex: numberOrNull(
                metadata.operationVisualHighlightProfileTargetPositionIndex,
            ),
            operationVisualHighlightProfileTargetRaisedBedId: numberOrNull(
                metadata.operationVisualHighlightProfileTargetRaisedBedId,
            ),
            instancedInteractionControllerCount:
                typeof metadata.instancedInteractionControllerCount === 'number'
                    ? metadata.instancedInteractionControllerCount
                    : null,
            instancedInteractionResolutionCount:
                typeof metadata.instancedInteractionResolutionCount === 'number'
                    ? metadata.instancedInteractionResolutionCount
                    : null,
            instancedInteractionResolutionMaxMs:
                typeof metadata.instancedInteractionResolutionMaxMs === 'number'
                    ? metadata.instancedInteractionResolutionMaxMs
                    : null,
            instancedInteractionResolutionTotalMs:
                typeof metadata.instancedInteractionResolutionTotalMs ===
                'number'
                    ? metadata.instancedInteractionResolutionTotalMs
                    : null,
            instancedInteractionResolvedTargetCount:
                typeof metadata.instancedInteractionResolvedTargetCount ===
                'number'
                    ? metadata.instancedInteractionResolvedTargetCount
                    : null,
            instancedInteractionTargetCount:
                typeof metadata.instancedInteractionTargetCount === 'number'
                    ? metadata.instancedInteractionTargetCount
                    : null,
            instancedSnowOverlayCount:
                typeof metadata.instancedSnowOverlayCount === 'number'
                    ? metadata.instancedSnowOverlayCount
                    : null,
            placementChunkLogicalTouchedCount:
                typeof metadata.placementChunkLogicalTouchedCount === 'number'
                    ? metadata.placementChunkLogicalTouchedCount
                    : null,
            placementChunkLogicalUpdateCount:
                typeof metadata.placementChunkLogicalUpdateCount === 'number'
                    ? metadata.placementChunkLogicalUpdateCount
                    : null,
            placementChunkPhysicalRebuildCount:
                typeof metadata.placementChunkPhysicalRebuildCount === 'number'
                    ? metadata.placementChunkPhysicalRebuildCount
                    : null,
            placementChunkPhysicalRebuildDurationMaxMs:
                typeof metadata.placementChunkPhysicalRebuildDurationMaxMs ===
                'number'
                    ? metadata.placementChunkPhysicalRebuildDurationMaxMs
                    : null,
            placementChunkPhysicalRebuildDurationP95Ms:
                typeof metadata.placementChunkPhysicalRebuildDurationP95Ms ===
                'number'
                    ? metadata.placementChunkPhysicalRebuildDurationP95Ms
                    : null,
            placementChunkPhysicalTransformedInstanceCount:
                typeof metadata.placementChunkPhysicalTransformedInstanceCount ===
                'number'
                    ? metadata.placementChunkPhysicalTransformedInstanceCount
                    : null,
            placementProjectedShadowCount:
                typeof metadata.placementProjectedShadowCount === 'number'
                    ? metadata.placementProjectedShadowCount
                    : null,
            placementProjectedShadowDroppedCount:
                typeof metadata.placementProjectedShadowDroppedCount ===
                'number'
                    ? metadata.placementProjectedShadowDroppedCount
                    : null,
            placementProjectedShadowPeakCount:
                typeof metadata.placementProjectedShadowPeakCount === 'number'
                    ? metadata.placementProjectedShadowPeakCount
                    : null,
            placementShadowActiveCount:
                typeof metadata.placementShadowActiveCount === 'number'
                    ? metadata.placementShadowActiveCount
                    : null,
            placementShadowDeferredChangeCount:
                typeof metadata.placementShadowDeferredChangeCount === 'number'
                    ? metadata.placementShadowDeferredChangeCount
                    : null,
            placementShadowFlushCount:
                typeof metadata.placementShadowFlushCount === 'number'
                    ? metadata.placementShadowFlushCount
                    : null,
            qualityTier:
                typeof metadata.qualityTier === 'string'
                    ? metadata.qualityTier
                    : null,
            rainParticleCount:
                typeof metadata.rainParticleCount === 'number'
                    ? metadata.rainParticleCount
                    : null,
            rainWetOverlayDistinctUniformCount:
                typeof metadata.rainWetOverlayDistinctUniformCount === 'number'
                    ? metadata.rainWetOverlayDistinctUniformCount
                    : null,
            rainWetOverlayMaterialConsumerCount:
                typeof metadata.rainWetOverlayMaterialConsumerCount === 'number'
                    ? metadata.rainWetOverlayMaterialConsumerCount
                    : null,
            raisedBedFieldVisualBatchCount: numberOrNull(
                metadata.raisedBedFieldVisualBatchCount,
            ),
            raisedBedFieldVisualChunkCount: numberOrNull(
                metadata.raisedBedFieldVisualChunkCount,
            ),
            raisedBedFieldVisualInstanceCount: numberOrNull(
                metadata.raisedBedFieldVisualInstanceCount,
            ),
            raisedBedFieldVisualMatrixUploadCount: numberOrNull(
                metadata.raisedBedFieldVisualMatrixUploadCount,
            ),
            raisedBedFieldVisualObjectCount: numberOrNull(
                metadata.raisedBedFieldVisualObjectCount,
            ),
            raisedBedFieldVisualUploadedInstanceCount: numberOrNull(
                metadata.raisedBedFieldVisualUploadedInstanceCount,
            ),
            raisedBedMulchBatchCount: numberOrNull(
                metadata.raisedBedMulchBatchCount,
            ),
            raisedBedMulchGroupCount: numberOrNull(
                metadata.raisedBedMulchGroupCount,
            ),
            raisedBedMulchInstanceCount: numberOrNull(
                metadata.raisedBedMulchInstanceCount,
            ),
            raisedBedMulchObjectCount: numberOrNull(
                metadata.raisedBedMulchObjectCount,
            ),
            raisedBedMulchOverlayCount:
                typeof metadata.raisedBedMulchOverlayCount === 'number'
                    ? metadata.raisedBedMulchOverlayCount
                    : null,
            primaryShadowRefreshCount:
                typeof metadata.primaryShadowRefreshCount === 'number'
                    ? metadata.primaryShadowRefreshCount
                    : null,
            shadowMapAutoUpdate:
                typeof metadata.shadowMapAutoUpdate === 'boolean'
                    ? metadata.shadowMapAutoUpdate
                    : null,
            shadowMapInvalidationCount:
                typeof metadata.shadowMapInvalidationCount === 'number'
                    ? metadata.shadowMapInvalidationCount
                    : null,
            shadowMapSize:
                typeof metadata.shadowMapSize === 'number'
                    ? metadata.shadowMapSize
                    : null,
            shadowsEnabled:
                typeof metadata.shadowsEnabled === 'boolean'
                    ? metadata.shadowsEnabled
                    : null,
            snowOverlayDistinctUniformCount:
                typeof metadata.snowOverlayDistinctUniformCount === 'number'
                    ? metadata.snowOverlayDistinctUniformCount
                    : null,
            snowOverlayMaterialConsumerCount:
                typeof metadata.snowOverlayMaterialConsumerCount === 'number'
                    ? metadata.snowOverlayMaterialConsumerCount
                    : null,
            snowOverlayMinCoverage:
                typeof metadata.snowOverlayMinCoverage === 'number'
                    ? metadata.snowOverlayMinCoverage
                    : null,
            snowParticleCapacity:
                typeof metadata.snowParticleCapacity === 'number'
                    ? metadata.snowParticleCapacity
                    : null,
            snowParticleCount:
                typeof metadata.snowParticleCount === 'number'
                    ? metadata.snowParticleCount
                    : null,
            snowParticleGeometryBuildCount:
                typeof metadata.snowParticleGeometryBuildCount === 'number'
                    ? metadata.snowParticleGeometryBuildCount
                    : null,
            weatherDisabled:
                typeof metadata.weatherDisabled === 'boolean'
                    ? metadata.weatherDisabled
                    : null,
        };
    });

    const screenshotPath = options.screenshots
        ? resolve(options.outDir, 'screenshots', `${scenario.name}.png`)
        : null;
    if (screenshotPath) {
        await mkdir(dirname(screenshotPath), { recursive: true });
        await page.screenshot({
            path: screenshotPath,
            animations: 'disabled',
            fullPage: false,
        });
    }

    await context.close();

    const roundedSample = roundSample(sample);
    const requested = {
        adaptiveHigh: profileMetadata?.adaptiveHigh ?? request.adaptiveHigh,
        autoQualityDeviceClass:
            scenario.autoQualityDeviceClass ?? 'unspecified',
        autoQualityMetrics: profileMetadata?.autoQualityMetrics ?? null,
        blockGeometryMerging:
            profileMetadata?.blockGeometryMerging ??
            request.blockGeometryMerging,
        comparisonPair: scenario.comparisonPair ?? null,
        comparisonRole: scenario.comparisonRole ?? null,
        controls: profileMetadata?.controls ?? request.controls,
        details: profileMetadata?.details ?? request.details,
        debugHud: profileMetadata?.debugHud ?? request.debugHud,
        dpr: scenario.dpr,
        gardenProfile: profileMetadata?.gardenProfile ?? request.gardenProfile,
        graphicsBackend: options.graphicsBackend,
        hud: profileMetadata?.hud ?? request.hud,
        isMobile: scenario.isMobile,
        mode: profileMetadata?.mode ?? request.mode,
        motion: scenario.motion ?? scenario.interaction ?? 'none',
        operationVisuals:
            profileMetadata?.operationVisuals ?? request.operationVisuals,
        outline: profileMetadata?.outline ?? request.outline,
        outlineProfile:
            outlineProfileRequest === null ? 'none' : 'connected-raised-bed',
        outlineRaisedBedId: outlineProfileRequest?.raisedBedId ?? null,
        scenarioName: scenario.name,
        placementProfile:
            placementProfileRequest === null ? 'none' : 'placement-drop',
        profileControl: scenario.profileControl === true,
        profileControlRecovery: scenario.profileControlRecovery === true,
        quality: profileMetadata?.quality ?? request.quality,
        runtimeGpuSource: scenario.runtimeGpuSource === true,
        sampleMs,
        viewport: scenario.viewport,
        weatherTransition: weatherTransitionRequest ?? 'none',
    };
    const budget = evaluateBudget(roundedSample, budgets[scenario.budget]);
    const acceptance = evaluateHighTargetAcceptance({
        apiErrors,
        environment,
        pageErrors,
        requested,
        runtime,
        sample: roundedSample,
    });
    return {
        acceptance,
        apiErrors: apiErrors.slice(0, 8),
        budget: {
            checks: [...budget.checks, ...acceptance.checks],
            pass: budget.pass && acceptance.pass,
        },
        budgetName: scenario.budget,
        consoleMessages: consoleMessages.slice(0, 8),
        cdp: {
            jsHeapMb: round((after.JSHeapUsedSize ?? 0) / 1024 / 1024, 1),
            layoutDuration: round(
                (after.LayoutDuration ?? 0) - (before.LayoutDuration ?? 0),
                4,
            ),
            scriptDuration: round(
                (after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0),
                4,
            ),
            taskDuration: round(
                (after.TaskDuration ?? 0) - (before.TaskDuration ?? 0),
                4,
            ),
        },
        domContentLoadedMs,
        environment,
        canvasReadyMs,
        pageErrors,
        path: scenario.path,
        performanceBudget: budget,
        requested,
        runtime,
        sample: roundedSample,
        screenshotPath,
        url,
        name: scenario.name,
    };
}

function round(value, digits = 2) {
    if (value === null || value === undefined) {
        return value;
    }

    const multiplier = 10 ** digits;
    return Math.round(value * multiplier) / multiplier;
}

function normalizeRenderWork(sample) {
    const rafFrames = Math.max(1, sample.frames ?? 0);
    const renderedFrames = Math.max(1, sample.renderedFrames ?? 0);
    const hasRenderedFrames = (sample.renderedFrames ?? 0) > 0;

    return {
        ...sample,
        drawCallsPerFrame: sample.drawCalls / rafFrames,
        drawCallsPerRafFrame: sample.drawCalls / rafFrames,
        drawCallsPerRenderedFrame: hasRenderedFrames
            ? sample.drawCalls / renderedFrames
            : 0,
        trianglesPerFrame: sample.submittedTriangles / rafFrames,
        trianglesPerRafFrame: sample.submittedTriangles / rafFrames,
        trianglesPerRenderedFrame: hasRenderedFrames
            ? sample.submittedTriangles / renderedFrames
            : 0,
    };
}

function roundSample(sample) {
    return {
        ...sample,
        adaptiveHighDprCapAtEnd: round(sample.adaptiveHighDprCapAtEnd, 3),
        adaptiveHighDprCapAtStart: round(sample.adaptiveHighDprCapAtStart, 3),
        adaptiveHighDprCapMin: round(sample.adaptiveHighDprCapMin, 3),
        averageFrameMs: round(sample.averageFrameMs),
        drawCallsPerFrame: round(sample.drawCallsPerFrame, 1),
        drawCallsPerRafFrame: round(sample.drawCallsPerRafFrame, 1),
        drawCallsPerRenderedFrame: round(sample.drawCallsPerRenderedFrame, 1),
        drawCallsPerSecond: round(sample.drawCallsPerSecond, 1),
        effectiveDprAtEnd: round(sample.effectiveDprAtEnd, 3),
        effectiveDprMin: round(sample.effectiveDprMin, 3),
        elapsedMs: round(sample.elapsedMs),
        fps: round(sample.fps, 1),
        gpu: sample.gpu
            ? {
                  ...sample.gpu,
                  elapsedMaxMs: round(sample.gpu.elapsedMaxMs),
                  elapsedP95Ms: round(sample.gpu.elapsedP95Ms),
                  elapsedTotalMs: round(sample.gpu.elapsedTotalMs),
              }
            : undefined,
        jsHeapMb: round(sample.jsHeapMb, 1),
        longTaskMaxMs: round(sample.longTaskMaxMs, 1),
        longTaskTotalMs: round(sample.longTaskTotalMs, 1),
        maxFrameMs: round(sample.maxFrameMs),
        p50FrameMs: round(sample.p50FrameMs),
        p95FrameMs: round(sample.p95FrameMs),
        p99FrameMs: round(sample.p99FrameMs),
        rainUnmountMs: round(sample.rainUnmountMs),
        renderedFps: round(sample.renderedFps, 1),
        trianglesPerFrame: Math.round(sample.trianglesPerFrame),
        trianglesPerRafFrame: Math.round(sample.trianglesPerRafFrame),
        trianglesPerRenderedFrame: Math.round(sample.trianglesPerRenderedFrame),
        trianglesPerSecond: Math.round(sample.trianglesPerSecond),
    };
}

function evaluateBudget(sample, budget) {
    const checks = [
        ['p95FrameMs', sample.p95FrameMs, budget.p95FrameMs],
        ['maxFrameMs', sample.maxFrameMs, budget.maxFrameMs],
        ['longTaskCount', sample.longTaskCount, budget.longTaskCount],
        ['jsHeapMb', sample.jsHeapMb ?? 0, budget.jsHeapMb],
    ].map(([name, actual, limit]) => ({
        actual,
        limit,
        name,
        pass: actual <= limit,
    }));
    for (const name of [
        'drawCallsPerFrame',
        'drawCallsPerRenderedFrame',
        'trianglesPerFrame',
        'trianglesPerRenderedFrame',
    ]) {
        if (budget[name] === undefined) {
            continue;
        }
        checks.push({
            actual: sample[name],
            limit: budget[name],
            name,
            pass: sample[name] <= budget[name],
        });
    }
    if (budget.gpuElapsedP95Ms !== undefined) {
        const actual = sample.gpu?.elapsedP95Ms ?? null;
        const valid = sample.gpu?.valid === true && Number.isFinite(actual);
        checks.push({
            actual,
            limit: budget.gpuElapsedP95Ms,
            name: 'gpuElapsedP95Ms',
            pass: !valid || actual <= budget.gpuElapsedP95Ms,
            skipped: !valid,
        });
    }

    return {
        checks,
        pass: checks.every((check) => check.pass),
    };
}

function evaluateHighTargetAcceptance({
    apiErrors = [],
    environment,
    pageErrors,
    requested,
    runtime,
    sample,
}) {
    if (requested.gardenProfile !== 'high-target') {
        return { checks: [], pass: true };
    }

    const exact = (name, actual, expected) => ({
        actual,
        comparison: 'equal',
        limit: expected,
        name,
        pass: actual === expected,
    });
    const minimum = (name, actual, limit) => ({
        actual,
        comparison: 'minimum',
        limit,
        name,
        pass: typeof actual === 'number' && actual >= limit,
    });
    const finiteMinimum = (name, actual, limit) => ({
        actual,
        comparison: 'finite-minimum',
        limit,
        name,
        pass:
            typeof actual === 'number' &&
            Number.isFinite(actual) &&
            actual >= limit,
    });
    const range = (name, actual, minimumValue, maximumValue) => ({
        actual,
        comparison: 'range',
        limit: {
            maximum: maximumValue,
            minimum: minimumValue,
        },
        name,
        pass:
            typeof actual === 'number' &&
            actual >= minimumValue &&
            actual <= maximumValue,
    });
    const canvasMatchesDpr = (name, actual, clientSize, dpr) => {
        const expected =
            typeof clientSize === 'number' && typeof dpr === 'number'
                ? Math.round(clientSize * dpr)
                : null;
        return {
            actual,
            comparison: 'within-pixels',
            limit: expected,
            name,
            pass:
                typeof actual === 'number' &&
                expected !== null &&
                Math.abs(actual - expected) <= 2,
        };
    };
    const adaptiveHighRequested = requested.adaptiveHigh === '1';
    const adaptiveHighInteractionExpected =
        adaptiveHighRequested &&
        (requested.motion === 'pan-zoom-rotate' ||
            requested.motion === 'pan-zoom-rotate-then-idle' ||
            requested.placementProfile === 'placement-drop');
    const adaptiveHighRecoveryExpected =
        adaptiveHighRequested &&
        requested.motion === 'pan-zoom-rotate-then-idle';
    const adaptiveHighProfileControlExpected =
        adaptiveHighRequested && requested.profileControl === true;
    const adaptiveHighDprCap = adaptiveHighRequested
        ? (sample.adaptiveHighDprCapAtEnd ?? runtime?.adaptiveHighDprCap)
        : null;
    const operationVisualsRequested = requested.operationVisuals === '1';
    const expectedGeneratedPlantFieldCount = operationVisualsRequested
        ? highTargetOperationVisualExpectedGeneratedPlantFieldCount
        : highTargetExpectedGeneratedPlantFieldCount;
    const expectedGeneratedPlantInstanceCount = operationVisualsRequested
        ? highTargetOperationVisualExpectedGeneratedPlantInstanceCount
        : highTargetExpectedGeneratedPlantInstanceCount;
    const operationVisualRenderedObjectCount =
        typeof runtime?.raisedBedFieldVisualObjectCount === 'number' &&
        typeof runtime?.raisedBedMulchObjectCount === 'number'
            ? runtime.raisedBedFieldVisualObjectCount +
              runtime.raisedBedMulchObjectCount +
              highTargetOperationVisualHighlightObjectCount
            : null;
    const effectiveDpr = adaptiveHighRequested
        ? (sample.effectiveDprAtEnd ?? adaptiveHighDprCap)
        : sample.reportedDpr;
    const minimumRenderedFrames = Math.max(
        1,
        Math.floor((sample.elapsedMs ?? 0) / 1_000),
    );
    const expectedActorGroundingShadowCount =
        requested.mode === 'details' ? 5 : 4;
    const checks = [
        exact('highTargetQualityRequest', requested.quality, 'high'),
        exact('highTargetQualityTier', runtime?.qualityTier, 'high'),
        exact('highTargetShadowsEnabled', runtime?.shadowsEnabled, true),
        exact('highTargetShadowMapSize', runtime?.shadowMapSize, 4_096),
        exact(
            'highTargetGroundDecorationDensity',
            runtime?.groundDecorationDensity,
            1,
        ),
        exact(
            'highTargetGroundDecorationCount',
            runtime?.groundDecorationCount,
            requested.mode === 'snow' ? 0 : 596,
        ),
        requested.mode === 'snow'
            ? exact(
                  'highTargetGroundDecorationVisibleCount',
                  runtime?.groundDecorationVisibleCount,
                  null,
              )
            : minimum(
                  'highTargetGroundDecorationVisibleCount',
                  runtime?.groundDecorationVisibleCount,
                  500,
              ),
        exact('highTargetGeometryMerging', requested.blockGeometryMerging, '1'),
        exact('highTargetCanvasClientWidth', sample.canvas?.clientWidth, 1280),
        exact('highTargetCanvasClientHeight', sample.canvas?.clientHeight, 720),
        ...(adaptiveHighRequested
            ? [
                  range('highTargetEffectiveDpr', effectiveDpr, 1.5, 2),
                  range(
                      'highTargetMinimumEffectiveDpr',
                      sample.effectiveDprMin,
                      1.5,
                      2,
                  ),
                  range('highTargetAdaptiveDprCap', adaptiveHighDprCap, 1.5, 2),
                  canvasMatchesDpr(
                      'highTargetAdaptiveCanvasWidth',
                      sample.canvas?.width,
                      sample.canvas?.clientWidth,
                      adaptiveHighDprCap,
                  ),
                  canvasMatchesDpr(
                      'highTargetAdaptiveCanvasHeight',
                      sample.canvas?.height,
                      sample.canvas?.clientHeight,
                      adaptiveHighDprCap,
                  ),
              ]
            : [
                  exact('highTargetReportedDpr', sample.reportedDpr, 2),
                  exact('highTargetCanvasWidth', sample.canvas?.width, 2560),
                  exact('highTargetCanvasHeight', sample.canvas?.height, 1440),
              ]),
        exact(
            'highTargetGeneratedPlantFields',
            runtime?.generatedPlantFieldCount,
            expectedGeneratedPlantFieldCount,
        ),
        exact(
            'highTargetExpectedGeneratedPlantInstances',
            runtime?.generatedPlantExpectedInstanceCount,
            expectedGeneratedPlantInstanceCount,
        ),
        exact(
            'highTargetGeneratedPlantInstances',
            runtime?.generatedPlantInstanceCount,
            runtime?.generatedPlantExpectedInstanceCount,
        ),
        exact(
            'highTargetVisiblePlantFields',
            runtime?.generatedPlantVisibleFieldCount,
            expectedGeneratedPlantFieldCount,
        ),
        exact(
            'highTargetVisiblePlantInstances',
            runtime?.generatedPlantVisibleInstanceCount,
            expectedGeneratedPlantInstanceCount,
        ),
        exact(
            'highTargetActorGroundingShadowCount',
            runtime?.actorGroundingShadowCount,
            expectedActorGroundingShadowCount,
        ),
        exact(
            'highTargetActorGroundingShadowBatchCount',
            runtime?.actorGroundingShadowBatchCount,
            1,
        ),
        exact(
            'highTargetActorGroundingShadowDroppedCount',
            runtime?.actorGroundingShadowDroppedCount,
            0,
        ),
        exact(
            'highTargetActorGroundingShadowPrimaryCasters',
            runtime?.actorGroundingShadowPrimaryCasterCount,
            0,
        ),
        minimum(
            'highTargetActorGroundingShadowVisibleCount',
            runtime?.actorGroundingShadowVisibleCount,
            4,
        ),
        minimum(
            'highTargetActorGroundingShadowUpdates',
            sample.actorGroundingShadowUpdateCountDelta,
            1,
        ),
        exact(
            'highTargetAnimatedCasterShadowRefreshes',
            runtime?.animatedCasterShadowRefreshCount,
            0,
        ),
        exact(
            'highTargetAnimatedCasterShadowRefreshesDuringSample',
            sample.animatedCasterShadowRefreshCountDelta,
            0,
        ),
        minimum('highTargetRenderedFps', sample.renderedFps, 1),
        minimum(
            'highTargetRenderedFrames',
            sample.renderedFrames,
            minimumRenderedFrames,
        ),
        minimum('highTargetDrawCalls', sample.drawCalls, 1),
        minimum('highTargetSubmittedTriangles', sample.submittedTriangles, 1),
        exact('highTargetApiErrors', apiErrors.length, 0),
        exact('highTargetPageErrors', pageErrors.length, 0),
    ];
    if (operationVisualsRequested) {
        checks.push(
            exact(
                'highTargetOperationVisualHighlightDispatched',
                runtime?.operationVisualHighlightProfileDispatched,
                true,
            ),
            exact(
                'highTargetOperationVisualHighlightGarden',
                runtime?.operationVisualHighlightProfileTargetGardenId,
                99_996,
            ),
            exact(
                'highTargetOperationVisualHighlightRaisedBed',
                runtime?.operationVisualHighlightProfileTargetRaisedBedId,
                2,
            ),
            exact(
                'highTargetOperationVisualHighlightField',
                runtime?.operationVisualHighlightProfileTargetFieldId,
                201,
            ),
            exact(
                'highTargetOperationVisualHighlightPosition',
                runtime?.operationVisualHighlightProfileTargetPositionIndex,
                0,
            ),
            range(
                'highTargetOperationVisualFieldBatches',
                runtime?.raisedBedFieldVisualBatchCount,
                1,
                16,
            ),
            range(
                'highTargetOperationVisualFieldChunks',
                runtime?.raisedBedFieldVisualChunkCount,
                1,
                3,
            ),
            exact(
                'highTargetOperationVisualFieldInstances',
                runtime?.raisedBedFieldVisualInstanceCount,
                highTargetOperationVisualExpectedFieldInstanceCount,
            ),
            range(
                'highTargetOperationVisualFieldObjects',
                runtime?.raisedBedFieldVisualObjectCount,
                1,
                highTargetOperationVisualRenderedObjectLimit,
            ),
            exact(
                'highTargetOperationVisualFieldMatrixUploads',
                runtime?.raisedBedFieldVisualMatrixUploadCount,
                runtime?.raisedBedFieldVisualBatchCount,
            ),
            exact(
                'highTargetOperationVisualFieldUploadedInstances',
                runtime?.raisedBedFieldVisualUploadedInstanceCount,
                highTargetOperationVisualExpectedFieldInstanceCount,
            ),
            range(
                'highTargetOperationVisualMulchBatches',
                runtime?.raisedBedMulchBatchCount,
                1,
                32,
            ),
            range(
                'highTargetOperationVisualMulchGroups',
                runtime?.raisedBedMulchGroupCount,
                1,
                16,
            ),
            exact(
                'highTargetOperationVisualMulchInstances',
                runtime?.raisedBedMulchInstanceCount,
                highTargetOperationVisualExpectedMulchInstanceCount,
            ),
            range(
                'highTargetOperationVisualMulchObjects',
                runtime?.raisedBedMulchObjectCount,
                1,
                highTargetOperationVisualRenderedObjectLimit,
            ),
            exact(
                'highTargetOperationVisualMulchOverlays',
                runtime?.raisedBedMulchOverlayCount,
                highTargetOperationVisualExpectedMulchInstanceCount,
            ),
            {
                ...range(
                    'highTargetOperationVisualRenderedObjects',
                    operationVisualRenderedObjectCount,
                    4,
                    highTargetOperationVisualRenderedObjectLimit,
                ),
                legacy: highTargetOperationVisualLegacyObjectCount,
            },
        );
    }
    if (adaptiveHighRequested) {
        checks.push(
            exact(
                'highTargetAdaptiveHighEnabled',
                runtime?.adaptiveHighEnabled,
                true,
            ),
            exact(
                'highTargetAdaptiveAtmosphereEnabled',
                runtime?.weatherDisabled,
                false,
            ),
        );
        if (adaptiveHighProfileControlExpected) {
            checks.push(
                exact(
                    'highTargetAdaptiveProfileControlEnabled',
                    runtime?.adaptiveHighProfileControlEnabled,
                    true,
                ),
                exact(
                    'highTargetAdaptiveProfileControlActive',
                    runtime?.adaptiveHighProfileControlActive,
                    true,
                ),
                exact(
                    'highTargetAdaptiveProfileControlStarted',
                    sample.adaptiveHighProfileControlStarted,
                    true,
                ),
                exact(
                    'highTargetAdaptiveProfileControlObserved',
                    sample.adaptiveHighProfileControlObserved,
                    true,
                ),
            );
        }
        checks.push(
            adaptiveHighRecoveryExpected
                ? range(
                      'highTargetAdaptiveRecoveryDirectionChanges',
                      runtime?.adaptiveHighOscillationCount,
                      1,
                      1,
                  )
                : exact(
                      'highTargetAdaptiveOscillations',
                      runtime?.adaptiveHighOscillationCount,
                      0,
                  ),
        );
        if (adaptiveHighInteractionExpected) {
            checks.push(
                exact(
                    'highTargetAdaptiveLocalDeclineObserved',
                    sample.adaptiveHighDeclineObserved,
                    true,
                ),
                minimum(
                    'highTargetAdaptiveTransitionsDuringSample',
                    sample.adaptiveHighTransitionCountDelta,
                    1,
                ),
                minimum(
                    'highTargetAdaptiveMaximumLevelDuringSample',
                    sample.adaptiveHighLevelMax,
                    1,
                ),
                range(
                    'highTargetAdaptiveMinimumDprCapDuringSample',
                    sample.adaptiveHighDprCapMin,
                    1.5,
                    1.75,
                ),
                exact(
                    'highTargetAdaptiveInteractionObserved',
                    sample.adaptiveHighInteractionObserved,
                    true,
                ),
            );
            if (typeof sample.adaptiveHighDeclineCountDelta === 'number') {
                checks.push(
                    minimum(
                        'highTargetAdaptiveDeclinesDuringSample',
                        sample.adaptiveHighDeclineCountDelta,
                        1,
                    ),
                );
            }
        }
        if (adaptiveHighRecoveryExpected) {
            checks.push(
                minimum(
                    'highTargetAdaptiveRecoveryTransitionsDuringSample',
                    sample.adaptiveHighTransitionCountDelta,
                    2,
                ),
                exact(
                    'highTargetAdaptiveRecoveredLevel',
                    sample.adaptiveHighLevelAtEnd,
                    0,
                ),
                exact(
                    'highTargetAdaptiveRecoveredDprCap',
                    adaptiveHighDprCap,
                    2,
                ),
                exact(
                    'highTargetAdaptiveRecoveredEffectiveDpr',
                    sample.effectiveDprAtEnd,
                    2,
                ),
            );
            if (adaptiveHighProfileControlExpected) {
                checks.push(
                    minimum(
                        'highTargetAdaptiveControlledHeadroomSamples',
                        sample.adaptiveHighProfileControlSampleCountDelta,
                        21,
                    ),
                );
            }
            if (typeof sample.adaptiveHighRecoveryCountDelta === 'number') {
                checks.push(
                    minimum(
                        'highTargetAdaptiveRecoveriesDuringSample',
                        sample.adaptiveHighRecoveryCountDelta,
                        1,
                    ),
                );
            }
        }
        if (
            requested.runtimeGpuSource === true &&
            runtime?.adaptiveHighGpuTimerSupported === true
        ) {
            checks.push(
                exact(
                    'highTargetAdaptiveRuntimeGpuSource',
                    runtime?.adaptiveHighSampleSource,
                    'gpu',
                ),
                exact(
                    'highTargetAdaptiveRuntimeGpuSourceObserved',
                    sample.adaptiveHighGpuSourceObserved,
                    true,
                ),
            );
        }
    }
    if (
        requested.scenarioName?.startsWith(
            'game-high-target-clear-idle-desktop',
        )
    ) {
        checks.push(
            minimum(
                'highTargetPrimaryShadowRefreshesBeforeSample',
                sample.primaryShadowRefreshCountAtStart,
                1,
            ),
            exact(
                'highTargetPrimaryShadowRefreshesDuringClearIdle',
                sample.primaryShadowRefreshCountDelta,
                0,
            ),
        );
    }
    if (requested.motion === 'hover-scan') {
        checks.push(
            minimum(
                'highTargetInteractionResolutions',
                runtime?.instancedInteractionResolutionCount,
                1,
            ),
            minimum(
                'highTargetInteractionResolvedTargetsDuringSample',
                sample.instancedInteractionResolvedTargetCountDelta,
                1,
            ),
        );
    }
    if (requested.outlineProfile === 'connected-raised-bed') {
        checks.push(
            exact('highTargetOutlineProfileFlag', requested.outline, '1'),
            exact(
                'highTargetOutlineRaisedBedId',
                requested.outlineRaisedBedId,
                2,
            ),
            exact(
                'highTargetOutlineProfileDispatched',
                sample.outlineProfileDispatched,
                true,
            ),
            exact(
                'highTargetOutlineTelemetryAvailable',
                sample.outlineProfileTelemetryAvailable,
                true,
            ),
        );
        if (requested.graphicsBackend === 'angle-metal') {
            const renderer = environment?.renderer ?? null;
            checks.push(
                {
                    actual: renderer,
                    comparison: 'contains',
                    limit: ['ANGLE', 'Metal'],
                    name: 'highTargetOutlineAngleMetalRenderer',
                    pass:
                        typeof renderer === 'string' &&
                        /\bANGLE\b/i.test(renderer) &&
                        /\bMetal\b/i.test(renderer),
                },
                exact(
                    'highTargetOutlineGpuTimerSupported',
                    sample.gpu?.supported,
                    true,
                ),
                exact(
                    'highTargetOutlineGpuTimerValid',
                    sample.gpu?.valid,
                    true,
                ),
                minimum(
                    'highTargetOutlineGpuTimerSamples',
                    sample.gpu?.sampleCount,
                    1,
                ),
                finiteMinimum(
                    'highTargetOutlineGpuElapsedP95Ms',
                    sample.gpu?.elapsedP95Ms,
                    0,
                ),
            );
        }
        const outlineTelemetryAvailable =
            sample.outlineProfileTelemetryAvailable === true ||
            (typeof runtime?.hoverOutlineActiveTargetCount === 'number' &&
                typeof runtime.hoverOutlineStyleGroupCount === 'number');
        if (outlineTelemetryAvailable) {
            checks.push(
                exact(
                    'highTargetOutlineActiveTargets',
                    runtime?.hoverOutlineActiveTargetCount,
                    2,
                ),
                exact(
                    'highTargetOutlineStyleGroups',
                    runtime?.hoverOutlineStyleGroupCount,
                    1,
                ),
                exact(
                    'highTargetOutlineProfileCommandAction',
                    runtime?.hoverOutlineProfileCommandAction,
                    'show',
                ),
                exact(
                    'highTargetOutlineProfileTargetBlockId',
                    runtime?.hoverOutlineProfileTargetBlockId,
                    'profile-raised-bed:2:0',
                ),
                exact(
                    'highTargetOutlineProfileTargetRaisedBedId',
                    runtime?.hoverOutlineProfileTargetRaisedBedId,
                    2,
                ),
                exact(
                    'highTargetOutlinePipeline',
                    runtime?.hoverOutlinePipeline,
                    'cropped-bounded-separable-r8',
                ),
                exact(
                    'highTargetOutlineFormat',
                    runtime?.hoverOutlineFormat,
                    'r8',
                ),
                exact(
                    'highTargetOutlineRenderTargets',
                    runtime?.hoverOutlineRenderTargetCount,
                    2,
                ),
                exact(
                    'highTargetOutlineDrawingBufferPixels',
                    runtime?.hoverOutlineDrawingBufferPixelCount,
                    2_560 * 1_440,
                ),
                minimum(
                    'highTargetOutlineCropPixels',
                    runtime?.hoverOutlineCropPixelCount,
                    1,
                ),
                minimum(
                    'highTargetOutlineAllocatedWidth',
                    runtime?.hoverOutlineAllocatedWidth,
                    1,
                ),
                minimum(
                    'highTargetOutlineAllocatedHeight',
                    runtime?.hoverOutlineAllocatedHeight,
                    1,
                ),
                range(
                    'highTargetOutlineRoiRatio',
                    runtime?.hoverOutlineRoiRatio,
                    0,
                    0.25,
                ),
                exact(
                    'highTargetOutlineCropClipping',
                    runtime?.hoverOutlineCropClippedCount,
                    0,
                ),
                exact(
                    'highTargetOutlineThickness',
                    runtime?.hoverOutlineThickness,
                    5,
                ),
                exact(
                    'highTargetOutlineKernelSamples',
                    runtime?.hoverOutlineKernelSampleCount,
                    23,
                ),
                exact(
                    'highTargetOutlineMaximumKernelSamples',
                    runtime?.hoverOutlineMaxKernelSampleCount,
                    51,
                ),
                minimum(
                    'highTargetOutlineMaskPasses',
                    runtime?.hoverOutlineMaskPassCount,
                    1,
                ),
                exact(
                    'highTargetOutlineHorizontalPassAlignment',
                    runtime?.hoverOutlineHorizontalPassCount,
                    runtime?.hoverOutlineMaskPassCount,
                ),
                exact(
                    'highTargetOutlineCompositePassAlignment',
                    runtime?.hoverOutlineCompositePassCount,
                    runtime?.hoverOutlineMaskPassCount,
                ),
                exact(
                    'highTargetOutlineAllocationBytes',
                    runtime?.hoverOutlineAllocationEstimatedBytes,
                    typeof runtime?.hoverOutlineAllocatedPixelCount === 'number'
                        ? runtime.hoverOutlineAllocatedPixelCount * 2
                        : null,
                ),
            );
        }
    }
    if (requested.placementProfile === 'placement-drop') {
        checks.push(
            exact(
                'highTargetPlacementDispatched',
                sample.placementProfileDispatched,
                true,
            ),
            minimum(
                'highTargetPlacementRebuilds',
                runtime?.placementChunkPhysicalRebuildCount,
                1,
            ),
            exact(
                'highTargetPlacementActiveAtEnd',
                runtime?.placementShadowActiveCount,
                0,
            ),
            exact(
                'highTargetPlacementProjectedAtEnd',
                runtime?.placementProjectedShadowCount,
                0,
            ),
            exact(
                'highTargetPlacementProjectedPeak',
                runtime?.placementProjectedShadowPeakCount,
                2,
            ),
            exact(
                'highTargetPlacementProjectedDrops',
                runtime?.placementProjectedShadowDroppedCount,
                0,
            ),
            minimum(
                'highTargetPlacementShadowDeferredChanges',
                sample.placementShadowDeferredChangeCountDelta,
                1,
            ),
            exact(
                'highTargetPlacementShadowFlushes',
                sample.placementShadowFlushCountDelta,
                1,
            ),
            exact(
                'highTargetPlacementPrimaryShadowRefreshes',
                sample.primaryShadowRefreshCountDelta,
                1,
            ),
        );
    }
    if (requested.mode === 'rain') {
        checks.push(
            exact(
                'highTargetFullQualityRainParticles',
                runtime?.rainParticleCount,
                2_000,
            ),
        );
    }
    if (requested.mode === 'snow') {
        checks.push(
            exact(
                'highTargetFullQualitySnowParticles',
                runtime?.snowParticleCount,
                3_500,
            ),
            exact(
                'highTargetFullQualitySnowCapacity',
                runtime?.snowParticleCapacity,
                5_000,
            ),
        );
    }
    if (
        adaptiveHighRequested &&
        (requested.mode === 'cloudy' || requested.mode === 'windy')
    ) {
        checks.push(
            exact(
                'highTargetAdaptiveFullCloudVisuals',
                runtime?.cloudVisualCount,
                requested.mode === 'windy' ? 7 : 8,
            ),
            minimum(
                'highTargetAdaptiveCloudMovementUpdates',
                sample.cloudAttenuationUpdateCountDelta,
                1,
            ),
        );
    }
    if (adaptiveHighRequested && requested.mode === 'windy') {
        checks.push(
            minimum(
                'highTargetAdaptivePlantMotionCadence',
                runtime?.adaptiveHighAmbientFps,
                20,
            ),
        );
    }

    return {
        checks,
        pass: checks.every((check) => check.pass),
    };
}

function median(values) {
    const finiteValues = values
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);
    if (finiteValues.length === 0) {
        return null;
    }
    const middle = Math.floor(finiteValues.length / 2);
    return finiteValues.length % 2 === 0
        ? (finiteValues[middle - 1] + finiteValues[middle]) / 2
        : finiteValues[middle];
}

function buildHighTargetMedians(scenarios) {
    const groups = Map.groupBy(
        scenarios.filter(
            (scenario) => scenario.requested?.gardenProfile === 'high-target',
        ),
        (scenario) => scenario.baseName ?? scenario.name,
    );
    const metric = (runs, select) => {
        const values = runs
            .map(select)
            .filter((value) => Number.isFinite(value));
        return {
            max: values.length > 0 ? round(Math.max(...values)) : null,
            median: round(median(values)),
            min: values.length > 0 ? round(Math.min(...values)) : null,
        };
    };

    return Object.fromEntries(
        Array.from(groups, ([name, runs]) => {
            const drawCallsPerFrame = metric(
                runs,
                (run) => run.sample.drawCallsPerFrame,
            );
            const drawCallsPerRenderedFrame = metric(
                runs,
                (run) => run.sample.drawCallsPerRenderedFrame,
            );
            const gpuElapsedP95Ms = metric(runs, (run) =>
                run.sample.gpu?.valid ? run.sample.gpu.elapsedP95Ms : null,
            );
            const jsHeapMb = metric(runs, (run) => run.sample.jsHeapMb);
            const longTaskCount = metric(
                runs,
                (run) => run.sample.longTaskCount,
            );
            const maxFrameMs = metric(runs, (run) => run.sample.maxFrameMs);
            const p95FrameMs = metric(runs, (run) => run.sample.p95FrameMs);
            const renderedFps = metric(runs, (run) => run.sample.renderedFps);
            const trianglesPerFrame = metric(
                runs,
                (run) => run.sample.trianglesPerFrame,
            );
            const trianglesPerRenderedFrame = metric(
                runs,
                (run) => run.sample.trianglesPerRenderedFrame,
            );
            const medianSample = {
                drawCallsPerFrame: drawCallsPerFrame.median,
                drawCallsPerRenderedFrame: drawCallsPerRenderedFrame.median,
                gpu: {
                    elapsedP95Ms: gpuElapsedP95Ms.median,
                    valid: gpuElapsedP95Ms.median !== null,
                },
                jsHeapMb: jsHeapMb.median,
                longTaskCount: longTaskCount.median,
                maxFrameMs: maxFrameMs.median,
                p95FrameMs: p95FrameMs.median,
                trianglesPerFrame: trianglesPerFrame.median,
                trianglesPerRenderedFrame: trianglesPerRenderedFrame.median,
            };
            const budgetName = runs[0]?.budgetName ?? 'gameHighTarget';
            const performanceBudget = evaluateBudget(
                medianSample,
                budgets[budgetName] ?? budgets.gameHighTarget,
            );
            const failedAcceptanceRuns = runs
                .filter((run) => run.acceptance?.pass !== true)
                .map((run) => run.name);
            const acceptancePass = failedAcceptanceRuns.length === 0;

            return [
                name,
                {
                    acceptancePass,
                    acceptedRunCount: runs.length - failedAcceptanceRuns.length,
                    budgetName,
                    comparisonPair: runs[0]?.requested?.comparisonPair ?? null,
                    comparisonRole: runs[0]?.requested?.comparisonRole ?? null,
                    drawCallsPerRenderedFrame,
                    failedAcceptanceRuns,
                    gpuElapsedP95Ms,
                    jsHeapMb,
                    longTaskCount,
                    maxFrameMs,
                    medianSample,
                    p95FrameMs,
                    pass: acceptancePass && performanceBudget.pass,
                    passedRunCount: runs.filter((run) => run.budget.pass)
                        .length,
                    performanceBudget,
                    performancePassedRunCount: runs.filter(
                        (run) => run.performanceBudget?.pass === true,
                    ).length,
                    renderedFps,
                    runCount: runs.length,
                    trianglesPerRenderedFrame,
                },
            ];
        }),
    );
}

function buildAdaptiveHighComparisons(highTargetMedians) {
    const pairedSummaries = Object.entries(highTargetMedians).filter(
        ([, summary]) =>
            typeof summary.comparisonPair === 'string' &&
            (summary.comparisonRole === 'fixed' ||
                summary.comparisonRole === 'adaptive'),
    );
    const grouped = Map.groupBy(
        pairedSummaries,
        ([, summary]) => summary.comparisonPair,
    );
    const metricComparison = (fixed, adaptive, metricName) => {
        const fixedValue = fixed[metricName]?.median ?? null;
        const adaptiveValue = adaptive[metricName]?.median ?? null;
        return {
            adaptive: adaptiveValue,
            delta:
                Number.isFinite(fixedValue) && Number.isFinite(adaptiveValue)
                    ? round(adaptiveValue - fixedValue)
                    : null,
            fixed: fixedValue,
            percentDelta:
                Number.isFinite(fixedValue) &&
                fixedValue !== 0 &&
                Number.isFinite(adaptiveValue)
                    ? round(
                          ((adaptiveValue - fixedValue) / fixedValue) * 100,
                          1,
                      )
                    : null,
        };
    };
    const passRate = (summary, passedField) =>
        summary.runCount > 0
            ? round((summary[passedField] / summary.runCount) * 100, 1)
            : null;

    return Object.fromEntries(
        Array.from(grouped, ([pairName, entries]) => {
            const fixedEntry = entries.find(
                ([, summary]) => summary.comparisonRole === 'fixed',
            );
            const adaptiveEntry = entries.find(
                ([, summary]) => summary.comparisonRole === 'adaptive',
            );
            if (!fixedEntry || !adaptiveEntry) {
                return null;
            }
            const [fixedName, fixed] = fixedEntry;
            const [adaptiveName, adaptive] = adaptiveEntry;
            const gpuElapsedP95Ms = metricComparison(
                fixed,
                adaptive,
                'gpuElapsedP95Ms',
            );
            const p95FrameMs = metricComparison(fixed, adaptive, 'p95FrameMs');
            const renderedFps = metricComparison(
                fixed,
                adaptive,
                'renderedFps',
            );
            const maximumRelativeCheck = (name, comparison, multiplier) => ({
                actual: comparison.adaptive,
                limit: Number.isFinite(comparison.fixed)
                    ? round(comparison.fixed * multiplier)
                    : null,
                name,
                pass:
                    Number.isFinite(comparison.adaptive) &&
                    Number.isFinite(comparison.fixed) &&
                    comparison.adaptive <= comparison.fixed * multiplier,
                skipped: false,
            });
            const minimumRelativeCheck = (name, comparison, multiplier) => ({
                actual: comparison.adaptive,
                limit: Number.isFinite(comparison.fixed)
                    ? round(comparison.fixed * multiplier)
                    : null,
                name,
                pass:
                    Number.isFinite(comparison.adaptive) &&
                    Number.isFinite(comparison.fixed) &&
                    comparison.adaptive >= comparison.fixed * multiplier,
                skipped: false,
            });
            const gpuTimerAvailable =
                Number.isFinite(gpuElapsedP95Ms.fixed) &&
                Number.isFinite(gpuElapsedP95Ms.adaptive);
            const relativePerformanceChecks = [
                maximumRelativeCheck('adaptiveP95Regression', p95FrameMs, 1.15),
                minimumRelativeCheck(
                    'adaptiveRenderedFpsRegression',
                    renderedFps,
                    0.9,
                ),
                gpuTimerAvailable
                    ? maximumRelativeCheck(
                          'adaptiveGpuP95Regression',
                          gpuElapsedP95Ms,
                          1.1,
                      )
                    : {
                          actual: gpuElapsedP95Ms.adaptive,
                          limit: null,
                          name: 'adaptiveGpuP95Regression',
                          pass: true,
                          skipped: true,
                      },
            ];
            const relativePerformancePass = relativePerformanceChecks.every(
                (check) => check.pass,
            );

            return [
                pairName,
                {
                    acceptancePassRate: {
                        adaptive: passRate(adaptive, 'acceptedRunCount'),
                        fixed: passRate(fixed, 'acceptedRunCount'),
                    },
                    adaptiveName,
                    aggregatePass: {
                        adaptive: adaptive.pass && relativePerformancePass,
                        fixed: fixed.pass,
                    },
                    fixedName,
                    gpuElapsedP95Ms,
                    p95FrameMs,
                    performancePassRate: {
                        adaptive: passRate(
                            adaptive,
                            'performancePassedRunCount',
                        ),
                        fixed: passRate(fixed, 'performancePassedRunCount'),
                    },
                    relativePerformanceChecks,
                    relativePerformancePass,
                    renderedFps,
                },
            ];
        }).filter(Boolean),
    );
}

function buildProfileSummary(scenarios, highTargetMedians) {
    const nonHighTargetScenarios = scenarios.filter(
        (scenario) => scenario.requested?.gardenProfile !== 'high-target',
    );
    const highTargetResults = Object.entries(highTargetMedians);
    const comparativeFailureNames = Object.values(
        buildAdaptiveHighComparisons(highTargetMedians),
    )
        .filter((comparison) => !comparison.relativePerformancePass)
        .map((comparison) => comparison.adaptiveName);
    const failedScenarioNames = [
        ...new Set([
            ...nonHighTargetScenarios
                .filter((scenario) => !scenario.budget.pass)
                .map((scenario) => scenario.name),
            ...highTargetResults
                .filter(([, result]) => !result.pass)
                .map(([name]) => name),
            ...comparativeFailureNames,
        ]),
    ];
    const totalScenarios =
        nonHighTargetScenarios.length + highTargetResults.length;
    const failedRuns = scenarios.filter(
        (scenario) => !scenario.budget.pass,
    ).length;

    return {
        failedScenarioNames,
        failedScenarios: failedScenarioNames.length,
        failedRuns,
        passedRuns: scenarios.length - failedRuns,
        passedScenarios: totalScenarios - failedScenarioNames.length,
        totalRuns: scenarios.length,
        totalScenarios,
    };
}

function buildPlantPipelineMedians(runs, phase) {
    const profile = (run) =>
        run.closeup[phase].steady?.profile ??
        run.closeup[phase].profile ??
        undefined;
    const pipeline = (run) => profile(run)?.pipeline;
    const packedWorker = (run) => {
        const value = pipeline(run)?.packedWorker;
        return value?.observed ? value : undefined;
    };
    const scheduler = (run) => {
        const value = pipeline(run)?.scheduler;
        return value?.observed ? value : undefined;
    };
    const templateCache = (run) => {
        const value = pipeline(run)?.templateCache;
        return value?.observed ? value : undefined;
    };
    const shaderPrewarm = (run) => {
        const value = pipeline(run)?.shaderPrewarm;
        return value?.observed ? value : undefined;
    };
    const shaderPrewarmStatusCounts = Object.fromEntries(
        Array.from(
            Map.groupBy(
                runs.map((run) => shaderPrewarm(run)?.status).filter(Boolean),
                (status) => status,
            ),
            ([status, values]) => [status, values.length],
        ),
    );

    return {
        packedBuildCount: round(
            median(runs.map((run) => packedWorker(run)?.buildCount)),
        ),
        packedBuildDurationMaxMs: round(
            median(runs.map((run) => packedWorker(run)?.buildDurationMaxMs)),
        ),
        packedBuildDurationTotalMs: round(
            median(runs.map((run) => packedWorker(run)?.buildDurationTotalMs)),
        ),
        packedPackingDurationMaxMs: round(
            median(runs.map((run) => packedWorker(run)?.packingDurationMaxMs)),
        ),
        packedPackingDurationTotalMs: round(
            median(
                runs.map((run) => packedWorker(run)?.packingDurationTotalMs),
            ),
        ),
        packedRenderDataBuildDurationMaxMs: round(
            median(
                runs.map(
                    (run) => packedWorker(run)?.renderDataBuildDurationMaxMs,
                ),
            ),
        ),
        packedRenderDataBuildDurationTotalMs: round(
            median(
                runs.map(
                    (run) => packedWorker(run)?.renderDataBuildDurationTotalMs,
                ),
            ),
        ),
        packedRootBatchingDurationMaxMs: round(
            median(
                runs.map((run) => packedWorker(run)?.rootBatchingDurationMaxMs),
            ),
        ),
        packedRootBatchingDurationTotalMs: round(
            median(
                runs.map(
                    (run) => packedWorker(run)?.rootBatchingDurationTotalMs,
                ),
            ),
        ),
        packedSymbolGenerationDurationMaxMs: round(
            median(
                runs.map(
                    (run) => packedWorker(run)?.symbolGenerationDurationMaxMs,
                ),
            ),
        ),
        packedSymbolGenerationDurationTotalMs: round(
            median(
                runs.map(
                    (run) => packedWorker(run)?.symbolGenerationDurationTotalMs,
                ),
            ),
        ),
        packedTotalDurationMaxMs: round(
            median(runs.map((run) => packedWorker(run)?.totalDurationMaxMs)),
        ),
        packedTotalDurationTotalMs: round(
            median(runs.map((run) => packedWorker(run)?.totalDurationTotalMs)),
        ),
        packedTransferByteLengthMax: round(
            median(runs.map((run) => packedWorker(run)?.transferByteLengthMax)),
        ),
        packedTransferByteLengthTotal: round(
            median(
                runs.map((run) => packedWorker(run)?.transferByteLengthTotal),
            ),
        ),
        packedTransferCount: round(
            median(runs.map((run) => packedWorker(run)?.transferCount)),
        ),
        schedulerCancelledSubscriberCount: round(
            median(runs.map((run) => scheduler(run)?.cancelledSubscriberCount)),
        ),
        schedulerDeduplicatedSubscriberCount: round(
            median(
                runs.map((run) => scheduler(run)?.deduplicatedSubscriberCount),
            ),
        ),
        schedulerPeakQueuedTaskCount: round(
            median(runs.map((run) => scheduler(run)?.peakQueuedTaskCount)),
        ),
        schedulerStaleResultCount: round(
            median(runs.map((run) => scheduler(run)?.staleResultCount)),
        ),
        shaderPrewarmDurationMs: round(
            median(runs.map((run) => shaderPrewarm(run)?.durationMs)),
        ),
        shaderPrewarmDeduplicatedRunCount: runs.filter(
            (run) => shaderPrewarm(run)?.deduplicated === true,
        ).length,
        shaderPrewarmObservedRunCount: runs.filter((run) =>
            Boolean(shaderPrewarm(run)),
        ).length,
        shaderPrewarmPostSwapCompilationCount: round(
            median(
                runs.map((run) => shaderPrewarm(run)?.postSwapCompilationCount),
            ),
        ),
        shaderPrewarmPostSwapProgramCount: round(
            median(runs.map((run) => shaderPrewarm(run)?.postSwapProgramCount)),
        ),
        shaderPrewarmReadyAtFirstDetailSwapRunCount: runs.filter(
            (run) => shaderPrewarm(run)?.readyAtFirstDetailSwap === true,
        ).length,
        shaderPrewarmProgramCountAfter: round(
            median(runs.map((run) => shaderPrewarm(run)?.programCountAfter)),
        ),
        shaderPrewarmProgramCountBefore: round(
            median(runs.map((run) => shaderPrewarm(run)?.programCountBefore)),
        ),
        shaderPrewarmStatusCounts,
        templateCacheEstimatedBytes: round(
            median(runs.map((run) => templateCache(run)?.estimatedBytes)),
        ),
        templateCacheEvictionCount: round(
            median(runs.map((run) => templateCache(run)?.evictionCount)),
        ),
        templateCacheHitCount: round(
            median(runs.map((run) => templateCache(run)?.hitCount)),
        ),
        templateCacheMissCount: round(
            median(runs.map((run) => templateCache(run)?.missCount)),
        ),
    };
}

function buildPlantRenderDataMedians(runs, phase) {
    const renderData = (run) =>
        (
            run.closeup[phase].steady?.profile ??
            run.closeup[phase].profile ??
            undefined
        )?.renderData;

    return {
        activeArchetypeCount: round(
            median(runs.map((run) => renderData(run)?.activeArchetypeCount)),
        ),
        buildCount: round(
            median(runs.map((run) => renderData(run)?.buildCount)),
        ),
        buildDurationMaxMs: round(
            median(runs.map((run) => renderData(run)?.buildDurationMaxMs)),
        ),
        buildDurationTotalMs: round(
            median(runs.map((run) => renderData(run)?.buildDurationTotalMs)),
        ),
        builtPlantInstanceCount: round(
            median(runs.map((run) => renderData(run)?.builtPlantInstanceCount)),
        ),
        detailedPlantInstanceCount: round(
            median(
                runs.map((run) => renderData(run)?.detailedPlantInstanceCount),
            ),
        ),
        failedArchetypeCount: round(
            median(runs.map((run) => renderData(run)?.failedArchetypeCount)),
        ),
        maxArchetypeCountPerBatch: round(
            median(
                runs.map((run) => renderData(run)?.maxArchetypeCountPerBatch),
            ),
        ),
    };
}

function buildPlantInstanceBufferMedians(runs, phase) {
    const instanceBuffers = (run) =>
        (
            run.closeup[phase].steady?.profile ??
            run.closeup[phase].profile ??
            undefined
        )?.instanceBuffers;
    const medianField = (field) =>
        round(median(runs.map((run) => instanceBuffers(run)?.[field])));

    return {
        activeAllocatedBytes: medianField('activeAllocatedBytes'),
        activeCapacity: medianField('activeCapacity'),
        activeEmptyMeshCount: medianField('activeEmptyMeshCount'),
        activeLiveCount: medianField('activeLiveCount'),
        activeMeshCount: medianField('activeMeshCount'),
        bufferUploadCount: medianField('bufferUploadCount'),
        orphanedResourceCount: medianField('orphanedResourceCount'),
        peakAllocatedBytes: medianField('peakAllocatedBytes'),
        peakCapacity: medianField('peakCapacity'),
        releasedAllocationCount: medianField('releasedAllocationCount'),
        uploadedBytes: medianField('uploadedBytes'),
    };
}

function buildPlantLodMedians(runs, phase) {
    const lodEvaluation = (run) =>
        (
            run.closeup[phase].steady?.profile ??
            run.closeup[phase].profile ??
            undefined
        )?.lodEvaluation;

    const perUpdate = (run, key) => {
        const evaluation = lodEvaluation(run);
        const updateCount = evaluation?.updateCount;
        const value = evaluation?.[key];
        return Number.isFinite(value) &&
            Number.isFinite(updateCount) &&
            updateCount > 0
            ? value / updateCount
            : null;
    };
    const rejectionRatio = (run) => {
        const evaluation = lodEvaluation(run);
        const groupTestCount = evaluation?.groupTestCount;
        const groupRejectionCount = evaluation?.groupRejectionCount;
        return Number.isFinite(groupRejectionCount) &&
            Number.isFinite(groupTestCount) &&
            groupTestCount > 0
            ? groupRejectionCount / groupTestCount
            : null;
    };

    return {
        durationPerUpdateMs: round(
            median(runs.map((run) => perUpdate(run, 'durationTotalMs'))),
        ),
        durationMaxMs: round(
            median(runs.map((run) => lodEvaluation(run)?.durationMaxMs)),
        ),
        durationTotalMs: round(
            median(runs.map((run) => lodEvaluation(run)?.durationTotalMs)),
        ),
        fieldEvaluationCount: round(
            median(runs.map((run) => lodEvaluation(run)?.fieldEvaluationCount)),
        ),
        fieldProjectionTestCount: round(
            median(
                runs.map((run) => lodEvaluation(run)?.fieldProjectionTestCount),
            ),
        ),
        fieldProjectionTestsPerUpdate: round(
            median(
                runs.map((run) => perUpdate(run, 'fieldProjectionTestCount')),
            ),
        ),
        groupRejectionCount: round(
            median(runs.map((run) => lodEvaluation(run)?.groupRejectionCount)),
        ),
        groupRejectionRatio: round(
            median(runs.map((run) => rejectionRatio(run))),
            3,
        ),
        groupTestCount: round(
            median(runs.map((run) => lodEvaluation(run)?.groupTestCount)),
        ),
        updateCount: round(
            median(runs.map((run) => lodEvaluation(run)?.updateCount)),
        ),
    };
}

function buildPlantCloseupSampleMedians(runs, phase, sampleKind) {
    const measurement = (run) => run.closeup[phase][sampleKind];
    const sample = (run) => measurement(run)?.sample;
    const cdp = (run) => measurement(run)?.cdp;
    const instancedCallsPerRenderedFrame = (run) => {
        const value = sample(run);
        return value?.renderedFrames > 0
            ? value.instancedDrawCalls / value.renderedFrames
            : null;
    };

    return {
        cdpJsHeapMb: round(median(runs.map((run) => cdp(run)?.jsHeapMb)), 1),
        cdpLayoutDuration: round(
            median(runs.map((run) => cdp(run)?.layoutDuration)),
            4,
        ),
        cdpScriptDuration: round(
            median(runs.map((run) => cdp(run)?.scriptDuration)),
            4,
        ),
        cdpTaskDuration: round(
            median(runs.map((run) => cdp(run)?.taskDuration)),
            4,
        ),
        drawCallsPerRenderedFrame: round(
            median(runs.map((run) => sample(run)?.drawCallsPerRenderedFrame)),
            1,
        ),
        gpuElapsedMaxMs: round(
            median(runs.map((run) => sample(run)?.gpu?.elapsedMaxMs)),
        ),
        gpuElapsedP95Ms: round(
            median(runs.map((run) => sample(run)?.gpu?.elapsedP95Ms)),
        ),
        gpuSupportedRunCount: runs.filter(
            (run) => sample(run)?.gpu?.supported === true,
        ).length,
        instancedCallsPerRenderedFrame: round(
            median(runs.map(instancedCallsPerRenderedFrame)),
            1,
        ),
        jsHeapMb: round(median(runs.map((run) => sample(run)?.jsHeapMb)), 1),
        longTaskCount: round(
            median(runs.map((run) => sample(run)?.longTaskCount)),
        ),
        longTaskTotalMs: round(
            median(runs.map((run) => sample(run)?.longTaskTotalMs)),
        ),
        maxFrameMs: round(median(runs.map((run) => sample(run)?.maxFrameMs))),
        p95FrameMs: round(median(runs.map((run) => sample(run)?.p95FrameMs))),
        renderedFps: round(
            median(runs.map((run) => sample(run)?.renderedFps)),
            1,
        ),
        trianglesPerRenderedFrame: round(
            median(runs.map((run) => sample(run)?.trianglesPerRenderedFrame)),
        ),
    };
}

const plantCloseupMaximumArchetypesPerBatch = 12;

function buildPlantCloseupAcceptance(runs) {
    const measurements = runs.flatMap((run) =>
        ['cold', 'warm'].map((phase) => ({
            measurement: run.closeup[phase],
            phase,
            profile:
                run.closeup[phase].steady?.profile ??
                run.closeup[phase].profile ??
                null,
        })),
    );
    const count = (predicate) =>
        measurements.filter(({ measurement, phase, profile }) =>
            predicate({ measurement, phase, profile }),
        ).length;
    const medianProfileField = (select) =>
        round(median(measurements.map(({ profile }) => select(profile))));
    const projectionReductionRatio = ({ profile }) => {
        const updateCount = profile?.lodEvaluation?.updateCount;
        const projected = profile?.lodEvaluation?.fieldProjectionTestCount;
        const totalFields =
            (profile?.selected?.totalFields ?? 0) +
            (profile?.nonSelected?.totalFields ?? 0);
        const unculledProjectionCount = totalFields * (updateCount ?? 0);
        return Number.isFinite(projected) && unculledProjectionCount > 0
            ? 1 - projected / unculledProjectionCount
            : null;
    };
    const warmCacheHitRatio = ({ phase, profile }) => {
        if (phase !== 'warm') {
            return null;
        }
        const hits = profile?.pipeline?.templateCache?.hitCount;
        const misses = profile?.pipeline?.templateCache?.missCount;
        const total = (hits ?? 0) + (misses ?? 0);
        return Number.isFinite(hits) && total > 0 ? hits / total : null;
    };
    const phaseCount = measurements.length;
    const detailReadyPhaseCount = count(
        ({ measurement }) => measurement.detailOutcome === 'ready',
    );
    const selectedDetailedLodPhaseCount = count(
        ({ profile }) =>
            profile?.selected?.totalFields === 18 &&
            profile.selected.nearFields === 18 &&
            profile.selected.detailedFields === 18,
    );
    const backgroundNearZeroPhaseCount = count(
        ({ profile }) => profile?.nonSelected?.nearFields === 0,
    );
    const archetypeBoundedPhaseCount = count(
        ({ profile }) =>
            Number.isFinite(profile?.renderData?.maxArchetypeCountPerBatch) &&
            profile.renderData.maxArchetypeCountPerBatch <=
                plantCloseupMaximumArchetypesPerBatch,
    );
    const exactCapacityPhaseCount = count(
        ({ profile }) =>
            Number.isFinite(profile?.instanceBuffers?.activeLiveCount) &&
            profile.instanceBuffers.activeLiveCount > 0 &&
            profile.instanceBuffers.activeLiveCount ===
                profile.instanceBuffers.activeCapacity,
    );
    const cleanResourcePhaseCount = count(
        ({ profile }) =>
            profile?.instanceBuffers?.activeEmptyMeshCount === 0 &&
            profile.instanceBuffers.orphanedResourceCount === 0,
    );
    const shaderReadyPhaseCount = count(
        ({ profile }) =>
            profile?.pipeline?.shaderPrewarm?.readyAtFirstDetailSwap === true &&
            profile.pipeline.shaderPrewarm.postSwapCompilationCount === 0,
    );
    const workerFailureFreePhaseCount = count(
        ({ profile }) =>
            profile?.lSystem?.workerFailureCount === 0 &&
            profile.lSystem.syncFallbackTaskCount === 0,
    );
    const foliageCoveredPhaseCount = count(
        ({ profile }) => (profile?.selected?.parts?.leaves ?? 0) > 0,
    );
    const groupRejectionRatio = round(
        median(
            measurements.map(({ profile }) => {
                const rejected = profile?.lodEvaluation?.groupRejectionCount;
                const tested = profile?.lodEvaluation?.groupTestCount;
                return Number.isFinite(rejected) &&
                    Number.isFinite(tested) &&
                    tested > 0
                    ? rejected / tested
                    : null;
            }),
        ),
        3,
    );
    const projectionReduction = round(
        median(measurements.map(projectionReductionRatio)),
        3,
    );
    const warmCacheHit = round(median(measurements.map(warmCacheHitRatio)), 3);

    return {
        archetypeBoundedPhaseCount,
        backgroundNearFieldCount: medianProfileField(
            (profile) => profile?.nonSelected?.nearFields,
        ),
        backgroundNearZeroPhaseCount,
        cleanResourcePhaseCount,
        detailReadyPhaseCount,
        exactCapacityPhaseCount,
        foliageCoveredPhaseCount,
        groupRejectionRatio,
        maxArchetypeCountPerBatch: medianProfileField(
            (profile) => profile?.renderData?.maxArchetypeCountPerBatch,
        ),
        pass:
            phaseCount > 0 &&
            detailReadyPhaseCount === phaseCount &&
            selectedDetailedLodPhaseCount === phaseCount &&
            backgroundNearZeroPhaseCount === phaseCount &&
            archetypeBoundedPhaseCount === phaseCount &&
            exactCapacityPhaseCount === phaseCount &&
            cleanResourcePhaseCount === phaseCount &&
            shaderReadyPhaseCount === phaseCount &&
            workerFailureFreePhaseCount === phaseCount &&
            foliageCoveredPhaseCount === phaseCount &&
            (groupRejectionRatio ?? 0) >= 0.7 &&
            (projectionReduction ?? 0) >= 0.7 &&
            (warmCacheHit ?? 0) >= 0.9,
        phaseCount,
        projectionReductionRatio: projectionReduction,
        selectedDetailedFieldCount: medianProfileField(
            (profile) => profile?.selected?.detailedFields,
        ),
        selectedCompactLeafInstanceCount: medianProfileField(
            (profile) => profile?.selected?.parts?.compactLeafInstances,
        ),
        selectedDetailedLodPhaseCount,
        selectedLeafInstanceCount: medianProfileField(
            (profile) => profile?.selected?.parts?.leaves,
        ),
        selectedLeafTriangleCount: medianProfileField(
            (profile) => profile?.selected?.parts?.leafTriangles,
        ),
        selectedNearFieldCount: medianProfileField(
            (profile) => profile?.selected?.nearFields,
        ),
        selectedTotalFieldCount: medianProfileField(
            (profile) => profile?.selected?.totalFields,
        ),
        shaderReadyPhaseCount,
        warmTemplateCacheHitRatio: warmCacheHit,
        workerFailureFreePhaseCount,
    };
}

function buildPlantCloseupMedians(scenarios) {
    const groups = Map.groupBy(
        scenarios.filter((scenario) => scenario.closeup),
        (scenario) => scenario.baseName ?? scenario.name,
    );

    return Object.fromEntries(
        Array.from(groups, ([name, runs]) => [
            name,
            {
                acceptance: buildPlantCloseupAcceptance(runs),
                runCount: runs.length,
                cold: {
                    firstDetailChunkMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.cold.profile?.milestonesMs
                                        .firstDetailedChunk,
                            ),
                        ),
                    ),
                    detailReadyMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.cold.profile?.milestonesMs
                                        .fullyDetailed,
                            ),
                        ),
                    ),
                    longTaskTotalMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.cold.transition.sample
                                        .longTaskTotalMs,
                            ),
                        ),
                    ),
                    maxFrameMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.cold.transition.sample
                                        .maxFrameMs,
                            ),
                        ),
                    ),
                    p95FrameMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.cold.transition.sample
                                        .p95FrameMs,
                            ),
                        ),
                    ),
                    instanceBuffers: buildPlantInstanceBufferMedians(
                        runs,
                        'cold',
                    ),
                    lodEvaluation: buildPlantLodMedians(runs, 'cold'),
                    pipeline: buildPlantPipelineMedians(runs, 'cold'),
                    renderData: buildPlantRenderDataMedians(runs, 'cold'),
                    steady: buildPlantCloseupSampleMedians(
                        runs,
                        'cold',
                        'steady',
                    ),
                    transition: buildPlantCloseupSampleMedians(
                        runs,
                        'cold',
                        'transition',
                    ),
                },
                warm: {
                    firstDetailChunkMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.warm.profile?.milestonesMs
                                        .firstDetailedChunk,
                            ),
                        ),
                    ),
                    detailReadyMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.warm.profile?.milestonesMs
                                        .fullyDetailed,
                            ),
                        ),
                    ),
                    longTaskTotalMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.warm.transition.sample
                                        .longTaskTotalMs,
                            ),
                        ),
                    ),
                    maxFrameMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.warm.transition.sample
                                        .maxFrameMs,
                            ),
                        ),
                    ),
                    p95FrameMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.warm.transition.sample
                                        .p95FrameMs,
                            ),
                        ),
                    ),
                    instanceBuffers: buildPlantInstanceBufferMedians(
                        runs,
                        'warm',
                    ),
                    lodEvaluation: buildPlantLodMedians(runs, 'warm'),
                    pipeline: buildPlantPipelineMedians(runs, 'warm'),
                    renderData: buildPlantRenderDataMedians(runs, 'warm'),
                    steady: buildPlantCloseupSampleMedians(
                        runs,
                        'warm',
                        'steady',
                    ),
                    transition: buildPlantCloseupSampleMedians(
                        runs,
                        'warm',
                        'transition',
                    ),
                },
            },
        ]),
    );
}

function buildMarkdown(report) {
    const lines = [
        '# Game Scene Profile Report',
        '',
        `Generated: ${report.generatedAt}`,
        '',
        `Schema: ${report.schemaVersion}`,
        `Source commit: ${report.sourceCommit ?? 'unknown'}`,
        '',
        `Base URL: ${report.baseUrl}`,
        '',
        `Build: ${report.options.build ? 'yes' : 'no'}`,
        `Server: ${report.options.managedServer ? 'managed pnpm start' : 'external'}`,
        `Scenario set: ${report.options.scenarioSet}`,
        `Scenario filter: ${report.options.scenarios.length ? report.options.scenarios.join(', ') : 'none'}`,
        `Warmup: ${report.options.warmupMs} ms`,
        `Soak: ${report.options.soakMs} ms`,
        `Sample: ${report.options.sampleMs} ms`,
        `Browser: ${report.scenarios[0]?.environment?.userAgent ?? 'unknown'}`,
        `GPU: ${report.scenarios[0]?.environment?.vendor ?? 'unknown'} / ${report.scenarios[0]?.environment?.renderer ?? 'unknown'}`,
        '',
        `Budget status: ${report.summary.failedScenarios === 0 ? 'pass' : 'fail'}`,
        '',
        '| Scenario | Mode | Profile | Merged | Details | Controls | HUD | Debug HUD | Motion | Quality | Canvas | Shadow | Rain/Snow | Rain off | Overlays/Decor | Browser FPS | Rendered FPS | p95 | Max | Draw/frame | Draw/render | Triangles/frame | Triangles/render | Long tasks | Heap | Run diagnostic | Screenshot |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ];

    for (const scenario of report.scenarios) {
        const canvas = scenario.sample.canvas
            ? `${scenario.sample.canvas.width}x${scenario.sample.canvas.height}`
            : 'n/a';
        const quality = scenario.runtime?.qualityTier ?? 'n/a';
        const shadow = scenario.runtime
            ? scenario.runtime.shadowsEnabled
                ? `${scenario.runtime.shadowMapSize}px, ${scenario.runtime.shadowMapAutoUpdate === false ? 'cached' : 'auto'}, refreshes ${scenario.runtime.primaryShadowRefreshCount ?? 'n/a'} (${scenario.runtime.animatedCasterShadowRefreshCount ?? 'n/a'} animated), invalidations ${scenario.runtime.shadowMapInvalidationCount ?? 'n/a'}, cloud ${scenario.runtime.cloudProjectedShadowCount ?? 'n/a'} projected/${scenario.runtime.cloudRealShadowCasterCount ?? 'n/a'} real, attenuation ${scenario.runtime.cloudAttenuationMaskResolution ?? 'n/a'}px/${scenario.runtime.cloudAttenuationUpdateMs ?? 'n/a'}ms/${scenario.runtime.cloudAttenuationUpdateCount ?? 'n/a'} updates/${scenario.runtime.cloudAttenuationMaterialCount ?? 'n/a'} materials`
                : 'off'
            : 'n/a';
        const weather = scenario.runtime
            ? `${scenario.runtime.rainParticleCount ?? 0}/${scenario.runtime.snowParticleCount ?? 0}`
            : 'n/a';
        const rainUnmount =
            scenario.sample.rainUnmountMs === null
                ? 'n/a'
                : `${scenario.sample.rainUnmountMs} ms`;
        const operationVisualObjectCount =
            scenario.requested.operationVisuals === '1' &&
            typeof scenario.runtime?.raisedBedFieldVisualObjectCount ===
                'number' &&
            typeof scenario.runtime?.raisedBedMulchObjectCount === 'number'
                ? scenario.runtime.raisedBedFieldVisualObjectCount +
                  scenario.runtime.raisedBedMulchObjectCount +
                  highTargetOperationVisualHighlightObjectCount
                : null;
        const operationVisualObjectDetail =
            operationVisualObjectCount === null
                ? ''
                : `; operation objects ${operationVisualObjectCount}/${highTargetOperationVisualLegacyObjectCount} legacy`;
        const detailCounts = scenario.runtime
            ? `field visuals ${scenario.runtime.raisedBedFieldVisualInstanceCount ?? 0} instances/${scenario.runtime.raisedBedFieldVisualObjectCount ?? 0} objects/${scenario.runtime.raisedBedFieldVisualBatchCount ?? 0} batches/${scenario.runtime.raisedBedFieldVisualChunkCount ?? 0} chunks, uploads ${scenario.runtime.raisedBedFieldVisualMatrixUploadCount ?? 0}/${scenario.runtime.raisedBedFieldVisualUploadedInstanceCount ?? 0}; mulch ${scenario.runtime.raisedBedMulchInstanceCount ?? scenario.runtime.raisedBedMulchOverlayCount ?? 0} instances/${scenario.runtime.raisedBedMulchObjectCount ?? 0} objects/${scenario.runtime.raisedBedMulchBatchCount ?? 0} batches/${scenario.runtime.raisedBedMulchGroupCount ?? 0} groups${operationVisualObjectDetail}; snow/decor ${scenario.runtime.instancedSnowOverlayCount ?? 0}+${scenario.runtime.raisedBedMulchOverlayCount ?? 0}/${scenario.runtime.groundDecorationCount ?? 0}, visible ${scenario.runtime.groundDecorationVisibleCount ?? 'n/a'}, pages ${scenario.runtime.groundDecorationAtlasPageCount ?? 'n/a'}, chunks ${scenario.runtime.groundDecorationChunkCount ?? 'n/a'}, surface materials/uniforms snow ${scenario.runtime.snowOverlayMaterialConsumerCount ?? 'n/a'}/${scenario.runtime.snowOverlayDistinctUniformCount ?? 'n/a'}, rain ${scenario.runtime.rainWetOverlayMaterialConsumerCount ?? 'n/a'}/${scenario.runtime.rainWetOverlayDistinctUniformCount ?? 'n/a'}`
            : 'n/a';
        const screenshot = scenario.screenshotPath ?? 'n/a';
        lines.push(
            `| ${scenario.name} | ${scenario.requested.mode} | ${scenario.requested.gardenProfile} | ${scenario.requested.blockGeometryMerging} | ${scenario.requested.details} | ${scenario.requested.controls} | ${scenario.requested.hud} | ${scenario.requested.debugHud} | ${scenario.requested.motion} | ${quality} | ${canvas} | ${shadow} | ${weather} | ${rainUnmount} | ${detailCounts} | ${scenario.sample.fps} | ${scenario.sample.renderedFps} | ${scenario.sample.p95FrameMs} ms | ${scenario.sample.maxFrameMs} ms | ${scenario.sample.drawCallsPerFrame} | ${scenario.sample.drawCallsPerRenderedFrame} | ${scenario.sample.trianglesPerFrame} | ${scenario.sample.trianglesPerRenderedFrame} | ${scenario.sample.longTaskCount} | ${scenario.sample.jsHeapMb ?? 'n/a'} MB | ${scenario.budget.pass ? 'pass' : 'fail'} | ${screenshot} |`,
        );
    }

    const highTargetMedians = Object.entries(report.highTargetMedians ?? {});
    if (highTargetMedians.length > 0) {
        lines.push(
            '',
            '## High-target repeated-run summary',
            '',
            '| Scenario | Accepted runs | Diagnostic passing runs | Median budget | Final | p95 median [min, max] | Rendered FPS median [min, max] | Draw/render median [min, max] | Triangles/render median [min, max] | GPU p95 median [min, max] |',
            '| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |',
        );
        const formatRange = (range) =>
            `${range.median ?? 'n/a'} [${range.min ?? 'n/a'}, ${range.max ?? 'n/a'}]`;
        for (const [name, summary] of highTargetMedians) {
            lines.push(
                `| ${name} | ${summary.acceptedRunCount}/${summary.runCount} | ${summary.passedRunCount}/${summary.runCount} | ${summary.performanceBudget.pass ? 'pass' : 'fail'} | ${summary.pass ? 'pass' : 'fail'} | ${formatRange(summary.p95FrameMs)} | ${formatRange(summary.renderedFps)} | ${formatRange(summary.drawCallsPerRenderedFrame)} | ${formatRange(summary.trianglesPerRenderedFrame)} | ${formatRange(summary.gpuElapsedP95Ms)} |`,
            );
        }
    }

    const adaptiveHighComparisons = Object.entries(
        report.adaptiveHighComparisons ??
            buildAdaptiveHighComparisons(report.highTargetMedians ?? {}),
    );
    if (adaptiveHighComparisons.length > 0) {
        lines.push(
            '',
            '## Adaptive High paired comparison',
            '',
            '| Pair | Fixed / Adaptive | Acceptance pass rate | Performance pass rate | p95 fixed → adaptive | GPU p95 fixed → adaptive | Rendered FPS fixed → adaptive | Relative gate | Aggregate |',
            '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |',
        );
        const formatComparison = (comparison, suffix = '') =>
            `${comparison.fixed ?? 'n/a'} → ${comparison.adaptive ?? 'n/a'}${suffix} (${comparison.percentDelta ?? 'n/a'}%)`;
        for (const [pairName, comparison] of adaptiveHighComparisons) {
            lines.push(
                `| ${pairName} | ${comparison.fixedName} / ${comparison.adaptiveName} | ${comparison.acceptancePassRate.fixed ?? 'n/a'}% → ${comparison.acceptancePassRate.adaptive ?? 'n/a'}% | ${comparison.performancePassRate.fixed ?? 'n/a'}% → ${comparison.performancePassRate.adaptive ?? 'n/a'}% | ${formatComparison(comparison.p95FrameMs, ' ms')} | ${formatComparison(comparison.gpuElapsedP95Ms, ' ms')} | ${formatComparison(comparison.renderedFps)} | ${comparison.relativePerformancePass ? 'pass' : 'fail'} | ${comparison.aggregatePass.fixed ? 'pass' : 'fail'} → ${comparison.aggregatePass.adaptive ? 'pass' : 'fail'} |`,
            );
        }
    }

    const adaptiveHighProfiles = report.scenarios.filter(
        (scenario) => scenario.requested.adaptiveHigh === '1',
    );
    if (adaptiveHighProfiles.length > 0) {
        lines.push(
            '',
            '## Adaptive High governor evidence',
            '',
            '| Scenario | Window | Control | Level start/max/end | DPR cap start/min/end | Transitions/declines/recoveries | Interaction | Runtime source | Ambient/cloud cadence | Rain/Snow/Clouds |',
            '| --- | ---: | --- | ---: | ---: | ---: | --- | --- | ---: | ---: |',
        );
        for (const scenario of adaptiveHighProfiles) {
            const profileControl = scenario.requested.profileControl
                ? `controlled (${scenario.sample.adaptiveHighProfileControlSampleCountDelta ?? 0} synthetic samples)`
                : 'native';
            const runtimeSourceDetail = scenario.requested.profileControl
                ? 'profile control'
                : scenario.runtime?.adaptiveHighGpuTimerSupported
                  ? 'GPU timer'
                  : 'frame fallback';
            lines.push(
                `| ${scenario.name} | ${scenario.requested.sampleMs ?? report.options.sampleMs} ms | ${profileControl} | ${scenario.sample.adaptiveHighLevelAtStart ?? 'n/a'}/${scenario.sample.adaptiveHighLevelMax ?? 'n/a'}/${scenario.sample.adaptiveHighLevelAtEnd ?? 'n/a'} | ${scenario.sample.adaptiveHighDprCapAtStart ?? 'n/a'}/${scenario.sample.adaptiveHighDprCapMin ?? 'n/a'}/${scenario.sample.adaptiveHighDprCapAtEnd ?? 'n/a'} | ${scenario.sample.adaptiveHighTransitionCountDelta ?? 'n/a'}/${scenario.sample.adaptiveHighDeclineCountDelta ?? 'derived'}/${scenario.sample.adaptiveHighRecoveryCountDelta ?? 'derived'} | ${scenario.sample.adaptiveHighInteractionObserved ? 'observed' : 'idle'} | ${scenario.runtime?.adaptiveHighSampleSource ?? 'n/a'} (${runtimeSourceDetail}) | ${scenario.runtime?.adaptiveHighAmbientFps ?? 'n/a'} fps/${scenario.runtime?.adaptiveHighCloudUpdateMs ?? 'n/a'} ms | ${scenario.runtime?.rainParticleCount ?? 0}/${scenario.runtime?.snowParticleCount ?? 0}/${scenario.runtime?.cloudVisualCount ?? 0} |`,
            );
        }
    }

    lines.push('', '## High-target Aggregate Failures', '');
    const highTargetFailures = [
        ...highTargetMedians.flatMap(([name, summary]) => [
            ...(summary.acceptancePass
                ? []
                : [
                      `- ${name}: acceptance failed for ${summary.failedAcceptanceRuns.join(', ')}`,
                  ]),
            ...summary.performanceBudget.checks
                .filter((check) => !check.pass)
                .map(
                    (check) =>
                        `- ${name} median: ${check.name} ${check.actual} > ${check.limit}`,
                ),
        ]),
        ...adaptiveHighComparisons.flatMap(([pairName, comparison]) =>
            comparison.relativePerformanceChecks
                .filter((check) => !check.pass && !check.skipped)
                .map(
                    (check) =>
                        `- ${pairName} relative: ${check.name} ${check.actual} missed ${check.limit}`,
                ),
        ),
    ];
    lines.push(
        ...(highTargetFailures.length ? highTargetFailures : ['- None']),
    );

    lines.push('', '## Per-run Diagnostic Failures', '');
    const failures = report.scenarios.flatMap((scenario) =>
        scenario.budget.checks
            .filter((check) => !check.pass)
            .map((check) => {
                if (check.comparison === 'range') {
                    return `- ${scenario.name}: ${check.name} ${check.actual} outside [${check.limit.minimum}, ${check.limit.maximum}]`;
                }
                if (check.comparison === 'within-pixels') {
                    return `- ${scenario.name}: ${check.name} ${check.actual} not within 2px of ${check.limit}`;
                }
                const operator =
                    check.comparison === 'minimum'
                        ? '<'
                        : check.comparison === 'equal'
                          ? '!='
                          : '>';
                return `- ${scenario.name}: ${check.name} ${check.actual} ${operator} ${check.limit}`;
            }),
    );
    lines.push(...(failures.length ? failures : ['- None']));

    const placementProfiles = report.scenarios.filter(
        (scenario) => scenario.requested.placementProfile === 'placement-drop',
    );
    if (placementProfiles.length > 0) {
        lines.push('', '## Placement Animation Evidence', '');
        lines.push(
            '| Scenario | Command | Logical updates/touched | Physical rebuilds/transformed | Projected peak/end/dropped | Deferred/flush/primary | Rebuild p95/max | Frame p95/max | Draw/render | Triangles/render | Evidence |',
            '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
        );
        for (const scenario of placementProfiles) {
            const dispatched =
                scenario.sample.placementProfileDispatched === true;
            const logicalUpdateCount =
                scenario.runtime?.placementChunkLogicalUpdateCount;
            const logicalTouchedCount =
                scenario.runtime?.placementChunkLogicalTouchedCount;
            const physicalRebuildCount =
                scenario.runtime?.placementChunkPhysicalRebuildCount;
            const transformedInstanceCount =
                scenario.runtime
                    ?.placementChunkPhysicalTransformedInstanceCount;
            const evidenceCaptured =
                dispatched &&
                typeof logicalUpdateCount === 'number' &&
                logicalUpdateCount > 0 &&
                typeof physicalRebuildCount === 'number' &&
                physicalRebuildCount > 0;
            lines.push(
                `| ${scenario.name} | ${dispatched ? 'dispatched' : 'missing'} | ${logicalUpdateCount ?? 'n/a'}/${logicalTouchedCount ?? 'n/a'} | ${physicalRebuildCount ?? 'n/a'}/${transformedInstanceCount ?? 'n/a'} | ${scenario.runtime?.placementProjectedShadowPeakCount ?? 'n/a'}/${scenario.runtime?.placementProjectedShadowCount ?? 'n/a'}/${scenario.runtime?.placementProjectedShadowDroppedCount ?? 'n/a'} | ${scenario.sample.placementShadowDeferredChangeCountDelta ?? 'n/a'}/${scenario.sample.placementShadowFlushCountDelta ?? 'n/a'}/${scenario.sample.primaryShadowRefreshCountDelta ?? 'n/a'} | ${round(scenario.runtime?.placementChunkPhysicalRebuildDurationP95Ms) ?? 'n/a'}/${round(scenario.runtime?.placementChunkPhysicalRebuildDurationMaxMs) ?? 'n/a'} ms | ${scenario.sample.p95FrameMs}/${scenario.sample.maxFrameMs} ms | ${scenario.sample.drawCallsPerRenderedFrame} | ${scenario.sample.trianglesPerRenderedFrame} | ${evidenceCaptured ? 'captured' : 'missing'} |`,
            );
        }
    }

    if (Object.keys(report.plantCloseupMedians).length > 0) {
        lines.push('', '## Raised-bed Close-up Medians', '');
        lines.push('### Optimization acceptance gates', '');
        lines.push(
            '| Scenario | Ready phases | Selected fields total/near/detailed | Selected leaves compact/total/triangles | Background near | Group rejection | Projection avoided | Archetypes max/bounded phases | Warm cache hit | Exact/clean buffers | Shader ready/no swap compile | Worker/fallback clean | Status |',
            '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
        );
        for (const [name, summary] of Object.entries(
            report.plantCloseupMedians,
        )) {
            const acceptance = summary.acceptance;
            lines.push(
                `| ${name} | ${acceptance.detailReadyPhaseCount}/${acceptance.phaseCount} | ${acceptance.selectedTotalFieldCount ?? 'n/a'}/${acceptance.selectedNearFieldCount ?? 'n/a'}/${acceptance.selectedDetailedFieldCount ?? 'n/a'} (${acceptance.selectedDetailedLodPhaseCount}/${acceptance.phaseCount}) | ${acceptance.selectedCompactLeafInstanceCount ?? 'n/a'}/${acceptance.selectedLeafInstanceCount ?? 'n/a'}/${acceptance.selectedLeafTriangleCount ?? 'n/a'} (${acceptance.foliageCoveredPhaseCount}/${acceptance.phaseCount}) | ${acceptance.backgroundNearFieldCount ?? 'n/a'} (${acceptance.backgroundNearZeroPhaseCount}/${acceptance.phaseCount}) | ${acceptance.groupRejectionRatio ?? 'n/a'} | ${acceptance.projectionReductionRatio ?? 'n/a'} | ${acceptance.maxArchetypeCountPerBatch ?? 'n/a'} (${acceptance.archetypeBoundedPhaseCount}/${acceptance.phaseCount}) | ${acceptance.warmTemplateCacheHitRatio ?? 'n/a'} | ${acceptance.exactCapacityPhaseCount}/${acceptance.cleanResourcePhaseCount} of ${acceptance.phaseCount} | ${acceptance.shaderReadyPhaseCount}/${acceptance.phaseCount} | ${acceptance.workerFailureFreePhaseCount}/${acceptance.phaseCount} | ${acceptance.pass ? 'pass' : 'fail'} |`,
            );
        }
        lines.push('');
        lines.push(
            '| Scenario | Runs | Phase | First exact chunk | Detail ready | p95 | Max | Long-task total |',
            '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |',
        );
        for (const [name, summary] of Object.entries(
            report.plantCloseupMedians,
        )) {
            for (const phase of ['cold', 'warm']) {
                const metrics = summary[phase];
                lines.push(
                    `| ${name} | ${summary.runCount} | ${phase} | ${metrics.firstDetailChunkMs ?? 'n/a'} ms | ${metrics.detailReadyMs ?? 'n/a'} ms | ${metrics.p95FrameMs ?? 'n/a'} ms | ${metrics.maxFrameMs ?? 'n/a'} ms | ${metrics.longTaskTotalMs ?? 'n/a'} ms |`,
                );
            }
        }
        lines.push('', '### Instance-buffer allocation and uploads', '');
        lines.push(
            '| Scenario | Phase | Meshes | Live/capacity | Active/peak bytes | Empty meshes | Uploads/bytes | Released/orphaned |',
            '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
        );
        for (const [name, summary] of Object.entries(
            report.plantCloseupMedians,
        )) {
            for (const phase of ['cold', 'warm']) {
                const buffers = summary[phase].instanceBuffers;
                lines.push(
                    `| ${name} | ${phase} | ${buffers.activeMeshCount ?? 'n/a'} | ${buffers.activeLiveCount ?? 'n/a'}/${buffers.activeCapacity ?? 'n/a'} | ${buffers.activeAllocatedBytes ?? 'n/a'}/${buffers.peakAllocatedBytes ?? 'n/a'} | ${buffers.activeEmptyMeshCount ?? 'n/a'} | ${buffers.bufferUploadCount ?? 'n/a'}/${buffers.uploadedBytes ?? 'n/a'} | ${buffers.releasedAllocationCount ?? 'n/a'}/${buffers.orphanedResourceCount ?? 'n/a'} |`,
                );
            }
        }
        lines.push('', '### Transition and steady renderer work', '');
        lines.push(
            '| Scenario | Phase | Window | Rendered FPS | p95/max | Calls/render | Instanced/render | Triangles/render | Long tasks (count/total) | Heap | GPU p95/max (supported runs) | CDP script/task/layout |',
            '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        );
        for (const [name, summary] of Object.entries(
            report.plantCloseupMedians,
        )) {
            for (const phase of ['cold', 'warm']) {
                for (const windowName of ['transition', 'steady']) {
                    const metrics = summary[phase][windowName];
                    lines.push(
                        `| ${name} | ${phase} | ${windowName} | ${metrics.renderedFps ?? 'n/a'} | ${metrics.p95FrameMs ?? 'n/a'}/${metrics.maxFrameMs ?? 'n/a'} ms | ${metrics.drawCallsPerRenderedFrame ?? 'n/a'} | ${metrics.instancedCallsPerRenderedFrame ?? 'n/a'} | ${metrics.trianglesPerRenderedFrame ?? 'n/a'} | ${metrics.longTaskCount ?? 'n/a'}/${metrics.longTaskTotalMs ?? 'n/a'} ms | ${metrics.jsHeapMb ?? metrics.cdpJsHeapMb ?? 'n/a'} MB | ${metrics.gpuElapsedP95Ms ?? 'n/a'}/${metrics.gpuElapsedMaxMs ?? 'n/a'} ms (${metrics.gpuSupportedRunCount}) | ${metrics.cdpScriptDuration ?? 'n/a'}/${metrics.cdpTaskDuration ?? 'n/a'}/${metrics.cdpLayoutDuration ?? 'n/a'} s |`,
                    );
                }
            }
        }
        lines.push('', '### Pipeline counters', '');
        lines.push(
            '| Scenario | Phase | Queue peak | Cancelled | Stale | Deduplicated | Template hit/miss | Template evictions | Template bytes | Packed transfer bytes | Packed build duration |',
            '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        );
        for (const [name, summary] of Object.entries(
            report.plantCloseupMedians,
        )) {
            for (const phase of ['cold', 'warm']) {
                const pipeline = summary[phase].pipeline;
                lines.push(
                    `| ${name} | ${phase} | ${pipeline.schedulerPeakQueuedTaskCount ?? 'n/a'} | ${pipeline.schedulerCancelledSubscriberCount ?? 'n/a'} | ${pipeline.schedulerStaleResultCount ?? 'n/a'} | ${pipeline.schedulerDeduplicatedSubscriberCount ?? 'n/a'} | ${pipeline.templateCacheHitCount ?? 'n/a'}/${pipeline.templateCacheMissCount ?? 'n/a'} | ${pipeline.templateCacheEvictionCount ?? 'n/a'} | ${pipeline.templateCacheEstimatedBytes ?? 'n/a'} | ${pipeline.packedTransferByteLengthTotal ?? 'n/a'} | ${pipeline.packedBuildDurationTotalMs ?? 'n/a'} ms |`,
                );
            }
        }
        lines.push('', '### Hierarchical LOD work', '');
        lines.push(
            '| Scenario | Phase | Updates | LOD max/total/per update | Groups tested/rejected (ratio) | Fields evaluated/projected (projected per update) |',
            '| --- | --- | ---: | ---: | ---: | ---: |',
        );
        for (const [name, summary] of Object.entries(
            report.plantCloseupMedians,
        )) {
            for (const phase of ['cold', 'warm']) {
                const lod = summary[phase].lodEvaluation;
                lines.push(
                    `| ${name} | ${phase} | ${lod.updateCount ?? 'n/a'} | ${lod.durationMaxMs ?? 'n/a'}/${lod.durationTotalMs ?? 'n/a'}/${lod.durationPerUpdateMs ?? 'n/a'} ms | ${lod.groupTestCount ?? 'n/a'}/${lod.groupRejectionCount ?? 'n/a'} (${lod.groupRejectionRatio ?? 'n/a'}) | ${lod.fieldEvaluationCount ?? 'n/a'}/${lod.fieldProjectionTestCount ?? 'n/a'} (${lod.fieldProjectionTestsPerUpdate ?? 'n/a'}) |`,
                );
            }
        }
        lines.push('', '### Packed worker phase timings', '');
        lines.push(
            '| Scenario | Phase | Builds | Symbol max/total | Render-data max/total | Packing max/total | Root batching max/total | Worker max/total | Transfer count | Transfer max/total |',
            '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        );
        for (const [name, summary] of Object.entries(
            report.plantCloseupMedians,
        )) {
            for (const phase of ['cold', 'warm']) {
                const pipeline = summary[phase].pipeline;
                lines.push(
                    `| ${name} | ${phase} | ${pipeline.packedBuildCount ?? 'n/a'} | ${pipeline.packedSymbolGenerationDurationMaxMs ?? 'n/a'}/${pipeline.packedSymbolGenerationDurationTotalMs ?? 'n/a'} ms | ${pipeline.packedRenderDataBuildDurationMaxMs ?? 'n/a'}/${pipeline.packedRenderDataBuildDurationTotalMs ?? 'n/a'} ms | ${pipeline.packedPackingDurationMaxMs ?? 'n/a'}/${pipeline.packedPackingDurationTotalMs ?? 'n/a'} ms | ${pipeline.packedRootBatchingDurationMaxMs ?? 'n/a'}/${pipeline.packedRootBatchingDurationTotalMs ?? 'n/a'} ms | ${pipeline.packedTotalDurationMaxMs ?? 'n/a'}/${pipeline.packedTotalDurationTotalMs ?? 'n/a'} ms | ${pipeline.packedTransferCount ?? 'n/a'} | ${pipeline.packedTransferByteLengthMax ?? 'n/a'}/${pipeline.packedTransferByteLengthTotal ?? 'n/a'} |`,
                );
            }
        }
        lines.push('', '### Render-data and shader readiness', '');
        lines.push(
            '| Scenario | Phase | Active archetypes total/max batch | Detailed plants | Failed archetypes | Render builds | Render build max/total | Built plants | Shader status (runs) | Deduplicated runs | Ready at first detail | Prewarm duration | Programs before/after | Post-swap compilations/programs |',
            '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |',
        );
        for (const [name, summary] of Object.entries(
            report.plantCloseupMedians,
        )) {
            for (const phase of ['cold', 'warm']) {
                const metrics = summary[phase];
                const pipeline = metrics.pipeline;
                const renderData = metrics.renderData;
                const shaderStatuses =
                    Object.entries(pipeline.shaderPrewarmStatusCounts)
                        .map(([status, count]) => `${status}:${count}`)
                        .join(', ') || 'n/a';
                lines.push(
                    `| ${name} | ${phase} | ${renderData.activeArchetypeCount ?? 'n/a'}/${renderData.maxArchetypeCountPerBatch ?? 'n/a'} | ${renderData.detailedPlantInstanceCount ?? 'n/a'} | ${renderData.failedArchetypeCount ?? 'n/a'} | ${renderData.buildCount ?? 'n/a'} | ${renderData.buildDurationMaxMs ?? 'n/a'}/${renderData.buildDurationTotalMs ?? 'n/a'} ms | ${renderData.builtPlantInstanceCount ?? 'n/a'} | ${shaderStatuses} | ${pipeline.shaderPrewarmDeduplicatedRunCount ?? 'n/a'} | ${pipeline.shaderPrewarmReadyAtFirstDetailSwapRunCount ?? 'n/a'} | ${pipeline.shaderPrewarmDurationMs ?? 'n/a'} ms | ${pipeline.shaderPrewarmProgramCountBefore ?? 'n/a'}/${pipeline.shaderPrewarmProgramCountAfter ?? 'n/a'} | ${pipeline.shaderPrewarmPostSwapCompilationCount ?? 'n/a'}/${pipeline.shaderPrewarmPostSwapProgramCount ?? 'n/a'} |`,
                );
            }
        }
    }

    lines.push('', '## Console Warnings And Errors', '');
    for (const scenario of report.scenarios) {
        if (
            !scenario.apiErrors?.length &&
            !scenario.consoleMessages.length &&
            !scenario.pageErrors.length
        ) {
            continue;
        }
        lines.push(`### ${scenario.name}`, '');
        for (const error of scenario.apiErrors ?? []) {
            lines.push(`- API error: ${error.status} ${error.url}`);
        }
        for (const error of scenario.pageErrors) {
            lines.push(`- page error: ${error}`);
        }
        for (const message of scenario.consoleMessages) {
            lines.push(
                `- ${message.type}: ${message.text}${message.url ? ` (${message.url})` : ''}`,
            );
        }
        lines.push('');
    }

    return `${lines.join('\n')}\n`;
}

async function writeReports(report, outDir) {
    const stamp = report.generatedAt.replaceAll(/[:.]/g, '-');
    const json = `${JSON.stringify(report, null, 2)}\n`;
    const markdown = buildMarkdown(report);

    await mkdir(outDir, { recursive: true });
    await Promise.all([
        writeFile(resolve(outDir, `${stamp}.json`), json),
        writeFile(resolve(outDir, `${stamp}.md`), markdown),
        writeFile(resolve(outDir, 'latest.json'), json),
        writeFile(resolve(outDir, 'latest.md'), markdown),
    ]);
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp(options);
        return;
    }
    options.graphicsBackend = resolveChromiumGraphicsBackend(
        process.platform,
        options.graphicsBackend,
    );

    const profileScenarios = resolveScenarios(
        options.scenarioSet,
        options.scenarios,
    );

    if (options.startServer && (await isReachable(options.baseUrl))) {
        throw new Error(
            `${options.baseUrl} is already reachable. Stop the existing server or pass --base-url with an unused port so production profiling does not accidentally use a dev server.`,
        );
    }

    if (options.build) {
        await runPackageScript('build');
    }

    let server;
    const serverReachable = await isReachable(options.baseUrl);

    if (options.startServer) {
        if (serverReachable) {
            throw new Error(
                `${options.baseUrl} is already reachable. Stop the existing server or pass --base-url with an unused port so production profiling does not accidentally use a dev server.`,
            );
        }

        server = startServer(options.baseUrl);
        try {
            await waitForServer(options.baseUrl, 60000);
        } catch (error) {
            await server.stop();
            throw error;
        }
    } else if (!serverReachable) {
        throw new Error(
            `${options.baseUrl} is not reachable. Start garden first or pass --start-server after building the app.`,
        );
    }

    const startedAt = Date.now();
    let browser;
    try {
        browser = await chromium.launch({
            args: [
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                ...resolveChromiumGraphicsArgs(
                    process.platform,
                    options.graphicsBackend,
                ),
            ],
            headless: true,
        });
    } catch (error) {
        if (server) {
            await server.stop();
        }

        if (String(error).includes("Executable doesn't exist")) {
            throw new Error(
                'Playwright Chromium is missing. Run `pnpm exec playwright install chromium` from apps/garden.',
            );
        }
        throw error;
    }

    try {
        const scenarios = [];
        for (const scenario of profileScenarios) {
            const repeat = scenario.plantCloseup
                ? (options.closeupRepeat ?? scenario.plantCloseup.repeat)
                : (scenario.repeat ?? 1);
            for (let runIndex = 1; runIndex <= repeat; runIndex += 1) {
                const runScenario =
                    repeat === 1
                        ? scenario
                        : {
                              ...scenario,
                              name: `${scenario.name}-run-${runIndex}`,
                          };
                console.log(
                    `Profiling ${scenario.name}${repeat > 1 ? ` (${runIndex}/${repeat})` : ''}...`,
                );
                const result = await measureScenario(
                    browser,
                    options.baseUrl,
                    runScenario,
                    options,
                );
                result.baseName = scenario.name;
                result.profileRun = runIndex;
                scenarios.push(result);
            }
        }

        const highTargetMedians = buildHighTargetMedians(scenarios);
        const adaptiveHighComparisons =
            buildAdaptiveHighComparisons(highTargetMedians);
        const profileSummary = buildProfileSummary(
            scenarios,
            highTargetMedians,
        );
        const report = {
            baseUrl: options.baseUrl,
            generatedAt: new Date().toISOString(),
            schemaVersion: 2,
            sourceCommit:
                process.env.VERCEL_GIT_COMMIT_SHA ??
                process.env.GITHUB_SHA ??
                null,
            options: {
                allowLegacyOperationVisuals:
                    options.allowLegacyOperationVisuals,
                build: options.build,
                closeupRepeat: options.closeupRepeat,
                closeupTimeoutMs: options.closeupTimeoutMs,
                graphicsBackend: options.graphicsBackend,
                managedServer: options.startServer,
                sampleMs: options.sampleMs,
                scenarios: options.scenarios,
                scenarioSet: options.scenarioSet,
                soakMs: options.soakMs,
                warmupMs: options.warmupMs,
            },
            adaptiveHighComparisons,
            scenarios,
            highTargetMedians,
            plantCloseupMedians: buildPlantCloseupMedians(scenarios),
            summary: {
                durationMs: Date.now() - startedAt,
                ...profileSummary,
            },
        };

        await writeReports(report, options.outDir);

        console.log(`Wrote ${resolve(options.outDir, 'latest.md')}`);
        console.log(
            `Budget status: ${profileSummary.failedScenarios === 0 ? 'pass' : 'fail'}`,
        );

        if (profileSummary.failedScenarios > 0 && options.failOnBudget) {
            process.exitCode = 1;
        }
    } finally {
        await browser?.close();
        if (server) {
            await server.stop();
        }
    }
}

export {
    buildAdaptiveHighComparisons,
    buildHighTargetMedians,
    buildMarkdown,
    buildPlantCloseupAcceptance,
    buildPlantCloseupMedians,
    buildProfileSummary,
    drainProfileSample,
    evaluateBudget,
    evaluateHighTargetAcceptance,
    finalizeProfileSampleAtEndpoint,
    finishInteractiveProfileSample,
    getScenarioRequest,
    installBrowserMetrics,
    isOutlineProfileTelemetryReady,
    mergeProfileSampleDrain,
    normalizeRenderWork,
    parseArgs,
    resolveChromiumGraphicsArgs,
    resolveChromiumGraphicsBackend,
    resolveScenarios,
};

const invokedModuleUrl = process.argv[1]
    ? pathToFileURL(resolve(process.argv[1])).href
    : null;
if (import.meta.url === invokedModuleUrl) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
