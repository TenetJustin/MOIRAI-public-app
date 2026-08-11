import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "dist-pwa/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
