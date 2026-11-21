// Stylesheet rules from the repo's decisions. docs/decisions/stack.md#code-rules explains them. Run with `pnpm lint`.
export default {
  plugins: ["./lint/stylelint-plugin.js"],
  rules: {
    "botsman/no-remote-css": true,
    // Colours come from the tokens package, whose generated theme.css is the only stylesheet with literal colours.
    "color-no-hex": true,
  },
};
