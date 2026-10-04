import type { AdaptiveHighQualityLoadSource } from './adaptiveHighQuality';

export const adaptiveHighQualityProfileControlEventName =
    'gredice:adaptive-high-profile-control';

export type AdaptiveHighQualityProfileControlCommand =
    | {
          action: 'sample';
          normalizedLoad: number;
          source: AdaptiveHighQualityLoadSource;
      }
    | {
          action: 'start';
      }
    | {
          action: 'stop';
      };

export function readAdaptiveHighQualityProfileControlCommand(
    value: unknown,
): AdaptiveHighQualityProfileControlCommand | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const action = Reflect.get(value, 'action');
    if (action === 'start' || action === 'stop') {
        return { action };
    }
    if (action !== 'sample') {
        return null;
    }

    const normalizedLoad = Reflect.get(value, 'normalizedLoad');
    const source = Reflect.get(value, 'source');
    if (
        typeof normalizedLoad !== 'number' ||
        !Number.isFinite(normalizedLoad) ||
        normalizedLoad <= 0 ||
        normalizedLoad > 10 ||
        (source !== 'frame' && source !== 'gpu')
    ) {
        return null;
    }

    return {
        action,
        normalizedLoad,
        source,
    };
}
