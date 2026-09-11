export async function GET() {
  return new Response('ok', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': '2',
      'Cache-Control': 'no-cache',
    },
  });
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': '0',
    },
  });
}
