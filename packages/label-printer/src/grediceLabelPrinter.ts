import {
	BatteryChargeLevel,
	type HeartbeatData,
	ImageEncoder,
	NiimbotBluetoothClient,
	type PrinterInfo,
	type RfidInfo,
} from "@mmote/niimbluelib";
import {
	DEFAULT_HARVEST_LABEL_PRESET,
	renderHarvestLabel,
} from "./harvestLabelCanvas";
import type {
	HarvestLabelData,
	HarvestLabelPreset,
	LabelConsumableUsage,
	LabelPrinterAvailability,
	LabelPrinterSnapshot,
	LabelPrinterSnapshotListener,
} from "./types";

export const HARVEST_LABEL_PRINT_TASK_TYPE = "B1";

function cloneSnapshot(snapshot: LabelPrinterSnapshot): LabelPrinterSnapshot {
	return {
		...snapshot,
		availability: { ...snapshot.availability },
		consumableUsage: snapshot.consumableUsage
			? { ...snapshot.consumableUsage }
			: undefined,
		progress: snapshot.progress ? { ...snapshot.progress } : undefined,
		updatedAt: snapshot.updatedAt ? new Date(snapshot.updatedAt) : undefined,
	};
}

function batteryChargeLevelToPercent(level?: BatteryChargeLevel) {
	switch (level) {
		case BatteryChargeLevel.Charge0:
			return 0;
		case BatteryChargeLevel.Charge25:
			return 25;
		case BatteryChargeLevel.Charge50:
			return 50;
		case BatteryChargeLevel.Charge75:
			return 75;
		case BatteryChargeLevel.Charge100:
			return 100;
		default:
			return undefined;
	}
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return "Veza s pisačem nije uspjela.";
}

function normalizeConsumableUsage(
	info?: RfidInfo,
): LabelConsumableUsage | undefined {
	if (!info) {
		return undefined;
	}

	if (info.allPaper < 0 || info.usedPaper < 0) {
		return undefined;
	}

	return {
		total: info.allPaper,
		used: info.usedPaper,
		remaining: Math.max(info.allPaper - info.usedPaper, 0),
	};
}

export function getLabelPrinterAvailability(): LabelPrinterAvailability {
	if (typeof window === "undefined" || typeof navigator === "undefined") {
		return {
			supported: false,
			reason: "missing-browser",
		};
	}

	if (!window.isSecureContext) {
		return {
			supported: false,
			reason: "insecure-context",
		};
	}

	const bluetoothApi: unknown = Reflect.get(navigator, "bluetooth");
	const requestDevice =
		bluetoothApi && typeof bluetoothApi === "object"
			? Reflect.get(bluetoothApi, "requestDevice")
			: undefined;

	if (typeof requestDevice !== "function") {
		return {
			supported: false,
			reason: "browser-unsupported",
		};
	}

	return { supported: true };
}

export function getLabelPrinterAvailabilityMessage(
	availability: LabelPrinterAvailability,
) {
	if (availability.supported) {
		return null;
	}

	switch (availability.reason) {
		case "insecure-context":
			return "Bluetooth ispis radi samo preko sigurne HTTPS veze.";
		case "browser-unsupported":
			return "Ovaj preglednik ne podržava Web Bluetooth. Koristite Chrome ili Edge.";
		default:
			return "Bluetooth ispis je dostupan samo u pregledniku.";
	}
}

export class GrediceLabelPrinter {
	private readonly client = new NiimbotBluetoothClient();
	private readonly listeners = new Set<LabelPrinterSnapshotListener>();
	private snapshot: LabelPrinterSnapshot = {
		availability: getLabelPrinterAvailability(),
		isConnecting: false,
		isConnected: false,
		isPrinting: false,
	};

	constructor() {
		this.client.on("connect", (event) => {
			this.updateSnapshot({
				isConnecting: false,
				isConnected: true,
				deviceName: event.info.deviceName,
				lastError: undefined,
			});
		});

		this.client.on("disconnect", () => {
			this.snapshot = {
				availability: getLabelPrinterAvailability(),
				isConnecting: false,
				isConnected: false,
				isPrinting: false,
				updatedAt: new Date(),
			};
			this.emit();
		});

		this.client.on("printerinfofetched", (event) => {
			this.applyPrinterInfo(event.info);
		});

		this.client.on("heartbeat", (event) => {
			this.applyHeartbeat(event.data);
		});

		this.client.on("printprogress", (event) => {
			this.updateSnapshot({
				isPrinting: true,
				progress: {
					page: event.page,
					pagesTotal: event.pagesTotal,
					pagePrintProgress: event.pagePrintProgress,
					pageFeedProgress: event.pageFeedProgress,
				},
			});
		});
	}

	private emit() {
		const nextSnapshot = cloneSnapshot(this.snapshot);
		for (const listener of this.listeners) {
			listener(nextSnapshot);
		}
	}

	private updateSnapshot(partial: Partial<LabelPrinterSnapshot>) {
		this.snapshot = {
			...this.snapshot,
			...partial,
			updatedAt: new Date(),
		};
		this.emit();
	}

	private applyPrinterInfo(info: PrinterInfo) {
		this.updateSnapshot({
			modelName: this.client.getModelMetadata()?.model,
			serial: info.serial,
			hardwareVersion: info.hardwareVersion,
			softwareVersion: info.softwareVersion,
			batteryPercent:
				batteryChargeLevelToPercent(info.charge) ??
				this.snapshot.batteryPercent,
		});
	}

