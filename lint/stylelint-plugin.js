// The repo's own stylelint rule: no stylesheet or font loads from another host. Fonts ship inside the apps.
import stylelint from "stylelint";

const ruleName = "botsman/no-remote-css";
const messages = stylelint.utils.ruleMessages(ruleName, { remote: "Fonts and styles ship inside the apps. Add them as a package instead." });
// An http(s) or protocol-relative address, bare or inside url().
const REMOTE = /(^|["'(\s])(https?:)?\/\//;

function rule(enabled) {
  return (root, result) => {
    if (!enabled) return;
    const report = (node) => stylelint.utils.report({ ruleName, result, node, message: messages.remote });
    root.walkAtRules("import", (atRule) => REMOTE.test(atRule.params) && report(atRule));
    root.walkDecls((decl) => /url\(/.test(decl.value) && REMOTE.test(decl.value) && report(decl));
  };
}

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
