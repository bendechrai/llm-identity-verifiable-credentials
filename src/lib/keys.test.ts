/**
 * Tests for Key Management Module
 */

import { describe, it, expect } from 'vitest';
import {
  generateEd25519KeyPair,
  keyPairToDid,
  getVerificationMethod,
  serializeKeyPair,
  deserializeKeyPair,
} from './keys.js';

describe('Key Management', () => {
  it('should generate an Ed25519 key pair', async () => {
    const keyPair = await generateEd25519KeyPair();

    expect(keyPair).toBeDefined();
    expect(keyPair.publicKeyMultibase).toBeDefined();
    // Ed25519 multikey starts with z6Mk
    expect(keyPair.publicKeyMultibase).toMatch(/^z6Mk/);
  });

  it('should derive did:key from key pair', async () => {
    const keyPair = await generateEd25519KeyPair();
    const did = keyPairToDid(keyPair);

    expect(did).toMatch(/^did:key:z6Mk/);
  });

  it('should generate verification method ID', async () => {
    const keyPair = await generateEd25519KeyPair();
    const did = keyPairToDid(keyPair);
    const verificationMethod = getVerificationMethod(did);

    // Format: did:key:z6Mk...#z6Mk...
    expect(verificationMethod).toContain('#');
    expect(verificationMethod.startsWith(did)).toBe(true);
    expect(verificationMethod.split('#')[1]).toBe(keyPair.publicKeyMultibase);
  });

  it('should serialize and deserialize key pair', async () => {
    const original = await generateEd25519KeyPair();
    const serialized = await serializeKeyPair(original);

    expect(serialized.publicKeyMultibase).toBe(original.publicKeyMultibase);
    expect(serialized.secretKeyMultibase).toBeDefined();

    const restored = await deserializeKeyPair(serialized);
    expect(restored.publicKeyMultibase).toBe(original.publicKeyMultibase);
  });

  it('should sign and verify with key pair', async () => {
    const keyPair = await generateEd25519KeyPair();
    const testData = new TextEncoder().encode('test message');

    const signer = keyPair.signer();
    const signature = await signer.sign({ data: testData });

    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBeGreaterThan(0);

    const verifier = keyPair.verifier();
    const valid = await verifier.verify({ data: testData, signature });

    expect(valid).toBe(true);
  });

  it('should reject invalid signatures', async () => {
    const keyPair = await generateEd25519KeyPair();
    const testData = new TextEncoder().encode('test message');
    const wrongData = new TextEncoder().encode('wrong message');

    const signer = keyPair.signer();
    const signature = await signer.sign({ data: testData });

    const verifier = keyPair.verifier();
    const valid = await verifier.verify({ data: wrongData, signature });

    expect(valid).toBe(false);
  });
});
