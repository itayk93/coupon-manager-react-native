const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro's watcher picks up every dotenv file in the project root and hands the
// non-standard ones to Babel, which fails on the first unquoted API key. Only
// the files Expo itself loads (.env, .env.local, .env.<mode>) are wanted here.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /\.env\.[^/]*local$/,
  /\.supabase\.local\.env$/,
];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-screens") {
    return { type: "sourceFile", filePath: `${__dirname}/src/web/react-native-screens.js` };
  }
  if (platform === "web" && moduleName === "react-native-maps") {
    return { type: "sourceFile", filePath: `${__dirname}/src/web/react-native-maps.js` };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
