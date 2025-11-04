let LocalAuthenticationModule = {};

try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  LocalAuthenticationModule = require('expo-local-authentication');
} catch (err) {
  LocalAuthenticationModule = {};
}

const LocalAuthentication =
  LocalAuthenticationModule?.default && typeof LocalAuthenticationModule.default === 'object'
    ? LocalAuthenticationModule.default
    : LocalAuthenticationModule;

const hasFn = (fnName) =>
  LocalAuthentication && typeof LocalAuthentication[fnName] === 'function';

const safeCall = async (fnName, fallback) => {
  if (!hasFn(fnName)) {
    return fallback;
  }
  try {
    return await LocalAuthentication[fnName]();
  } catch (err) {
    console.warn(`localAuth.${fnName} failed`, err);
    return fallback;
  }
};

const hasHardwareAsync = () => safeCall('hasHardwareAsync', false);
const supportedAuthenticationTypesAsync = () => safeCall('supportedAuthenticationTypesAsync', []);
const isEnrolledAsync = () => safeCall('isEnrolledAsync', false);
const authenticateAsync = (options = {}) =>
  hasFn('authenticateAsync')
    ? LocalAuthentication.authenticateAsync(options).catch((err) => {
        console.warn('localAuth.authenticateAsync failed', err);
        return { success: false, error: err?.message ?? 'AUTHENTICATION_FAILED' };
      })
    : Promise.resolve({ success: false, error: 'UNAVAILABLE' });

const mapAuthTypeToLabel = (type) => {
  const AuthType = LocalAuthentication?.AuthenticationType ?? {};
  switch (type) {
    case AuthType.FINGERPRINT:
      return 'Parmak izi';
    case AuthType.FACE:
      return 'Yüz tanıma';
    case AuthType.IRIS:
      return 'İris';
    default:
      return 'Biyometrik';
  }
};

export const localAuth = {
  moduleAvailable: () => hasFn('hasHardwareAsync'),
  hasFullSupport: () =>
    hasFn('hasHardwareAsync') && hasFn('isEnrolledAsync') && hasFn('authenticateAsync'),
  hasHardwareAsync,
  supportedAuthenticationTypesAsync,
  isEnrolledAsync,
  authenticateAsync,
  mapAuthTypeToLabel,
  raw: LocalAuthentication,
};
