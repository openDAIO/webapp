/**
 * Thin client for the DAIO Content Service and MarkItDown API.
 *
 * Base URLs are read from Vite env vars:
 *   VITE_DAIO_API        — Content API  (e.g. http://api.opendaio.com)
 *   VITE_MARKITDOWN_API  — MarkItDown   (e.g. http://markitdown.opendaio.com)
 *
 * The two host names are reverse-proxied to the agents stack:
 *   api.opendaio.com:80         → localhost:18002 (content-service)
 *   markitdown.opendaio.com:80  → localhost:18003 (markitdown)
 */

import { keccak256 } from 'viem';

const DAIO_API       = import.meta.env.VITE_DAIO_API       ?? '';
const MARKITDOWN_API = import.meta.env.VITE_MARKITDOWN_API ?? '';
const API_LOG_PREFIX = '[DAIO][api]';

function logApi(event: string, payload: Record<string, unknown>) {
  console.debug(`${API_LOG_PREFIX} ${event}`, payload);
}

function requestDurationMs(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

function slugifyProposalName(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'paper';
}

export function makeProposalId(filename: string): string {
  const id =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return `web-${slugifyProposalName(filename)}-${id}`.slice(0, 180);
}

/** Matches Content API: keccak256(toUtf8Bytes(text)). */
export function hashUtf8Text(text: string): `0x${string}` {
  return keccak256(new TextEncoder().encode(text));
}

export function rubricHashForProposalId(id: string): `0x${string}` {
  return hashUtf8Text(`${id}:rubric`);
}

// ─── MarkItDown ────────────────────────────────────────────────────────────

export interface ConvertResult {
  filename: string;
  markdown: string;
  bytes: number;
}

/**
 * Uploads a File to the MarkItDown service and returns the converted Markdown.
 * Uses the raw-body path (X-Filename header) to avoid multipart complexity.
 */
export async function convertFileToMarkdown(file: File): Promise<ConvertResult> {
  const url = `${MARKITDOWN_API}/convert`;
  const startedAt = performance.now();
  logApi('POST /convert:start', {
    url,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    bytes: file.size,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': file.name,
      },
      body: file,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      logApi('POST /convert:error', {
        status: res.status,
        statusText: res.statusText,
        body,
        durationMs: requestDurationMs(startedAt),
      });
      throw new Error(`MarkItDown convert failed (${res.status}): ${(body as { error?: string }).error ?? res.statusText}`);
    }

    const data = await res.json() as ConvertResult;
    logApi('POST /convert:ok', {
      status: res.status,
      filename: data.filename,
      bytes: data.bytes,
      markdownChars: data.markdown.length,
      durationMs: requestDurationMs(startedAt),
    });
    return data;
  } catch (err) {
    logApi('POST /convert:failed', {
      message: err instanceof Error ? err.message : String(err),
      durationMs: requestDurationMs(startedAt),
    });
    throw err;
  }
}

// ─── Content API — proposal upload ────────────────────────────────────────

export interface UploadProposalParams {
  id: string;
  text: string;
  mimeType?: string;
}

export interface UploadProposalResult {
  uri: string;
  id: string;
  hash: `0x${string}`;
  mimeType: string;
  text: string;
}

/**
 * Stores canonical Markdown before payment so the same hash can be passed to
 * PaymentRouter.createRequestWithUSDAIO/createRequestWithETH.
 */
export async function uploadProposal(params: UploadProposalParams): Promise<UploadProposalResult> {
  const url = `${DAIO_API}/proposals`;
  const startedAt = performance.now();
  logApi('POST /proposals:start', {
    url,
    id: params.id,
    mimeType: params.mimeType ?? 'text/markdown',
    textChars: params.text.length,
    localHash: hashUtf8Text(params.text),
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:       params.id,
        text:     params.text,
        mimeType: params.mimeType ?? 'text/markdown',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      logApi('POST /proposals:error', {
        status: res.status,
        statusText: res.statusText,
        body: err,
        durationMs: requestDurationMs(startedAt),
      });
      throw new Error(`uploadProposal failed (${res.status}): ${err.error ?? res.statusText}`);
    }

    const data = await res.json() as UploadProposalResult;
    logApi('POST /proposals:ok', {
      status: res.status,
      id: data.id,
      uri: data.uri,
      hash: data.hash,
      textChars: data.text.length,
      durationMs: requestDurationMs(startedAt),
    });
    return data;
  } catch (err) {
    logApi('POST /proposals:failed', {
      id: params.id,
      message: err instanceof Error ? err.message : String(err),
      durationMs: requestDurationMs(startedAt),
    });
    throw err;
  }
}

// ─── Content API — document submission ────────────────────────────────────

export interface SubmitDocumentParams {
  requestId: string;
  txHash: string;
  requester: string;
  text: string;
  mimeType?: string;
}

