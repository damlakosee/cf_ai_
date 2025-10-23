import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import worker from '../src';

// ✅ FIX: Declare the env types using ambient module declaration
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		AI: any;
		CHAT_HISTORY: DurableObjectNamespace;
		CHAT_SESSIONS: DurableObjectNamespace;
		WEATHER_API_KEY?: string;
		SEARCH_API_KEY?: string;
	}
}

describe('AI Chat Assistant Worker', () => {
	describe('GET /', () => {
		it('responds with HTML page (unit style)', async () => {
			const request = new Request('http://example.com/');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/html');
			const text = await response.text();
			expect(text).toContain('AI Chat Assistant');
			expect(text).toContain('<!DOCTYPE html>');
		});

		it('responds with HTML page (integration style)', async () => {
			const response = await SELF.fetch('http://example.com/');
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/html');
		});
	});

	describe('GET /index.html', () => {
		it('responds with HTML page (unit style)', async () => {
			const request = new Request('http://example.com/index.html');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/html');
		});
	});

	describe('OPTIONS /api/chat', () => {
		it('responds with CORS headers (unit style)', async () => {
			const request = new Request('http://example.com/api/chat', {
				method: 'OPTIONS'
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
		});

		it('responds with CORS headers (integration style)', async () => {
			const response = await SELF.fetch('http://example.com/api/chat', {
				method: 'OPTIONS'
			});
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		});
	});

	describe('POST /api/chat', () => {
		it('returns error when message and attachments are missing (unit style)', async () => {
			const request = new Request('http://example.com/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId: 'test-session' })
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(500);
			const data = await response.json() as any;
			expect(data.error).toBeDefined();
			expect(data.error).toContain('required');
		});

		it('handles valid chat request (integration style)', async () => {
			const response = await SELF.fetch('http://example.com/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: 'Hello AI',
					sessionId: 'test-session-123'
				})
			});

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain('application/json');
			const data = await response.json() as any;
			expect(data.response).toBeDefined();
			expect(data.sessionId).toBe('test-session-123');
		});
	});

	describe('GET /api/sessions', () => {
		it('responds with sessions (integration style)', async () => {
			const response = await SELF.fetch('http://example.com/api/sessions');
			expect(response.status).toBeLessThan(500);
			expect(response.headers.get('Content-Type')).toContain('application/json');
		});
	});

	describe('GET /api/history', () => {
		it('fetches chat history with sessionId (integration style)', async () => {
			const response = await SELF.fetch('http://example.com/api/history?sessionId=test-123');
			expect(response.status).toBeLessThan(500);
		});

		it('uses default sessionId if not provided (integration style)', async () => {
			const response = await SELF.fetch('http://example.com/api/history');
			expect(response.status).toBeLessThan(500);
		});
	});

	describe('DELETE /api/history', () => {
		it('clears chat history (integration style)', async () => {
			const response = await SELF.fetch('http://example.com/api/history?sessionId=test-456', {
				method: 'DELETE'
			});
			expect(response.status).toBeLessThan(500);
		});
	});

	describe('404 handling', () => {
		it('returns 404 for unknown routes (unit style)', async () => {
			const request = new Request('http://example.com/unknown-route');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
			expect(await response.text()).toBe('Not Found');
		});

		it('returns 404 for unknown routes (integration style)', async () => {
			const response = await SELF.fetch('http://example.com/unknown-route');
			expect(response.status).toBe(404);
		});
	});
});