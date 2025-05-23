import { JsonSchema } from "@gredice/js/jsonSchema";
import { SelectAttributeDefinition } from "@gredice/storage";

export type AttributeInputProps = {
    attributeDefinition?: SelectAttributeDefinition;
    value: string | null | undefined;
    onChange: (value: string | null) => void;
    schema?: JsonSchema | string | null;
};
