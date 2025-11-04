// Expo dynamic config to ensure Supabase envs are wired and google-services path can come from a file env var in EAS.
// EAS Build uploads only git-tracked files; to avoid committing google-services.json, create a FILE secret
// (e.g. GOOGLE_SERVICES_JSON) and this config will use its path.
module.exports = ({ config }) => {
  const androidGoogleServicesPath =
    process.env.GOOGLE_SERVICES_JSON || // EAS FILE secret exposes a temp file path
    (config?.plugins || [])
      .find((p) => Array.isArray(p) && p[0] === '@react-native-firebase/app')?.[1]?.android
      ?.googleServicesFile ||
    './google-services.json';

  // Clone plugins and override RN Firebase app plugin config
  const plugins = (config.plugins || []).map((p) => {
    if (Array.isArray(p) && p[0] === '@react-native-firebase/app') {
      const original = p[1] || {};
      return [
        '@react-native-firebase/app',
        {
          ...original,
          android: {
            ...(original.android || {}),
            googleServicesFile: androidGoogleServicesPath,
          },
        },
      ];
    }
    return p;
  });

  return {
    ...config,
    android: {
      ...(config.android || {}),
      googleServicesFile: androidGoogleServicesPath,
    },
    plugins,
    extra: {
      ...(config.extra || {}),
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      eas: config.extra?.eas,
    },
  };
};
