// Metro configuration for a pnpm monorepo.
//
// Two things are non-default and both are required:
//  1. watchFolders must include the repo root, or Metro will not see changes in
//     packages/* and you get stale bundles that are maddening to debug.
//  2. pnpm's symlinked node_modules means Metro has to resolve from both the app
//     and the root store, and must not walk up past the root.
//
// The workspace packages ship raw TypeScript (no build step) — Metro transpiles
// them like app source, which is why there is no `build` task for them.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;

// Hierarchical lookup stays ENABLED. The usual monorepo advice is to disable it,
// but that assumes a hoisted node_modules where every transitive dependency is
// reachable from the two paths above. Disabling it here makes Metro fail to
// resolve packages like expo-modules-core that Expo reaches through its own
// dependency tree. `.npmrc` sets node-linker=hoisted for the same reason.

module.exports = config;
