import { defineConfig } from "eslint/config";

export default defineConfig([
	{
		rules: {
			"no-unused-vars": "off",
			"no-explicit-any": "off",
      "allowObjectTypes": true,
      "no-empty-object-type": "off"
		},
	},
]);