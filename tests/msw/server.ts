import { setupServer } from 'msw/node';
import { http } from 'msw';

// Placeholder MSW server for Gate G-B integration tests.
// Handlers will be extended as features mature; for now every request
// returns 501 so the suite fails until the real API contract is wired.
export const server = setupServer(
  http.all('*', ({ request }) => {
    return new Response(
      JSON.stringify({
        error: 'handler not implemented',
        method: request.method,
        url: request.url,
      }),
      { status: 501, headers: { 'Content-Type': 'application/json' } },
    );
  }),
);