export interface SubmitDocumentResult {
  updatedAt: number;
  verified: {
    requestId: string;
    requester: string;
    proposalURI: string;
    proposalHash: string;
    status: number;
    statusName: string;
    [key: string]: unknown;
  };
  proposal: {
    uri: string;
    id: string;
    hash: string;
    mimeType: string;
    text: string;
  };
}

export interface RecoverDocumentFromTxParams {
  txHash: string;
  requester?: string;
  id?: string;
  text: string;
  mimeType?: string;
}

/**
 * POST /requests/:requestId/document
 *
 * Registers the document after the requester has already created the on-chain
 * request directly (createRequestWithUSDAIO / createRequestWithETH).
 * The API verifies that txHash matches the stored request.
 */
export async function submitRequestDocument(params: SubmitDocumentParams): Promise<SubmitDocumentResult> {
  const { requestId, ...body } = params;
  const url = `${DAIO_API}/requests/${requestId}/document`;
  const startedAt = performance.now();
  logApi('POST /requests/:requestId/document:start', {
    url,
    requestId,
    txHash: body.txHash,
    requester: body.requester,
    mimeType: body.mimeType ?? 'text/markdown',
    textChars: body.text.length,
    localHash: hashUtf8Text(body.text),
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txHash:   body.txHash,
        requester: body.requester,
        text:     body.text,
        mimeType: body.mimeType ?? 'text/markdown',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      logApi('POST /requests/:requestId/document:error', {
        status: res.status,
        statusText: res.statusText,
        body: err,
        durationMs: requestDurationMs(startedAt),
      });
      throw new Error(`submitDocument failed (${res.status}): ${err.error ?? res.statusText}`);
    }

    const data = await res.json() as SubmitDocumentResult;
    logApi('POST /requests/:requestId/document:ok', {
      status: res.status,
      requestId,
      proposalURI: data.verified.proposalURI,
      proposalHash: data.verified.proposalHash,
      statusName: data.verified.statusName,
      durationMs: requestDurationMs(startedAt),
    });
    return data;
  } catch (err) {
    logApi('POST /requests/:requestId/document:failed', {
      requestId,
      message: err instanceof Error ? err.message : String(err),
      durationMs: requestDurationMs(startedAt),
    });
    throw err;
  }
}

/**
 * POST /requests/document-from-tx
 *
 * Recovers document storage when the payment transaction succeeded but the
 * frontend missed the RequestPaid event/requestId or the first document write.
 */
export async function recoverRequestDocumentFromTx(params: RecoverDocumentFromTxParams): Promise<SubmitDocumentResult> {
  const url = `${DAIO_API}/requests/document-from-tx`;
  const startedAt = performance.now();
  logApi('POST /requests/document-from-tx:start', {
    url,
    txHash: params.txHash,
    requester: params.requester,
    id: params.id,
    mimeType: params.mimeType ?? 'text/markdown',
    textChars: params.text.length,
    localHash: hashUtf8Text(params.text),
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txHash:    params.txHash,
        requester: params.requester,
        id:        params.id,
        text:      params.text,
        mimeType:  params.mimeType ?? 'text/markdown',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      logApi('POST /requests/document-from-tx:error', {
        status: res.status,
        statusText: res.statusText,
        body: err,
        durationMs: requestDurationMs(startedAt),
      });
      throw new Error(`recoverDocumentFromTx failed (${res.status}): ${err.error ?? res.statusText}`);
    }

    const data = await res.json() as SubmitDocumentResult;
    logApi('POST /requests/document-from-tx:ok', {
      status: res.status,
      requestId: data.verified.requestId,
      proposalURI: data.verified.proposalURI,
      proposalHash: data.verified.proposalHash,
      durationMs: requestDurationMs(startedAt),
    });
    return data;
  } catch (err) {
    logApi('POST /requests/document-from-tx:failed', {
      txHash: params.txHash,
      message: err instanceof Error ? err.message : String(err),
      durationMs: requestDurationMs(startedAt),
    });
    throw err;
  }
}

// ─── Content API — request document read ──────────────────────────────────

export async function getRequestDocument(requestId: string): Promise<SubmitDocumentResult | null> {
  const url = `${DAIO_API}/requests/${requestId}/document`;
  const startedAt = performance.now();
  logApi('GET /requests/:requestId/document:start', { url, requestId });

  const res = await fetch(url);
  if (res.status === 404) {
    logApi('GET /requests/:requestId/document:not_found', {
      requestId,
      durationMs: requestDurationMs(startedAt),
    });
    return null;
  }
  if (!res.ok) {
    logApi('GET /requests/:requestId/document:error', {
      requestId,
      status: res.status,
      statusText: res.statusText,
      durationMs: requestDurationMs(startedAt),
    });
    throw new Error(`getRequestDocument failed (${res.status})`);
  }

  const data = await res.json() as SubmitDocumentResult;
  logApi('GET /requests/:requestId/document:ok', {
    requestId,
    status: res.status,
    statusName: data.verified.statusName,
    proposalHash: data.verified.proposalHash,
    durationMs: requestDurationMs(startedAt),
  });
  return data;
}

