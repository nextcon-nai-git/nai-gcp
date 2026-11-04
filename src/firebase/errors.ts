"use client";

export type SecurityRuleContext = {
  path: string;
  operation: "get" | "list" | "create" | "update" | "delete" | "write";
  requestResourceData?: unknown;
};

interface SecurityRuleRequest {
  method: string;
  path: string;
}

/**
 * Build only the minimum diagnostics required to identify the denied operation.
 * Never attach Firebase auth claims, provider identities, e-mail addresses,
 * request payloads or any other user data to client-visible errors.
 */
function buildRequestObject(context: SecurityRuleContext): SecurityRuleRequest {
  return {
    method: context.operation,
    path: `/databases/(default)/documents/${context.path}`,
  };
}

function buildErrorMessage(requestObject: SecurityRuleRequest): string {
  return `Firestore permission denied (${requestObject.method}) at ${requestObject.path}.`;
}

/**
 * Sanitized permission error. Detailed authorization context belongs in
 * protected server-side observability, not in the browser console.
 */
export class FirestorePermissionError extends Error {
  public readonly request: SecurityRuleRequest;
  public readonly code = "permission-denied";

  constructor(context: SecurityRuleContext) {
    const requestObject = buildRequestObject(context);
    super(buildErrorMessage(requestObject));
    this.name = "FirebaseError";
    this.request = requestObject;
  }
}
