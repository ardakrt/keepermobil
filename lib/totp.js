import CryptoJS from 'crypto-js';

/**
 * Base32 decode
 */
function base32Decode(base32) {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = [];

  for (let i = 0; i < base32.length; i++) {
    const char = base32.charAt(i).toUpperCase();
    const val = base32Chars.indexOf(char);

    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return output;
}

/**
 * Generate HMAC
 */
function hmac(algorithm, key, message) {
  const keyWordArray = CryptoJS.lib.WordArray.create(key);
  const messageWordArray = CryptoJS.lib.WordArray.create(message);

  let hmacFunction;
  switch (algorithm.toUpperCase()) {
    case 'SHA256':
      hmacFunction = CryptoJS.HmacSHA256;
      break;
    case 'SHA512':
      hmacFunction = CryptoJS.HmacSHA512;
      break;
    case 'SHA1':
    default:
      hmacFunction = CryptoJS.HmacSHA1;
      break;
  }

  const hmacResult = hmacFunction(messageWordArray, keyWordArray);
  const hmacBytes = [];

  for (let i = 0; i < hmacResult.sigBytes; i++) {
    hmacBytes.push((hmacResult.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff);
  }

  return hmacBytes;
}

/**
 * Generate TOTP code
 */
export function generateTOTP(secret, options = {}) {
  const {
    algorithm = 'SHA1',
    digits = 6,
    period = 30,
  } = options;

  try {
    // Remove spaces and padding
    const cleanSecret = secret.replace(/\s/g, '').replace(/=/g, '');

    // Decode base32 secret
    const key = base32Decode(cleanSecret);

    // Get current time counter
    const now = Math.floor(Date.now() / 1000);
    const counter = Math.floor(now / period);

    // Convert counter to 8-byte array
    const buffer = [];
    let tempCounter = counter;
    for (let i = 7; i >= 0; i--) {
      buffer[i] = tempCounter & 0xff;
      tempCounter = Math.floor(tempCounter / 256);
    }

    // Generate HMAC
    const hmacResult = hmac(algorithm, key, buffer);

    // Dynamic truncation
    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const code = (
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff)
    );

    // Generate OTP
    const otp = (code % Math.pow(10, digits)).toString();
    return otp.padStart(digits, '0');
  } catch (error) {
    console.error('TOTP generation error:', error);
    return 'ERROR';
  }
}

/**
 * Get remaining seconds until next code
 */
export function getRemainingSeconds(period = 30) {
  const now = Math.floor(Date.now() / 1000);
  return period - (now % period);
}

/**
 * Parse otpauth:// URI
 */
export function parseOTPAuthURI(uri) {
  try {
    if (!uri.startsWith('otpauth://')) {
      return null;
    }

    const url = new URL(uri);
    const type = url.hostname; // totp or hotp
    const path = url.pathname.substring(1);

    if (type !== 'totp') {
      return null;
    }

    // Extract issuer and account
    let issuer = '';
    let account = '';

    if (path.includes(':')) {
      [issuer, account] = path.split(':');
      issuer = decodeURIComponent(issuer);
      account = decodeURIComponent(account);
    } else {
      account = decodeURIComponent(path);
    }

    // Get parameters
    const secret = url.searchParams.get('secret');
    const algorithmParam = url.searchParams.get('algorithm') || 'SHA1';
    const digitsParam = url.searchParams.get('digits') || '6';
    const periodParam = url.searchParams.get('period') || '30';
    const issuerParam = url.searchParams.get('issuer');

    if (issuerParam && !issuer) {
      issuer = decodeURIComponent(issuerParam);
    }

    if (!secret) {
      return null;
    }

    return {
      type,
      issuer,
      account,
      secret,
      algorithm: algorithmParam.toUpperCase(),
      digits: parseInt(digitsParam, 10),
      period: parseInt(periodParam, 10),
    };
  } catch (error) {
    console.error('URI parsing error:', error);
    return null;
  }
}

/**
 * Validate Base32 secret
 */
export function isValidBase32(secret) {
  const base32Regex = /^[A-Z2-7]+=*$/;
  return base32Regex.test(secret);
}
