import { Footer1 } from "@signalco/cms-components-marketing/Footer";
import { Heading1 } from "@signalco/cms-components-marketing/Heading";
import { memo } from "react";

export const sectionsComponentRegistry = {
    'Heading1': memo(Heading1),
    'Footer1': memo(Footer1)
}
