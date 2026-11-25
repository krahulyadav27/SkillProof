import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config({ ignores: ["**/node_modules/**", "**/dist/**", "**/drizzle/**", "**/playwright-report/**", "**/test-results/**"] }, js.configs.recommended, ...tseslint.configs.recommended, { rules: { "no-unused-vars": "off", "@typescript-eslint/no-unused-vars": "off", "@typescript-eslint/no-explicit-any": "off" } });
