/**
 * Parse Google Authenticator migration URI
 * Format: otpauth-migration://offline?data=BASE64_PROTOBUF
 */

// Simple protobuf parser for Google Auth migration
function parseProtobuf(bytes) {
  let offset = 0;
  const result = { otp_parameters: [] };

  while (offset < bytes.length) {
    const { tag, value, newOffset } = readField(bytes, offset);
    offset = newOffset;

    if (tag === 1) {
      // otp_parameters (repeated)
      result.otp_parameters.push(parseOTPParameter(value));
    }
  }

  return result;
}

function parseOTPParameter(bytes) {
  let offset = 0;
  const param = {};

  while (offset < bytes.length) {
    const { tag, value, newOffset } = readField(bytes, offset);
    offset = newOffset;

    switch (tag) {
      case 1: // secret
        param.secret = value;
        break;
      case 2: // name
        param.name = bytesToString(value);
        break;
      case 3: // issuer
        param.issuer = bytesToString(value);
        break;
      case 4: // algorithm (0=SHA1, 1=SHA256, 2=SHA512)
        param.algorithm = value[0];
        break;
      case 5: // digits (0=6, 1=8)
        param.digits = value[0];
        break;
      case 6: // type (0=HOTP, 1=TOTP)
        param.type = value[0];
        break;
    }
  }

  return param;
}

function readField(bytes, offset) {
  // Read varint for tag and wire type
  const { value: tagValue, offset: newOffset } = readVarint(bytes, offset);
  const tag = tagValue >> 3;
  const wireType = tagValue & 0x07;

  if (wireType === 2) {
    // Length-delimited
    const { value: length, offset: dataOffset } = readVarint(bytes, newOffset);
    const value = bytes.slice(dataOffset, dataOffset + length);
    return { tag, value, newOffset: dataOffset + length };
  } else if (wireType === 0) {
    // Varint
    const { value, offset: finalOffset } = readVarint(bytes, newOffset);
    return { tag, value: [value], newOffset: finalOffset };
  }

  throw new Error(`Unsupported wire type: ${wireType}`);
}

function readVarint(bytes, offset) {
  let value = 0;
  let shift = 0;
  let currentOffset = offset;

  while (currentOffset < bytes.length) {
    const byte = bytes[currentOffset++];
    value |= (byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      break;
    }

    shift += 7;
  }

  return { value, offset: currentOffset };
}

function bytesToString(bytes) {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(new Uint8Array(bytes));
}

function bytesToBase32(bytes) {
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let base32 = "";
  let bits = 0;
  let value = 0;

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      base32 += base32Chars[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    base32 += base32Chars[(value << (5 - bits)) & 31];
  }

  return base32;
}

function base64ToBytes(base64) {
  // Decode base64 string
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parse Google Authenticator migration URI
 * @param {string} uri - otpauth-migration://offline?data=...
 * @returns {Array|null} Array of OTP parameters
 */
export function parseGoogleAuthMigration(uri) {
  try {
    if (!uri.startsWith("otpauth-migration://")) {
      return null;
    }

    const url = new URL(uri);
    const data = url.searchParams.get("data");

    if (!data) {
      return null;
    }

    // Decode base64 and parse protobuf
    const bytes = base64ToBytes(data);
    const payload = parseProtobuf(bytes);

    // Convert to readable format
    return payload.otp_parameters.map((param) => {
      const algorithm = param.algorithm === 1 ? "SHA256" : param.algorithm === 2 ? "SHA512" : "SHA1";
      const digits = param.digits === 1 ? 8 : 6;

      return {
        serviceName: param.issuer || param.name || "Unknown",
        accountName: param.name || null,
        issuer: param.issuer || null,
        secret: bytesToBase32(param.secret),
        algorithm,
        digits,
        period: 30, // Google Auth uses 30s period
      };
    });
  } catch (error) {
    console.error("Google Auth migration parsing error:", error);
    return null;
  }
}
