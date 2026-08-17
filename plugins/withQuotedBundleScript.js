const { withXcodeProject } = require("expo/config-plugins");

/**
 * React Native's "Bundle React Native code and images" phase ends with a bare
 * backtick expansion:
 *
 *     `"$NODE_BINARY" --print "…react-native-xcode.sh"`
 *
 * The resulting path is unquoted, so the shell word-splits it. Any project
 * living under a directory with a space in its name (here: "Python Projects")
 * fails with `/Users/…/Python: is a directory`.
 *
 * Expo regenerates this phase on every prebuild, so the fix has to be a plugin
 * rather than an edit to the checked-in pbxproj.
 */
const BROKEN =
  "`\"$NODE_BINARY\" --print \"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\"`";

const FIXED = [
  "RN_XCODE_SCRIPT=\"$(\"$NODE_BINARY\" --print \"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\")\"",
  '/bin/sh "$RN_XCODE_SCRIPT"',
].join("\n");

module.exports = function withQuotedBundleScript(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase || {};

    let patched = 0;
    for (const key of Object.keys(phases)) {
      const phase = phases[key];
      if (!phase || typeof phase !== "object" || !phase.shellScript) continue;

      // shellScript is stored as a quoted, escaped string literal.
      const decoded = JSON.parse(phase.shellScript);
      if (!decoded.includes(BROKEN)) continue;

      phase.shellScript = JSON.stringify(decoded.replace(BROKEN, FIXED));
      patched += 1;
    }

    if (patched === 0) {
      // Upstream may have fixed the quoting; say so rather than failing silently.
      console.warn(
        "[withQuotedBundleScript] no unquoted react-native-xcode.sh invocation found — plugin may no longer be needed"
      );
    }

    return config;
  });
};
