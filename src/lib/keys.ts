/**
 * Key Management Module
 *
 * Handles Ed25519 key pair generation, storage, and DID derivation.
 * Uses did:key method with multibase encoding (z6Mk prefix for Ed25519).
 */

import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface KeyPairData {
  id: string;
  controller: string;
  publicKeyMultibase: string;
  secretKeyMultibase: string;
}

export interface KeyPair {
  id: string;
  controller: string;
  publicKeyMultibase: string;
  secretKeyMultibase?: string;
  export: (options: { publicKey: boolean; secretKey?: boolean }) => Promise<KeyPairData>;
  signer: () => { sign: (data: { data: Uint8Array }) => Promise<Uint8Array> };
  verifier: () => { verify: (data: { data: Uint8Array; signature: Uint8Array }) => Promise<boolean> };
}

/**
 * Generate a new Ed25519 key pair using multikey format.
 * The key can be used for signing VCs and deriving did:key identifiers.
 */
export async function generateEd25519KeyPair(): Promise<KeyPair> {
  const keyPair = await Ed25519Multikey.generate();
  return keyPair as KeyPair;
}

/**
 * Derive a did:key identifier from a key pair.
 * did:key encodes the public key directly in the DID (z6Mk prefix for Ed25519).
 */
export function keyPairToDid(keyPair: KeyPair): string {
  // The publicKeyMultibase already has the z6Mk prefix for Ed25519 multikey
  return `did:key:${keyPair.publicKeyMultibase}`;
}

/**
 * Get the verification method ID for a did:key.
 * Format: did:key:z6Mk...#z6Mk...
 */
export function getVerificationMethod(did: string): string {
  const publicKeyMultibase = did.replace('did:key:', '');
  return `${did}#${publicKeyMultibase}`;
}

/**
 * Load a key pair from file or generate a new one if it doesn't exist.
 * Persists the key to ensure consistent DIDs across restarts.
 */
export async function loadOrCreateKeyPair(path: string): Promise<KeyPair> {
  try {
    const data = await readFile(path, 'utf-8');
    const keyPairData = JSON.parse(data) as KeyPairData;
    return deserializeKeyPair(keyPairData);
  } catch (error) {
    // File doesn't exist, generate new key pair
    const keyPair = await generateEd25519KeyPair();
    const serialized = await serializeKeyPair(keyPair);

    // Ensure directory exists
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(serialized, null, 2));

    return keyPair;
  }
}

/**
 * Serialize a key pair to JSON for storage.
 */
export async function serializeKeyPair(keyPair: KeyPair): Promise<KeyPairData> {
  const exported = await keyPair.export({ publicKey: true, secretKey: true });
  return {
    id: exported.id,
    controller: exported.controller,
    publicKeyMultibase: exported.publicKeyMultibase,
    secretKeyMultibase: exported.secretKeyMultibase,
  };
}

/**
 * Reconstruct a key pair from serialized JSON data.
 */
export async function deserializeKeyPair(data: KeyPairData): Promise<KeyPair> {
  const keyPair = await Ed25519Multikey.from(data);
  return keyPair as KeyPair;
}

/**
 * Get a signer interface from a key pair for signing operations.
 */
export function getSigner(keyPair: KeyPair) {
  return keyPair.signer();
}

/**
 * Create a key pair from just the public key (for verification only).
 */
export async function createVerifierKeyPair(publicKeyMultibase: string, controller: string): Promise<KeyPair> {
  const keyPair = await Ed25519Multikey.from({
    publicKeyMultibase,
    controller,
    id: `${controller}#${publicKeyMultibase}`,
  });
  return keyPair as KeyPair;
}

/**
 * Get a verifier interface from a public key for verification operations.
 */
export async function getVerifier(publicKeyMultibase: string, controller: string) {
  const keyPair = await createVerifierKeyPair(publicKeyMultibase, controller);
  return keyPair.verifier();
}
