/**
 * Type declarations for Digital Bazaar libraries
 *
 * These libraries don't ship TypeScript types, so we declare them here.
 */

declare module '@digitalbazaar/ed25519-multikey' {
  export interface Ed25519Multikey {
    id: string;
    controller: string;
    publicKeyMultibase: string;
    secretKeyMultibase?: string;
    export(options: { publicKey: boolean; secretKey?: boolean }): Promise<{
      id: string;
      controller: string;
      publicKeyMultibase: string;
      secretKeyMultibase: string;
    }>;
    signer(): {
      sign(data: { data: Uint8Array }): Promise<Uint8Array>;
    };
    verifier(): {
      verify(data: { data: Uint8Array; signature: Uint8Array }): Promise<boolean>;
    };
  }

  export function generate(): Promise<Ed25519Multikey>;
  export function from(options: {
    id?: string;
    controller?: string;
    publicKeyMultibase: string;
    secretKeyMultibase?: string;
  }): Promise<Ed25519Multikey>;
}

declare module '@digitalbazaar/credentials-context' {
  const credentialsContext: {
    contexts: Map<string, object>;
    CONTEXT_URL: string;
    CONTEXT: object;
  };
  export default credentialsContext;
}

declare module '@digitalbazaar/data-integrity-context' {
  const dataIntegrityContext: {
    contexts: Map<string, object>;
    CONTEXT_URL: string;
    CONTEXT: object;
  };
  export default dataIntegrityContext;
}

declare module '@digitalbazaar/data-integrity' {
  export class DataIntegrityProof {
    constructor(options: {
      signer?: { sign(data: { data: Uint8Array }): Promise<Uint8Array> };
      cryptosuite: object;
    });
  }
}

declare module '@digitalbazaar/eddsa-rdfc-2022-cryptosuite' {
  export const cryptosuite: object;
}

declare module '@digitalbazaar/vc' {
  export function issue(options: {
    credential: object;
    suite: object;
    documentLoader: (url: string) => Promise<{
      contextUrl: string | null;
      documentUrl: string;
      document: object;
    }>;
  }): Promise<object>;

  export function verifyCredential(options: {
    credential: object;
    suite: object;
    documentLoader: (url: string) => Promise<{
      contextUrl: string | null;
      documentUrl: string;
      document: object;
    }>;
  }): Promise<{
    verified: boolean;
    error?: { message: string };
    results?: unknown[];
  }>;

  export function signPresentation(options: {
    presentation: object;
    suite: object;
    challenge: string;
    domain: string;
    documentLoader: (url: string) => Promise<{
      contextUrl: string | null;
      documentUrl: string;
      document: object;
    }>;
  }): Promise<object>;

  export function verify(options: {
    presentation: object;
    suite: object;
    challenge: string;
    domain: string;
    documentLoader: (url: string) => Promise<{
      contextUrl: string | null;
      documentUrl: string;
      document: object;
    }>;
  }): Promise<{
    verified: boolean;
    error?: { message: string };
    credentialResults?: Array<{
      verified: boolean;
      error?: { message: string };
    }>;
    presentationResult?: {
      verified: boolean;
      error?: { message: string };
    };
  }>;
}

declare module 'jsonld' {
  export function compact(
    doc: object,
    ctx: object | string,
    options?: object
  ): Promise<object>;

  export function expand(doc: object, options?: object): Promise<object[]>;

  export function flatten(doc: object, ctx?: object, options?: object): Promise<object>;

  export function frame(doc: object, frame: object, options?: object): Promise<object>;

  export function normalize(doc: object, options?: object): Promise<string>;

  export function toRDF(doc: object, options?: object): Promise<object>;

  export function fromRDF(dataset: object, options?: object): Promise<object[]>;
}

declare module 'jsonld-signatures' {
  export function sign(
    document: object,
    options: {
      suite: object;
      purpose: object;
      documentLoader: (url: string) => Promise<object>;
    }
  ): Promise<object>;

  export function verify(
    document: object,
    options: {
      suite: object;
      purpose: object;
      documentLoader: (url: string) => Promise<object>;
    }
  ): Promise<{ verified: boolean }>;

  export namespace purposes {
    class AssertionProofPurpose {
      constructor(options?: object);
    }
    class AuthenticationProofPurpose {
      constructor(options: { challenge: string; domain?: string });
    }
  }
}
