import type {
    FarmTodayData,
    FarmTodayTask,
    FarmTodayTaskAssignment,
    FarmTodayWorkState,
} from '../../app/farmTodayModel';
import type { ScheduleTaskState } from '../../app/schedule/scheduleTaskState';

export type FarmTodayDataStatus = FarmTodayData['status'];
export type FarmTodayTaskKind = FarmTodayTask['kind'];
export type FarmTodayTaskSource = 'attention' | 'next' | 'queue';

export type FarmNavigationSource =
    | 'desktop_top'
    | 'mobile_bottom'
    | 'more_page'
    | 'today_tools';

export type FarmNavigationDestination =
    | 'greenhouse'
    | 'more'
    | 'notifications'
    | 'operations'
    | 'payouts'
    | 'plants'
    | 'raised_beds'
    | 'schedule'
    | 'settings'
    | 'today';

export type FarmTodayViewedProperties = {
    data_status: FarmTodayDataStatus;
    has_next_task: boolean;
    work_state?: FarmTodayWorkState;
};

export type FarmTodayTaskOpenedProperties = {
    assignment: FarmTodayTaskAssignment;
    overdue: boolean;
    source: FarmTodayTaskSource;
    task_kind: FarmTodayTaskKind;
    task_state: ScheduleTaskState;
};

export type FarmNavigationSelectedProperties = {
    destination: FarmNavigationDestination;
    source: FarmNavigationSource;
};

export type FarmTodayFirstActionProperties =
    | {
          action_type: 'navigation';
          destination: FarmNavigationDestination;
          source: FarmNavigationSource;
      }
    | {
          action_type: 'task_opened';
          source: FarmTodayTaskSource;
          task_kind: FarmTodayTaskKind;
      };

export type FarmAnalyticsEvent =
    | {
          name: 'farm_navigation_selected';
          properties: FarmNavigationSelectedProperties;
      }
    | {
          name: 'farm_today_first_action';
          properties: FarmTodayFirstActionProperties;
      }
    | {
          name: 'farm_today_task_opened';
          properties: FarmTodayTaskOpenedProperties;
      }
    | {
          name: 'farm_today_viewed';
          properties: FarmTodayViewedProperties;
      };

export type FarmAnalyticsCapturedProperties =
    FarmAnalyticsEvent['properties'] & {
        surface: 'farm';
    };

export type FarmAnalyticsCapture = (
    eventName: FarmAnalyticsEvent['name'],
    properties: FarmAnalyticsCapturedProperties,
) => void;

const navigationDestinations = new Set<string>([
    'greenhouse',
    'more',
    'notifications',
    'operations',
    'payouts',
    'plants',
    'raised_beds',
    'schedule',
    'settings',
    'today',
]);

const navigationSources = new Set<string>([
    'desktop_top',
    'mobile_bottom',
    'more_page',
    'today_tools',
]);

const taskAssignments = new Set<string>(['mine', 'shared']);
const taskKinds = new Set<string>(['operation', 'planting']);
const taskSources = new Set<string>(['attention', 'next', 'queue']);
const taskStates = new Set<string>([
    'actionable',
    'canceled',
    'completed',
    'failed',
    'pendingVerification',
]);

export function isFarmNavigationDestination(
    value: string | undefined,
): value is FarmNavigationDestination {
    return value !== undefined && navigationDestinations.has(value);
}

export function isFarmNavigationSource(
    value: string | undefined,
): value is FarmNavigationSource {
    return value !== undefined && navigationSources.has(value);
}

export function isFarmTodayTaskAssignment(
    value: string | undefined,
): value is FarmTodayTaskAssignment {
    return value !== undefined && taskAssignments.has(value);
}

export function isFarmTodayTaskKind(
    value: string | undefined,
): value is FarmTodayTaskKind {
    return value !== undefined && taskKinds.has(value);
}

export function isFarmTodayTaskSource(
    value: string | undefined,
): value is FarmTodayTaskSource {
    return value !== undefined && taskSources.has(value);
}

export function isFarmTodayTaskState(
    value: string | undefined,
): value is ScheduleTaskState {
    return value !== undefined && taskStates.has(value);
}
