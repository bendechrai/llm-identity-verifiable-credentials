// Shared types for LLM Identity Demo
// Using W3C VC Data Model 2.0

// ============================================================
// Verifiable Credentials (VC Data Model 2.0)
// ============================================================

export interface VerifiableCredential {
  '@context': string[];
  type: string[];
  issuer: string;
  validFrom: string; // VC 2.0 uses validFrom instead of issuanceDate
  validUntil?: string; // VC 2.0 uses validUntil instead of expirationDate
  credentialSubject: Record<string, unknown>;
  proof: DataIntegrityProof;
}

export interface DataIntegrityProof {
  type: 'DataIntegrityProof';
  cryptosuite: 'eddsa-rdfc-2022';
  created: string;
  verificationMethod: string;
  proofPurpose: 'assertionMethod' | 'authentication';
  proofValue: string;
  challenge?: string; // For presentations
  domain?: string; // For presentations
}

export interface EmployeeCredentialSubject {
  id: string; // Holder's DID
  type: 'Person';
  name: string;
  employeeId: string;
  jobTitle: string;
  department: string;
  worksFor: {
    type: 'Organization';
    name: string;
  };
}

export interface FinanceApproverCredentialSubject {
  id: string; // Holder's DID
  role: 'finance-approver';
  approvalLimit: number;
  currency: 'USD';
  department: string;
}

export interface VerifiablePresentation {
  '@context': string[];
  type: ['VerifiablePresentation'];
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof: DataIntegrityProof;
}

// ============================================================
// Auth Server
// ============================================================

export interface PresentationRequest {
  challenge: string;
  domain: string;
  credentialsRequired: Array<{
    type: string;
    purpose: string;
  }>;
}

export interface PresentationRequestResponse {
  presentationRequest: PresentationRequest;
  expiresIn: number; // seconds until challenge expires
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number; // 60 seconds
  scope: string; // e.g., "expense:view expense:submit expense:approve:max:10000"
  claims: {
    employee: boolean;
    employeeId: string;
    name: string;
    approvalLimit: number;
    department: string;
  };
}

export interface TokenClaims {
  iss: string; // Auth server URL
  sub: string; // Holder DID
  aud: string; // "expense-api"
  exp: number;
  iat: number;
  jti: string; // Unique token ID
  scope: string;
  token_mode: 'demo' | 'vc'; // demo = JWT-only (reusable), vc = VC-protected (single-use)
  claims: {
    employeeId: string;
    name: string;
    approvalLimit: number;
  };
}

// ============================================================
// Expense API
// ============================================================

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: 'USD';
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedBy: string;
  submittedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  notes?: string;
  receipts?: string[];
}

export interface ExpenseApprovalRequest {
  approved: true;
  notes?: string;
}

export interface ExpenseApprovalResponse {
  approved: true;
  expenseId: string;
  amount: number;
  ceiling: number | null;
  approvedBy: string;
  approvedAt: string;
  warning?: string;
}

export interface ExpenseApprovalError {
  error: 'forbidden' | 'not_found' | 'unauthorized';
  message: string;
  ceiling?: number;
  requested?: number;
}

// ============================================================
// Audit Log
// ============================================================

export interface AuditLogEntry {
  timestamp: string;
  event: AuditEventType;
  requestId?: string;
  details: Record<string, unknown>;
}

export type AuditEventType =
  | 'authorization_decision'
  | 'expense_approval'
  | 'expense_approval_denied'
  | 'expense_rejection'
  | 'presentation_verified'
  | 'presentation_rejected'
  | 'token_issued'
  | 'demo_token_issued';

export interface AuthorizationAuditEntry extends AuditLogEntry {
  event: 'authorization_decision';
  challenge: string;
  holderDid: string;
  presentationVerified: boolean;
  credentials: Array<{
    type: string;
    issuer: string;
    issuerTrusted: boolean;
    signatureValid: boolean;
    notExpired: boolean;
    claims?: Record<string, unknown>;
  }>;
  scopesGranted?: string[];
  tokenId?: string;
  tokenExpiresAt?: string;
  decision: 'granted' | 'denied';
  failureReason?: string;
}