	private applyHeartbeat(data: HeartbeatData) {
		this.updateSnapshot({
			batteryPercent:
				batteryChargeLevelToPercent(data.chargeLevel) ??
				this.snapshot.batteryPercent,
			paperInserted: data.paperInserted,
			paperRfidDetected: data.paperRfidSuccess,
			lidClosed: data.lidClosed,
		});
	}

	private async readConsumableInfo() {
		try {
			return await this.client.abstraction.rfidInfo2();
		} catch {
			try {
				return await this.client.abstraction.rfidInfo();
			} catch {
				return undefined;
			}
		}
	}

	private applyConsumableInfo(info?: RfidInfo) {
		this.updateSnapshot({
			paperRfidDetected: info?.tagPresent ?? this.snapshot.paperRfidDetected,
			consumableUsage: normalizeConsumableUsage(info),
		});
	}

	subscribe(listener: LabelPrinterSnapshotListener) {
		this.listeners.add(listener);
		listener(this.getSnapshot());

		return () => {
			this.listeners.delete(listener);
		};
	}

	getSnapshot() {
		return cloneSnapshot(this.snapshot);
	}

	async connect() {
		const availability = getLabelPrinterAvailability();
		if (!availability.supported) {
			const message =
				getLabelPrinterAvailabilityMessage(availability) ??
				"Bluetooth ispis nije dostupan.";
			this.updateSnapshot({
				availability,
				lastError: message,
				isConnecting: false,
				isConnected: false,
			});
			throw new Error(message);
		}

		if (this.client.isConnected()) {
			return this.refresh();
		}

		this.updateSnapshot({
			availability,
			isConnecting: true,
			lastError: undefined,
		});

		try {
			await this.client.connect();
			return await this.refresh();
		} catch (error) {
			const message = getErrorMessage(error);
			this.updateSnapshot({
				isConnecting: false,
				isConnected: false,
				isPrinting: false,
				lastError: message,
			});
			throw new Error(message);
		}
	}

	async disconnect() {
		await this.client.disconnect();
		this.snapshot = {
			availability: getLabelPrinterAvailability(),
			isConnecting: false,
			isConnected: false,
			isPrinting: false,
			updatedAt: new Date(),
		};
		this.emit();
	}

	async refresh() {
		if (!this.client.isConnected()) {
			this.updateSnapshot({
				availability: getLabelPrinterAvailability(),
				isConnecting: false,
				isConnected: false,
				isPrinting: false,
			});
			return this.getSnapshot();
		}

		this.updateSnapshot({ lastError: undefined });

		const [printerInfoResult, heartbeatResult, consumableInfoResult] =
			await Promise.allSettled([
				this.client.fetchPrinterInfo(),
				this.client.abstraction.heartbeat(),
				this.readConsumableInfo(),
			]);

		if (printerInfoResult.status === "fulfilled") {
			this.applyPrinterInfo(printerInfoResult.value);
		}

		if (heartbeatResult.status === "fulfilled") {
			this.applyHeartbeat(heartbeatResult.value);
		}

		if (consumableInfoResult.status === "fulfilled") {
			this.applyConsumableInfo(consumableInfoResult.value);
		}

		if (
			printerInfoResult.status === "rejected" &&
			heartbeatResult.status === "rejected" &&
			consumableInfoResult.status === "rejected"
		) {
			const message = getErrorMessage(printerInfoResult.reason);
			this.updateSnapshot({ lastError: message });
			throw new Error(message);
		}

		return this.getSnapshot();
	}

	async printHarvestLabel(
		data: HarvestLabelData,
		options?: {
			quantity?: number;
			preset?: HarvestLabelPreset;
		},
	) {
		if (!this.client.isConnected()) {
			throw new Error("Najprije povežite pisač.");
		}

		if (typeof document === "undefined") {
			throw new Error("Ispis je dostupan samo u pregledniku.");
		}

		const quantity = Math.max(1, Math.round(options?.quantity ?? 1));
		const preset = options?.preset ?? DEFAULT_HARVEST_LABEL_PRESET;
		const canvas = document.createElement("canvas");
		renderHarvestLabel(canvas, data, preset);

		const encoded = ImageEncoder.encodeCanvas(canvas, preset.printDirection);
		const printTask = this.client.abstraction.newPrintTask(
			HARVEST_LABEL_PRINT_TASK_TYPE,
			{
				totalPages: quantity,
				statusPollIntervalMs: 100,
				statusTimeoutMs: 8_000,
			},
		);

		this.updateSnapshot({
			isPrinting: true,
			lastError: undefined,
			progress: {
				page: 0,
				pagesTotal: quantity,
				pagePrintProgress: 0,
				pageFeedProgress: 0,
			},
		});

		try {
			await printTask.printInit();
			await printTask.printPage(encoded, quantity);
			await printTask.waitForPageFinished();
			await printTask.waitForFinished();
			await this.refresh();
		} catch (error) {
			const message = getErrorMessage(error);
			this.updateSnapshot({
				isPrinting: false,
				lastError: message,
			});
			throw new Error(message);
		} finally {
			await printTask.printEnd().catch(() => undefined);
			this.updateSnapshot({ isPrinting: false });
		}
	}
}
