import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});
// eslint-disable-next-line import/no-anonymous-default-export
export default [...compat.extends("next/core-web-vitals", "next/typescript")];