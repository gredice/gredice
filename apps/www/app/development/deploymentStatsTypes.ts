export type DeploymentStatsPeriodMode =
    | 'rolling-30-days'
    | 'last-month'
    | 'month';

export type DeploymentStatsPeriodSelection =
    | {
          mode: 'rolling-30-days';
      }
    | {
          mode: 'last-month';
      }
    | {
          mode: 'month';
          month: string;
      };

export const DEFAULT_DEPLOYMENT_STATS_PERIOD: DeploymentStatsPeriodSelection = {
    mode: 'rolling-30-days',
};

export type DeploymentStatsTotals = {
    all: number;
    production: number;
    preview: number;
    readyProduction: number;
    erroredProduction: number;
    canceledProduction: number;
    productionAverage: number;
};

export type DeploymentDayStats = {
    date: string;
    all: number;
    production: number;
    readyProduction: number;
};

export type DeploymentStatsReadySnapshot = {
    status: 'ready';
    period: DeploymentStatsPeriodSelection;
    title: string;
    description: string;
    totals: DeploymentStatsTotals;
    days: number;
    updatedAt: string | null;
    dayRows: DeploymentDayStats[];
};

export type DeploymentStatsUnavailableSnapshot = {
    status: 'unavailable';
    period: DeploymentStatsPeriodSelection;
    title: string;
    description: string;
    reason: string;
};

export type DeploymentStatsSnapshot =
    | DeploymentStatsReadySnapshot
    | DeploymentStatsUnavailableSnapshot;