// ─── Content API — agent statuses ─────────────────────────────────────────

export interface AgentStatus {
  requestId?: string;
  agent: string;
  phase?: string;
  status: string;
  detail?: string | null;
  payload?: unknown;
  updatedAt: number;
}

export async function getAgentStatuses(requestId: string): Promise<AgentStatus[]> {
  const url = `${DAIO_API}/requests/${requestId}/agent-statuses`;
  const startedAt = performance.now();

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logApi('GET /requests/:requestId/agent-statuses:error', {
        requestId,
        status: res.status,
        statusText: res.statusText,
        durationMs: requestDurationMs(startedAt),
      });
      return [];
    }

    const data = await res.json() as { statuses?: AgentStatus[]; agents?: AgentStatus[] } | AgentStatus[];
    return Array.isArray(data) ? data : (data.agents ?? data.statuses ?? []);
  } catch (err) {
    logApi('GET /requests/:requestId/agent-statuses:failed', {
      requestId,
      message: err instanceof Error ? err.message : String(err),
      durationMs: requestDurationMs(startedAt),
    });
    return [];
  }
}

// ─── Content API — agent reasons ──────────────────────────────────────────

export interface AgentReasons {
  review?: { summary?: string; rationale?: string; score?: number };
  audit?:  { summary?: string; rationale?: string };
}

export async function getAgentReasons(requestId: string, agent: string): Promise<AgentReasons | null> {
  const url = `${DAIO_API}/requests/${requestId}/agents/${encodeURIComponent(agent)}/reasons`;
  const startedAt = performance.now();
  logApi('GET /requests/:requestId/agents/:agent/reasons:start', {
    url,
    requestId,
    agent,
  });

  try {
    const res = await fetch(url);
    if (res.status === 404) {
      logApi('GET /requests/:requestId/agents/:agent/reasons:not_found', {
        requestId,
        agent,
        durationMs: requestDurationMs(startedAt),
      });
      return null;
    }
    if (!res.ok) {
      logApi('GET /requests/:requestId/agents/:agent/reasons:error', {
        requestId,
        agent,
        status: res.status,
        statusText: res.statusText,
        durationMs: requestDurationMs(startedAt),
      });
      return null;
    }

    const data = await res.json() as AgentReasons;
    logApi('GET /requests/:requestId/agents/:agent/reasons:ok', {
      requestId,
      agent,
      hasReview: Boolean(data.review),
      hasAudit: Boolean(data.audit),
      durationMs: requestDurationMs(startedAt),
    });
    return data;
  } catch (err) {
    logApi('GET /requests/:requestId/agents/:agent/reasons:failed', {
      requestId,
      agent,
      message: err instanceof Error ? err.message : String(err),
      durationMs: requestDurationMs(startedAt),
    });
    return null;
  }
}

// ─── Content API — agent ask (interview) ──────────────────────────────────

/**
 * POST /requests/:requestId/agents/:agent/ask — interview a reviewer agent.
 * Assumed request body: { question: string }
 * Assumed response shape: { answer: string }
 * (Adjust `body`/return mapping below if the deployed endpoint diverges.)
 */
export async function askAgentQuestion(
  requestId: string,
  agent: string,
  question: string,
): Promise<string> {
  const url = `${DAIO_API}/requests/${requestId}/agents/${encodeURIComponent(agent)}/ask`;
  const startedAt = performance.now();
  logApi('POST /requests/:requestId/agents/:agent/ask:start', {
    url,
    requestId,
    agent,
    questionLength: question.length,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logApi('POST /requests/:requestId/agents/:agent/ask:error', {
      requestId,
      agent,
      status: res.status,
      statusText: res.statusText,
      body: text.slice(0, 500),
      durationMs: requestDurationMs(startedAt),
    });
    throw new Error(`ask failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { answer?: string; message?: string; reply?: string };
  const answer = data.answer ?? data.message ?? data.reply ?? '';
  logApi('POST /requests/:requestId/agents/:agent/ask:ok', {
    requestId,
    agent,
    answerLength: answer.length,
    durationMs: requestDurationMs(startedAt),
  });

  if (!answer) throw new Error('ask returned an empty answer');
  return answer;
}

// ─── Content API — health check ───────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  const url = `${DAIO_API}/health`;
  const startedAt = performance.now();
  logApi('GET /health:start', { url });

  try {
    const res = await fetch(url);
    logApi('GET /health:done', {
      status: res.status,
      ok: res.ok,
      durationMs: requestDurationMs(startedAt),
    });
    return res.ok;
  } catch (err) {
    logApi('GET /health:failed', {
      message: err instanceof Error ? err.message : String(err),
      durationMs: requestDurationMs(startedAt),
    });
    return false;
  }
}
