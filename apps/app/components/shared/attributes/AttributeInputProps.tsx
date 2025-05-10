import { SelectAttributeDefinition } from "@gredice/storage";
import { AttributeInputSchema } from "./AttributeInputSchema";

export type AttributeInputProps = {
    attributeDefinition: SelectAttributeDefinition;
    value: string | null | undefined;
    onChange: (value: string | null) => void;
    schema?: AttributeInputSchema | string | null;
};
