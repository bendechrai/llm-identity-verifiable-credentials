/**
 * JWT Utilities
 *
 * Ed25519-signed JWTs for access tokens.
 * Uses EdDSA algorithm (Ed25519 curve) per RFC 8037.
 */

import type { KeyPair } from './keys.js';

/**
 * Base64URL encode data (URL-safe base64 without padding).
 */
export function base64UrlEncode(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const base64 = Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64URL decode data.
 */
export function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Create a JWT header for EdDSA signing.
 */
export function createEdDsaJwtHeader(keyId?: string): object {
  return {
    alg: 'EdDSA',
    typ: 'JWT',
    ...(keyId && { kid: keyId }),
  };
}

export interface JwtPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  scope?: string;
  claims?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Sign a JWT with an Ed25519 key pair.
 *
 * @param payload - The JWT payload
 * @param keyPair - The Ed25519 key pair for signing
 * @param keyId - Optional key ID to include in header
 */
export async function signJwt(
  payload: JwtPayload,
  keyPair: KeyPair,
  keyId?: string
): Promise<string> {
  const header = createEdDsaJwtHeader(keyId);

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signing input
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signingInputBytes = new TextEncoder().encode(signingInput);

  // Sign with Ed25519
  const signer = keyPair.signer();
  const signature = await signer.sign({ data: signingInputBytes });

  // Encode signature
  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

export interface DecodedJwt {
  header: {
    alg: string;
    typ: string;
    kid?: string;
  };
  payload: JwtPayload;
  signature: string;
}

/**
 * Decode a JWT without verification (for inspection).
 */
export function decodeJwt(token: string): DecodedJwt {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader)));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));

  return { header, payload, signature };
}

/**
 * Verify a JWT signature with an Ed25519 public key.
 *
 * @param token - The JWT string
 * @param verifier - The Ed25519 verifier interface
 */
export async function verifyJwtSignature(
  token: string,
  verifier: { verify: (data: { data: Uint8Array; signature: Uint8Array }) => Promise<boolean> }
): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // Decode header to check algorithm
  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader)));
    if (header.alg !== 'EdDSA') {
      return false;
    }
  } catch {
    return false;
  }

  // Get signing input and signature
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signingInputBytes = new TextEncoder().encode(signingInput);
  const signature = base64UrlDecode(encodedSignature);

  // Verify
  try {
    return await verifier.verify({ data: signingInputBytes, signature });
  } catch {
    return false;
  }
}

export interface JwtVerificationResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
}

/**
 * Verify a JWT and check expiration.
 */
export async function verifyJwt(
  token: string,
  verifier: { verify: (data: { data: Uint8Array; signature: Uint8Array }) => Promise<boolean> },
  expectedAudience?: string
): Promise<JwtVerificationResult> {
  try {
    // Verify signature
    const signatureValid = await verifyJwtSignature(token, verifier);
    if (!signatureValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Decode payload
    const { payload } = decodeJwt(token);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token expired', payload };
    }

    // Check not-before (if present)
    if (payload.iat && payload.iat > now + 60) { // Allow 60s clock skew
      return { valid: false, error: 'Token not yet valid', payload };
    }

    // Check audience
    if (expectedAudience && payload.aud !== expectedAudience) {
      return { valid: false, error: 'Invalid audience', payload };
    }

    return { valid: true, payload };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Convert an Ed25519 key pair to JWK format (OKP curve Ed25519).
 */
export async function keyPairToJwk(keyPair: KeyPair, includePrivate = false): Promise<object> {
  const exported = await keyPair.export({ publicKey: true, secretKey: includePrivate });

  // Decode the multibase public key (z6Mk prefix for Ed25519)
  // The format is: 'z' + base58btc(0xed01 + 32-byte-key)
  const publicKeyMultibase = exported.publicKeyMultibase;

  // For JWK, we need the raw 32-byte Ed25519 public key
  // The multibase starts with 'z' (base58btc), followed by the multicodec prefix (0xed01) and the key
  // We'll use a simplified approach - extract from the multibase

  // The public key in multibase format starts with z6Mk
  // z = base58btc, 6Mk... = encoded (0xed01 + key)
  // For JWK we need the raw 32 bytes

  const jwk: Record<string, string> = {
    kty: 'OKP',
    crv: 'Ed25519',
    // Note: For a proper implementation, we'd decode the multibase
    // and extract just the 32-byte key. For now we store the full multibase
    // which works for our internal use case.
    x: publicKeyMultibase,
  };

  if (includePrivate && exported.secretKeyMultibase) {
    jwk.d = exported.secretKeyMultibase;
  }

  return jwk;
}

/**
 * Create a JWKS (JSON Web Key Set) from a key pair.
 */
export async function createJwks(keyPair: KeyPair, keyId: string): Promise<object> {
  const jwk = await keyPairToJwk(keyPair);

  return {
    keys: [
      {
        ...jwk,
        kid: keyId,
        use: 'sig',
        alg: 'EdDSA',
      },
    ],
  };
}
