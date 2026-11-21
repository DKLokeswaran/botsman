// Import rules between the repo's packages. Each rule checks where an import resolves on disk, so a relative path
// into another package breaks a rule the same way its package name does. docs/decisions/stack.md#import-rules
// explains them. Run with `pnpm lint:imports`.

// Workspace folders an import can land in. Imports of npm packages are checked only by the Pi and devDependency rules.
const WORKSPACE = "^(packages|apps|server)/";

// Allows a package to reach only its own folder and the listed workspace folders.
function onlyImports(name, comment, from, allowed) {
  return { name, comment, severity: "error", from: { path: from }, to: { path: "^(packages|apps)/", pathNot: `^(${allowed.join("|")})/` } };
}

module.exports = {
  forbidden: [
    onlyImports("protocol-imports-no-package", "protocol imports no other workspace package.", "^packages/protocol/", ["packages/protocol"]),
    onlyImports("tokens-imports-no-package", "tokens imports no other workspace package.", "^packages/tokens/", ["packages/tokens"]),
    onlyImports("client-core-imports-only-protocol", "client-core imports only protocol.", "^packages/client-core/", [
      "packages/client-core",
      "packages/protocol",
    ]),
    {
      name: "only-client-core-tests-import-server",
      comment: "Nothing outside server/ imports it, except client-core's tests, which run the client against a real server.",
      severity: "error",
      from: { pathNot: "^(server|packages/client-core/test)/" },
      to: { path: "^server/" },
    },
    onlyImports("pc-ui-imports-client-core-and-tokens", "pc-ui imports only client-core and tokens, and takes protocol types from client-core.", "^packages/pc-ui/", [
      "packages/pc-ui",
      "packages/client-core",
      "packages/tokens",
    ]),
    onlyImports("android-imports-client-core-and-tokens", "The Android app imports only client-core and tokens, never protocol or pc-ui.", "^apps/android/", [
      "apps/android",
      "packages/client-core",
      "packages/tokens",
    ]),
    onlyImports("windows-imports-only-pc-ui", "The Windows app is a thin shell that imports only pc-ui.", "^apps/windows/", ["apps/windows", "packages/pc-ui"]),
    onlyImports("web-imports-only-pc-ui", "The web dashboard is a thin shell that imports only pc-ui.", "^apps/web/", ["apps/web", "packages/pc-ui"]),
    {
      name: "no-app-imports-another-app",
      comment: "Apps never import from each other.",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/", pathNot: "^apps/$1/" },
    },
    {
      name: "only-engine-imports-pi-durable",
      comment: "Only the server's engine module imports Pi Durable. The server's tests may import it to test the engine.",
      severity: "error",
      from: { pathNot: "^server/(src/engine|test)/" },
      to: { path: "(^|/)@earendil-works/pi-durable(/|$)" },
    },
    {
      name: "pi-only-in-server-and-protocol",
      comment: "Apps never see Pi's formats, so only the server and protocol import Pi packages.",
      severity: "error",
      from: { pathNot: "^(server|packages/protocol)/" },
      to: { path: "(^|/)@earendil-works/" },
    },
    {
      name: "protocol-imports-only-pi-schema",
      comment: "protocol builds its schemas with pi-schema and imports no other Pi package.",
      severity: "error",
      from: { path: "^packages/protocol/" },
      to: { path: "(^|/)@earendil-works/", pathNot: "(^|/)@earendil-works/pi-schema(/|$)" },
    },
    {
      name: "app-code-imports-no-dev-dependency",
      comment: "Code that ships imports only its package's dependencies at run time. Tests, scripts, and type-only imports may use devDependencies, and a peerDependency kept as a devDependency for type checks counts as a dependency.",
      severity: "error",
      from: { path: WORKSPACE, pathNot: "(^|/)(test|scripts)/|\\.test\\.tsx?$|(^|/)[^/]+\\.config\\.ts$" },
      to: { dependencyTypes: ["npm-dev"], dependencyTypesNot: ["npm", "npm-peer", "npm-optional", "type-only"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^(apps/[^/]+|packages/[^/]+|server)/(node_modules|dist|\\.expo)/|^apps/android/android/|^apps/windows/src-tauri/target/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"],
      mainFields: ["module", "main", "types", "typings"],
    },
  },
};
