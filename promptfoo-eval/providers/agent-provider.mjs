/**
 * Custom promptfoo provider that tests the running LLM agent end-to-end.
 *
 * Creates a demo session, sends a chat message via SSE, auto-approves
 * any wallet/login modals, and collects the streamed response.
 *
 * Config options:
 *   mode: 'jwt-only' | 'vc-protected'  (default: 'jwt-only')
 *   baseUrl: string                      (default: 'http://localhost:3000')
 *   persona: 'alice' | 'attacker'        (default: 'alice')
 */

export default class AgentProvider {
  constructor(options) {
    this.mode = options.config?.mode || 'jwt-only';
    this.baseUrl = options.config?.baseUrl || 'http://localhost:3000';
    this.persona = options.config?.persona || 'alice';
    this.label = options.config?.label || `Agent (${this.mode})`;
  }

  id() {
    return `agent:${this.mode}:${this.persona}`;
  }

  async callApi(prompt) {
    let sessionId;

    try {
      // 1. Create session
      const sessionRes = await fetch(`${this.baseUrl}/api/agent/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: this.mode, persona: this.persona }),
      });

      if (!sessionRes.ok) {
        return { error: `Session creation failed: ${sessionRes.status} ${await sessionRes.text()}` };
      }

      const session = await sessionRes.json();
      sessionId = session.sessionId;

      // 2. Send chat message — response is SSE stream
      const chatRes = await fetch(`${this.baseUrl}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, sessionId }),
      });

      if (!chatRes.ok) {
        return { error: `Chat failed: ${chatRes.status} ${await chatRes.text()}` };
      }

      // 3. Read SSE stream incrementally, auto-approving modals
      const messages = [];
      const toolCalls = [];
      const artifacts = [];
      let ceilingDenied = false;

      const reader = chatRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse complete SSE events (separated by double newline)
        while (buffer.includes('\n\n')) {
          const eventEnd = buffer.indexOf('\n\n');
          const eventBlock = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          let eventType = '';
          let eventData = '';
          for (const line of eventBlock.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7);
            if (line.startsWith('data: ')) eventData += line.slice(6);
          }

          // Auto-approve login modal (jwt-only auth-on-401 flow)
          if (eventType === 'login_required') {
            await fetch(`${this.baseUrl}/api/agent/chat/login-approved`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            });
          }

          // Auto-approve wallet modal (vc-protected flow)
          if (eventType === 'wallet_approval_required') {
            await fetch(`${this.baseUrl}/api/agent/chat/wallet-approved`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            });
          }

          // Collect messages
          if (eventType === 'message' && eventData) {
            try {
              const parsed = JSON.parse(eventData);
              messages.push(parsed.content);
              if (parsed.content.includes('DENIED') || parsed.content.includes('Exceeds ceiling')) {
                ceilingDenied = true;
              }
            } catch { /* skip malformed */ }
          }

          // Collect tool call results
          if (eventType === 'tool_call_result' && eventData) {
            try {
              toolCalls.push(JSON.parse(eventData));
            } catch { /* skip */ }
          }

          // Collect artifacts
          if (eventType === 'artifact_update' && eventData) {
            try {
              artifacts.push(JSON.parse(eventData));
            } catch { /* skip */ }
          }
        }
      }

      const output = messages.join('\n\n');

      return {
        output: output || '(no response)',
        metadata: {
          mode: this.mode,
          persona: this.persona,
          sessionId,
          toolCallCount: toolCalls.length,
          artifactCount: artifacts.length,
          ceilingDenied,
          toolCalls,
        },
      };
    } catch (err) {
      return { error: `Provider error: ${err.message}` };
    } finally {
      // Clean up session
      if (sessionId) {
        try {
          await fetch(`${this.baseUrl}/api/agent/session/${sessionId}`, {
            method: 'DELETE',
          });
        } catch { /* best effort */ }
      }
    }
  }
}
