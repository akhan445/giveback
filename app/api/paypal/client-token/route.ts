import { NextResponse } from 'next/server';

// The v6 JS SDK needs a short-lived, browser-safe token. It is minted here so the
// client secret never leaves the server.
export async function GET() {
  const { PAYPAL_CLIENT_ID: id, PAYPAL_SECRET: secret } = process.env;
  if (!id || !secret) return NextResponse.json({ error: 'PayPal is not configured' }, { status: 500 });

  const res = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&response_type=client_token&intent=sdk_init',
    cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json({ error: 'could not get client token' }, { status: 502 });

  const { access_token } = (await res.json()) as { access_token: string };
  return NextResponse.json({ clientToken: access_token });
}