export interface ExpenseAuditEntry extends AuditLogEntry {
  event: 'expense_approval' | 'expense_approval_denied';
  tokenId: string;
  tokenSubject: string;
  expenseId: string;
  expenseAmount: number;
  approvalCeiling: number;
  withinCeiling: boolean;
  decision: 'approved' | 'denied';
  reason?: string;
  tokenClaims: Record<string, unknown>;
}

// ============================================================
// Demo Modes & Personas
// ============================================================

export type DemoMode = 'jwt-only' | 'vc-protected';
export type DemoPersona = 'alice' | 'attacker';

// ============================================================
// LLM Agent — Sessions
// ============================================================

export interface DemoSession {
  sessionId: string;
  mode: DemoMode;
  persona: DemoPersona;
  staticJwt?: string; // Bearer token (acquired via auth or pasted by user)
  walletState?: {
    holder: string;
    credentials: string[];
  };
  conversationHistory: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  artifacts: {
    lastVc?: Record<string, unknown>;
    lastVp?: Record<string, unknown>;
    lastJwt?: string;
    lastDecodedJwt?: Record<string, unknown>;
  };
  createdExpenseIds: string[]; // Track expenses created in this session
}

export interface SessionCreateRequest {
  mode: DemoMode;
  persona: DemoPersona;
}

export interface SessionCreateResponse {
  sessionId: string;
  mode: DemoMode;
  persona: DemoPersona;
  staticJwt?: string;
  walletState?: {
    holder: string;
    credentials: string[];
    approvalLimit?: number;
  };
}

export interface ChatRequest {
  message: string;
  sessionId: string;
}

// ============================================================
// SSE Event Types (streamed from agent to UI)
// ============================================================

export interface ToolCallStartEvent {
  id: string;
  name: string;
  params: Record<string, unknown>;
}

export interface ToolCallResultEvent {
  id: string;
  result: Record<string, unknown>;
  status: 'success' | 'error';
}

export interface ArtifactUpdateEvent {
  type: 'jwt' | 'vp' | 'vc';
  data: unknown;
}

export interface AssistantMessageEvent {
  content: string;
}

export interface WalletApprovalRequiredEvent {
  requestingParty: string;
  credentials: string[];
  purpose: string;
}

export interface SuggestedPromptsEvent {
  prompts: string[];
}

export interface DoneEvent {
  suggestedPrompts?: string[];
}

// Union of all SSE event data types
export type SseEventData =
  | { event: 'tool_call_start'; data: ToolCallStartEvent }
  | { event: 'tool_call_result'; data: ToolCallResultEvent }
  | { event: 'artifact_update'; data: ArtifactUpdateEvent }
  | { event: 'message'; data: AssistantMessageEvent }
  | { event: 'wallet_approval_required'; data: WalletApprovalRequiredEvent }
  | { event: 'wallet_approval_granted'; data: Record<string, never> }
  | { event: 'done'; data: DoneEvent };

// ============================================================
// Intent Parsing (Agent)
// ============================================================

export type AgentIntent =
  | { type: 'list_expenses' }
  | { type: 'create_expense'; amount: number; description: string }
  | { type: 'approve_expense'; expenseId: string }
  | { type: 'use_stolen_jwt'; jwt: string; action: string }
  | { type: 'help' }
  | { type: 'unknown'; message: string };

// ============================================================
// Wallet VP Response Metadata (display-only)
// ============================================================

export interface WalletPresentResponse {
  presentation: VerifiablePresentation;
  _demo_metadata?: {
    credentialLimits: {
      approvalLimit: number;
      currency: string;
    };
    note: string;
  };
}
