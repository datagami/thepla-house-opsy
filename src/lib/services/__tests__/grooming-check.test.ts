import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkGrooming } from '@/lib/services/grooming-check';

const ENV = {
  AZURE_AI_FOUNDRY_ENDPOINT: 'https://example.openai.azure.com',
  AZURE_AI_FOUNDRY_KEY: 'fake-key',
  AZURE_AI_FOUNDRY_DEPLOYMENT: 'gpt-4o',
  AZURE_AI_FOUNDRY_TIMEOUT_MS: '8000',
};

function mockFetchResponse(jsonContent: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(jsonContent) } }],
    }),
    text: async () => JSON.stringify({
      choices: [{ message: { content: JSON.stringify(jsonContent) } }],
    }),
  } as unknown as Response;
}

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v;
  vi.restoreAllMocks();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('checkGrooming', () => {
  it('returns PASS verdicts when both photos pass', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchResponse({ pass: true, reason: 'Clean uniform', confidence: 0.92 })
    );
    const r = await checkGrooming('https://blob/uniform.jpg', 'https://blob/nails.jpg');
    expect(r.uniform.status).toBe('PASS');
    expect(r.uniform.confidence).toBe(0.92);
    expect(r.nails.status).toBe('PASS');
    expect(r.overallPass).toBe(true);
  });

  it('returns FAIL on one and PASS on the other; overallPass=false', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse({ pass: false, reason: 'Shirt not buttoned', confidence: 0.81 }))
      .mockResolvedValueOnce(mockFetchResponse({ pass: true, reason: 'Trimmed', confidence: 0.88 }));
    const r = await checkGrooming('https://blob/uniform.jpg', 'https://blob/nails.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.uniform.status).toBe('FAIL');
    expect(r.uniform.reason).toBe('Shirt not buttoned');
    expect(r.nails.status).toBe('PASS');
    expect(r.overallPass).toBe(false);
  });

  it('returns PENDING when the per-call timeout fires (AbortError)', async () => {
    process.env.AZURE_AI_FOUNDRY_TIMEOUT_MS = '50';
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) => new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      })
    );
    const r = await checkGrooming('https://blob/uniform.jpg', 'https://blob/nails.jpg');
    expect(r.uniform.status).toBe('PENDING');
    expect(r.nails.status).toBe('PENDING');
    expect(r.overallPass).toBe(false);
  });

  it('returns ERROR when the response JSON is unparseable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'not-json{{{' } }] }),
      text: async () => '...',
    } as unknown as Response);
    const r = await checkGrooming('https://blob/uniform.jpg', 'https://blob/nails.jpg');
    expect(r.uniform.status).toBe('ERROR');
    expect(r.nails.status).toBe('ERROR');
    expect(r.overallPass).toBe(false);
  });

  it('returns ERROR when the upstream call fails with a non-200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'internal error',
    } as unknown as Response);
    const r = await checkGrooming('https://blob/uniform.jpg', 'https://blob/nails.jpg');
    expect(r.uniform.status).toBe('ERROR');
    expect(r.nails.status).toBe('ERROR');
  });

  it('runs both calls in parallel (start times overlap)', async () => {
    let startCount = 0;
    let inFlightAtSecondStart = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => {
      startCount += 1;
      if (startCount === 2) inFlightAtSecondStart = startCount;
      setTimeout(() => resolve(mockFetchResponse({ pass: true, reason: 'ok', confidence: 0.9 })), 30);
    }));
    await checkGrooming('https://blob/uniform.jpg', 'https://blob/nails.jpg');
    expect(inFlightAtSecondStart).toBe(2); // both started before first resolved
  });
});
