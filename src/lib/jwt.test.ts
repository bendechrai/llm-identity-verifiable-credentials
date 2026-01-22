/**
 * Tests for JWT Utilities Module
 *
 * Tests Ed25519 JWT signing and verification per RFC 8037.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateEd25519KeyPair,
  signJwt,
  verifyJwt,
  decodeJwt,
  keyPairToJwk,
  createJwks,
  base64UrlEncode,
  base64UrlDecode,
} from './index.js';
import type { KeyPair, JwtPayload } from './index.js';

describe('JWT Utilities', () => {
  let keyPair: KeyPair;

  beforeAll(async () => {
    keyPair = await generateEd25519KeyPair();
  });

  describe('Base64URL Encoding', () => {
    it('should encode and decode correctly', () => {
      const original = 'Hello, World! こんにちは';
      const encoded = base64UrlEncode(original);
      const decodedBytes = base64UrlDecode(encoded);
      const decoded = new TextDecoder().decode(decodedBytes);

      expect(decoded).toBe(original);
    });

    it('should produce URL-safe output', () => {
      const data = '>>??++//==';
      const encoded = base64UrlEncode(data);

      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });
  });

  describe('JWT Signing', () => {
    it('should sign a JWT with EdDSA', async () => {
      const payload: JwtPayload = {
        iss: 'test-issuer',
        sub: 'user123',
        aud: 'test-audience',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'test-jti',
      };

      const token = await signJwt(payload, keyPair);

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include EdDSA algorithm in header', async () => {
      const payload: JwtPayload = {
        iss: 'test-issuer',
        sub: 'test',
        aud: 'test-audience',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'test-jti',
      };
      const token = await signJwt(payload, keyPair);
      const decoded = decodeJwt(token);

      expect(decoded.header.alg).toBe('EdDSA');
      expect(decoded.header.typ).toBe('JWT');
    });
  });

  describe('JWT Verification', () => {
    it('should verify a valid JWT', async () => {
      const payload: JwtPayload = {
        iss: 'test-issuer',
        sub: 'user456',
        aud: 'test-audience',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'test-jti',
        scope: 'expense:approve:max:10000',
      };

      const token = await signJwt(payload, keyPair);
      const verifier = keyPair.verifier();
      const result = await verifyJwt(token, verifier);

      expect(result.valid).toBe(true);
      expect(result.payload?.sub).toBe('user456');
      expect(result.payload?.scope).toBe('expense:approve:max:10000');
    });

    it('should reject expired JWT', async () => {
      const payload: JwtPayload = {
        iss: 'test-issuer',
        sub: 'expired-user',
        aud: 'test-audience',
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
        jti: 'test-jti',
      };

      const token = await signJwt(payload, keyPair);
      const verifier = keyPair.verifier();
      const result = await verifyJwt(token, verifier);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject JWT signed with different key', async () => {
      const otherKeyPair = await generateEd25519KeyPair();

      const payload: JwtPayload = {
        iss: 'test-issuer',
        sub: 'user',
        aud: 'test-audience',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'test-jti',
      };

      const token = await signJwt(payload, keyPair);
      const otherVerifier = otherKeyPair.verifier();
      const result = await verifyJwt(token, otherVerifier);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('signature');
    });

    it('should reject tampered JWT', async () => {
      const payload: JwtPayload = {
        iss: 'test-issuer',
        sub: 'original-user',
        aud: 'test-audience',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'test-jti',
      };

      const token = await signJwt(payload, keyPair);

      // Tamper with the payload
      const parts = token.split('.');
      const tamperedPayload: JwtPayload = {
        iss: 'test-issuer',
        sub: 'tampered-user',
        aud: 'test-audience',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'test-jti',
      };
      const tamperedPayloadEncoded = base64UrlEncode(JSON.stringify(tamperedPayload));
      const tamperedToken = `${parts[0]}.${tamperedPayloadEncoded}.${parts[2]}`;

      const verifier = keyPair.verifier();
      const result = await verifyJwt(tamperedToken, verifier);

      expect(result.valid).toBe(false);
    });
  });

  describe('JWT Decoding', () => {
    it('should decode JWT without verification', async () => {
      const payload: JwtPayload = {
        iss: 'test-issuer',
        sub: 'decode-test',
        aud: 'test-audience',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'test-jti',
        customClaim: 'customValue',
      };

      const token = await signJwt(payload, keyPair);
      const decoded = decodeJwt(token);

      expect(decoded.header.alg).toBe('EdDSA');
      expect(decoded.payload.sub).toBe('decode-test');
      expect(decoded.payload.customClaim).toBe('customValue');
    });
  });

  describe('JWK Conversion', () => {
    it('should convert key pair to JWK', async () => {
      const jwk = await keyPairToJwk(keyPair);

      expect(jwk).toHaveProperty('kty', 'OKP');
      expect(jwk).toHaveProperty('crv', 'Ed25519');
      expect(jwk).toHaveProperty('x'); // Public key component
    });

    it('should create valid JWKS', async () => {
      const keyId = 'test-key-id';
      const jwks = await createJwks(keyPair, keyId);

      expect(jwks).toHaveProperty('keys');
      expect((jwks as { keys: unknown[] }).keys).toHaveLength(1);
      expect((jwks as { keys: Record<string, unknown>[] }).keys[0].kty).toBe('OKP');
      expect((jwks as { keys: Record<string, unknown>[] }).keys[0].crv).toBe('Ed25519');
      expect((jwks as { keys: Record<string, unknown>[] }).keys[0].kid).toBe(keyId);
    });
  });
});
