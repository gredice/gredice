import { AttributeInputSchema } from "./AttributeInputSchema";

export type AttributeInputProps = {
    value: string | null | undefined;
    onChange: (value: string | null) => void;
    schema?: AttributeInputSchema | string | null;
};
