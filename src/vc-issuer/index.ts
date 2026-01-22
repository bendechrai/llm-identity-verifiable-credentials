/**
 * VC Issuer Service
 *
 * Issues Verifiable Credentials for the demo:
 * - EmployeeCredential: Proves employment
 * - FinanceApproverCredential: Attests approval authority (contains the cryptographic ceiling)
 *
 * Port: 3001
 */

import { z } from 'zod';
import {
  createApp,
  startServer,
  loadOrCreateKeyPair,
  keyPairToDid,
  getVerificationMethod,
  issueCredential,
  CONTEXTS,
  type KeyPair,
  type VerifiableCredential,
  type UnsignedCredential,
} from '../lib/index.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const KEY_PATH = process.env.KEY_PATH || '/app/keys/issuer-key.json';

// Issuer metadata
const ISSUER_NAME = 'Acme Corporation HR';

// Global issuer key pair (loaded on startup)
let issuerKeyPair: KeyPair;
let issuerDid: string;

// ============================================================
// Request Schemas (using Zod)
// ============================================================

const EmployeeCredentialRequestSchema = z.object({
  subjectDid: z.string().startsWith('did:'),
  name: z.string().min(1),
  employeeId: z.string().min(1),
  jobTitle: z.string().min(1),
  department: z.string().min(1),
});

const FinanceApproverCredentialRequestSchema = z.object({
  subjectDid: z.string().startsWith('did:'),
  approvalLimit: z.number().positive(),
  department: z.string().min(1),
});

// ============================================================
// Credential Creation Functions
// ============================================================

/**
 * Create and sign an EmployeeCredential.
 */
async function createEmployeeCredential(
  subjectDid: string,
  name: string,
  employeeId: string,
  jobTitle: string,
  department: string
): Promise<VerifiableCredential> {
  // Include DEMO_V1 context for custom properties (name, employeeId, jobTitle, department, etc.)
  const unsignedCredential: UnsignedCredential = {
    '@context': [CONTEXTS.VC_V2, CONTEXTS.DEMO_V1],
    type: ['VerifiableCredential', 'EmployeeCredential'],
    issuer: issuerDid,
    validFrom: new Date().toISOString(),
    credentialSubject: {
      id: subjectDid,
      type: 'Person',
      name,
      employeeId,
      jobTitle,
      department,
      worksFor: {
        type: 'Organization',
        name: ISSUER_NAME.replace(' HR', ''),
      },
    },
  };

  return issueCredential(unsignedCredential, issuerKeyPair);
}

/**
 * Create and sign a FinanceApproverCredential.
 * The approvalLimit is THE CRYPTOGRAPHIC CEILING - the key security constraint.
 */
async function createFinanceApproverCredential(
  subjectDid: string,
  approvalLimit: number,
  department: string
): Promise<VerifiableCredential> {
  // Include DEMO_V1 context for custom properties (role, approvalLimit, currency, department)
  const unsignedCredential: UnsignedCredential = {
    '@context': [CONTEXTS.VC_V2, CONTEXTS.DEMO_V1],
    type: ['VerifiableCredential', 'FinanceApproverCredential'],
    issuer: issuerDid,
    validFrom: new Date().toISOString(),
    credentialSubject: {
      id: subjectDid,
      role: 'finance-approver',
      approvalLimit, // THE CRYPTOGRAPHIC CEILING
      currency: 'USD',
      department,
    },
  };

  return issueCredential(unsignedCredential, issuerKeyPair);
}

// ============================================================
// Express Application
// ============================================================

async function main() {
  // Load or create issuer key pair
  issuerKeyPair = await loadOrCreateKeyPair(KEY_PATH);
  issuerDid = keyPairToDid(issuerKeyPair);

  console.log(`[VC Issuer] Issuer DID: ${issuerDid}`);

  const app = createApp('vc-issuer');

  // ============================================================
  // Endpoints
  // ============================================================

  /**
   * POST /credentials/employee
   * Issue an EmployeeCredential
   */
  app.post('/credentials/employee', async (req, res, next) => {
    try {
      const parsed = EmployeeCredentialRequestSchema.parse(req.body);

      const credential = await createEmployeeCredential(
        parsed.subjectDid,
        parsed.name,
        parsed.employeeId,
        parsed.jobTitle,
        parsed.department
      );

      res.json(credential);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request body',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  });

  /**
   * POST /credentials/finance-approver
   * Issue a FinanceApproverCredential
   */
  app.post('/credentials/finance-approver', async (req, res, next) => {
    try {
      const parsed = FinanceApproverCredentialRequestSchema.parse(req.body);

      const credential = await createFinanceApproverCredential(
        parsed.subjectDid,
        parsed.approvalLimit,
        parsed.department
      );

      res.json(credential);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request body',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /.well-known/did.json
   * Return the issuer's DID document
   */
  app.get('/.well-known/did.json', async (req, res) => {
    const publicKeyMultibase = issuerKeyPair.publicKeyMultibase;
    const verificationMethodId = getVerificationMethod(issuerDid);

    const didDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
      ],
      id: issuerDid,
      verificationMethod: [
        {
          id: verificationMethodId,
          type: 'Multikey',
          controller: issuerDid,
          publicKeyMultibase,
        },
      ],
      assertionMethod: [verificationMethodId],
      authentication: [verificationMethodId],
    };

    res.json(didDocument);
  });

  /**
   * GET /issuer/info
   * Return issuer metadata
   */
  app.get('/issuer/info', (req, res) => {
    res.json({
      did: issuerDid,
      name: ISSUER_NAME,
      credentialTypes: ['EmployeeCredential', 'FinanceApproverCredential'],
    });
  });

  /**
   * POST /demo/issue-alice-credentials
   * Demo endpoint to issue both credentials for Alice
   */
  app.post('/demo/issue-alice-credentials', async (req, res, next) => {
    try {
      const { holderDid } = req.body as { holderDid: string };

      if (!holderDid || !holderDid.startsWith('did:')) {
        res.status(400).json({
          error: 'validation_error',
          message: 'holderDid is required and must be a valid DID',
        });
        return;
      }

      // Issue EmployeeCredential
      const employeeCredential = await createEmployeeCredential(
        holderDid,
        'Alice Johnson',
        'EMP-001',
        'Senior Financial Analyst',
        'Finance'
      );

      // Issue FinanceApproverCredential with $10,000 limit (THE CRITICAL VALUE)
      const financeCredential = await createFinanceApproverCredential(
        holderDid,
        10000, // $10,000 approval limit - THE CRYPTOGRAPHIC CEILING
        'Finance'
      );

      res.json({
        credentials: [employeeCredential, financeCredential],
        holder: holderDid,
        message: 'Issued EmployeeCredential and FinanceApproverCredential for Alice',
      });
    } catch (error) {
      next(error);
    }
  });

  // Start server
  startServer(app, PORT, 'vc-issuer');
}

main().catch((error) => {
  console.error('[VC Issuer] Failed to start:', error);
  process.exit(1);
});
