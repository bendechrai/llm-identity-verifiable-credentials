/**
 * Shared Library Index
 *
 * Exports all library modules for use by services.
 */

// Re-export all types from shared/types.ts
export * from '../../shared/types.js';

// Key management
export {
  generateEd25519KeyPair,
  keyPairToDid,
  getVerificationMethod,
  loadOrCreateKeyPair,
  serializeKeyPair,
  deserializeKeyPair,
  getSigner,
  getVerifier,
  createVerifierKeyPair,
  type KeyPair,
  type KeyPairData,
} from './keys.js';

// Document loader
export {
  createDocumentLoader,
  CONTEXTS,
  type DocumentLoader,
  type DocumentLoaderResult,
} from './document-loader.js';

// Credential utilities
export {
  createDataIntegritySuite,
  createVerificationSuite,
  issueCredential,
  verifyCredential,
  createPresentation,
  signPresentation,
  verifyPresentation,
  isCredentialExpired,
  isCredentialNotYetValid,
  getCredentialTypes,
  type UnsignedCredential,
  type UnsignedPresentation,
  type VerificationResult,
  type PresentationVerificationResult,
} from './credentials.js';

// JWT utilities
export {
  base64UrlEncode,
  base64UrlDecode,
  createEdDsaJwtHeader,
  signJwt,
  decodeJwt,
  verifyJwtSignature,
  verifyJwt,
  keyPairToJwk,
  createJwks,
  type JwtPayload,
  type DecodedJwt,
  type JwtVerificationResult,
} from './jwt.js';

// Express middleware
export {
  errorHandler,
  requestLogger,
  corsMiddleware,
  jsonBodyParser,
  healthCheck,
  notFoundHandler,
  createApp,
  startServer,
  type TokenInfo,
} from './middleware.js';

// Audit logger
export {
  AuditLogger,
  getAuditLogger,
  createAuditLogger,
} from './audit.js';

// HTTP client
export {
  HttpClient,
  createHttpClient,
  type HttpClientOptions,
  type FetchOptions,
  type HttpError,
} from './http-client.js';
