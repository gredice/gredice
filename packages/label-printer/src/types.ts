import type { PrintDirection } from "@mmote/niimbluelib";

export type HarvestLabelData = {
	raisedBedPhysicalId: string;
	fieldIndex: number;
	plantSortName: string;
};

export type HarvestLabelPreset = {
	widthMm: number;
	heightMm: number;
	dpmm: number;
	printDirection: PrintDirection;
};

export type LabelPrinterAvailabilityReason =
	| "browser-unsupported"
	| "insecure-context"
	| "missing-browser";

export type LabelPrinterAvailability = {
	supported: boolean;
	reason?: LabelPrinterAvailabilityReason;
};

export type LabelConsumableUsage = {
	total: number;
	used: number;
	remaining: number;
};

export type LabelPrinterProgress = {
	page: number;
	pagesTotal: number;
	pagePrintProgress: number;
	pageFeedProgress: number;
};

export type LabelPrinterSnapshot = {
	availability: LabelPrinterAvailability;
	isConnecting: boolean;
	isConnected: boolean;
	isPrinting: boolean;
	deviceName?: string;
	modelName?: string;
	serial?: string;
	hardwareVersion?: string;
	softwareVersion?: string;
	batteryPercent?: number;
	paperInserted?: boolean;
	paperRfidDetected?: boolean;
	lidClosed?: boolean;
	consumableUsage?: LabelConsumableUsage;
	progress?: LabelPrinterProgress;
	lastError?: string;
	updatedAt?: Date;
};

export type LabelPrinterSnapshotListener = (
	snapshot: LabelPrinterSnapshot,
) => void;
