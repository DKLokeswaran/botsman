import { builtinRules } from "eslint/use-at-your-own-risk";

// The repo's own ESLint rules. eslint.config.js decides which files each rule checks, and
// docs/decisions/stack.md#code-rules explains them.

// A rule that reports every node one of the selectors matches, with one message.
function banned(description, message, selectors) {
  return {
    meta: { type: "problem", docs: { description }, messages: { banned: message }, schema: [] },
    create: (context) => Object.fromEntries(selectors.map((selector) => [selector, (node) => context.report({ node, messageId: "banned" })])),
  };
}

// Selectors for a string, template text or JSX text that matches a pattern.
function textMatching(pattern) {
  return [`Literal[value=${pattern}]`, `TemplateElement[value.raw=${pattern}]`, `JSXText[value=${pattern}]`];
}

const FONT_HOST = String.raw`/fonts\.(googleapis|gstatic)\.com/`;
const HEX_COLOUR = String.raw`/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/`;
const APP_NAME = String.raw`/\bBotsman\b/`;

// Whether a function's only job is to call another function with its own parameters, unchanged and in order.
function passesThrough(fn) {
  const body = fn.body.type === "BlockStatement" ? onlyReturned(fn.body) : fn.body;
  if (body?.type !== "CallExpression" || !isPlainCallee(body.callee)) return false;
  if (body.arguments.length !== fn.params.length) return false;
  return fn.params.every((param, index) => param.type === "Identifier" && body.arguments[index].type === "Identifier" && body.arguments[index].name === param.name);
}

function onlyReturned(block) {
  const [statement] = block.body;
  return block.body.length === 1 && statement.type === "ReturnStatement" ? statement.argument : undefined;
}

// A call to a name or a member of a name, not to the result of another expression such as a regex literal.
function isPlainCallee(callee) {
  if (callee.type === "Identifier") return true;
  return callee.type === "MemberExpression" && (callee.object.type === "Identifier" || callee.object.type === "ThisExpression" || callee.object.type === "MemberExpression");
}

// Named functions and methods only: an inline callback that forwards its arguments is ordinary.
function isNamed(fn) {
  return fn.type === "FunctionDeclaration" || ["VariableDeclarator", "MethodDefinition", "PropertyDefinition"].includes(fn.parent?.type);
}

const noOneLineWrapper = {
  meta: {
    type: "suggestion",
    docs: { description: "Flags a named function that only passes its parameters on to another function." },
    messages: { wrapper: "This function only calls another with the same arguments. Call that function directly unless the name adds meaning." },
    schema: [],
  },
  create(context) {
    const check = (fn) => {
      if (isNamed(fn) && passesThrough(fn)) context.report({ node: fn, messageId: "wrapper" });
    };
    return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check };
  },
};

export default {
  meta: { name: "botsman" },
  rules: {
    "no-raw-html": banned("Bans raw HTML in rendered content.", "Replies render Markdown with no raw HTML.", [
      'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
      'ImportDeclaration[source.value="rehype-raw"]',
    ]),
    "no-font-host": banned("Bans outside font hosts.", "Fonts ship inside the apps. Add the font to the tokens package instead.", textMatching(FONT_HOST)),
    "no-hex-colour": banned("Bans hex colours outside the tokens package.", "Colours come from the tokens package.", [`Literal[value=${HEX_COLOUR}]`]),
    "no-app-name-text": banned("Bans the app's name written out in screens.", "Take the app's name from APP_NAME, so a preview build says Botsman Preview.", textMatching(APP_NAME)),
    "no-screen-io": banned("Bans network and storage calls in screens.", "Screens hold no logic. Reach the network and storage through client-core.", [
      'CallExpression[callee.name="fetch"]',
      'NewExpression[callee.name="WebSocket"]',
      "Identifier[name=/^(localStorage|sessionStorage|indexedDB)$/]",
      "ImportDeclaration[source.value=/^expo-(sqlite|secure-store)$/]",
    ]),
    "no-screen-client-calls": banned("Bans calls to the server's client in screens.", "Screens hold no logic. Call the server from a client-core hook.", [
      'CallExpression[callee.object.name="client"]',
      'CallExpression[callee.object.property.name="client"]',
      'CallExpression[callee.object.object.name="client"]',
      'CallExpression[callee.object.object.property.name="client"]',
    ]),
    "no-screen-array-logic": banned("Bans picking and combining data in screens.", "Screens hold no logic. Pick, sort, and combine data in client-core.", [
      "CallExpression[callee.property.name=/^(filter|find|findIndex|findLast|findLastIndex|some|every|reduce|reduceRight|sort|toSorted)$/]",
    ]),
    // ESLint's own rule under a second name, so screens have a lower limit that warns beside the one that fails.
    "screen-complexity": builtinRules.get("complexity"),
    "env-only-in-config": banned("Keeps environment reads in the server's config module.", "Read the environment only in server/src/config.ts.", [
      'MemberExpression[object.name="process"][property.name="env"]',
    ]),
    "no-one-line-wrapper": noOneLineWrapper,
  },
};
