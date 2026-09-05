const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo's prebuild writes `android:allowBackup="true"` with no backup rules,
 * which lets a cloud backup carry auth tokens and cached user data off the
 * device (Google Play rejection: insecure backup). This plugin disables
 * backup entirely and installs the two rule files the platform expects.
 *
 * The checked-in android/ project is patched by the same files, so this only
 * matters after a fresh `npx expo prebuild`.
 */

const DATA_EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="sharedpref" path="."/>
    <exclude domain="database" path="."/>
  </cloud-backup>
  <device-transfer>
    <exclude domain="sharedpref" path="."/>
    <exclude domain="database" path="."/>
  </device-transfer>
</data-extraction-rules>
`;

const FULL_BACKUP_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="sharedpref" path="."/>
  <exclude domain="database" path="."/>
</full-backup-content>
`;

function withBackupManifest(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0].$;
    application["android:allowBackup"] = "false";
    application["android:dataExtractionRules"] = "@xml/data_extraction_rules";
    application["android:fullBackupContent"] = "@xml/full_backup_content";
    return config;
  });
}

function withBackupRuleFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, "data_extraction_rules.xml"), DATA_EXTRACTION_RULES);
      fs.writeFileSync(path.join(xmlDir, "full_backup_content.xml"), FULL_BACKUP_CONTENT);
      return config;
    },
  ]);
}

module.exports = function withAndroidBackupRules(config) {
  return withBackupRuleFiles(withBackupManifest(config));
};
