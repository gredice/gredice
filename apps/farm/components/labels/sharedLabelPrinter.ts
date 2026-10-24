import { GrediceLabelPrinter } from '@gredice/label-printer';

// One Bluetooth client per tab so schedule printing and debug pages share the connection.
export const sharedLabelPrinter = new GrediceLabelPrinter();
