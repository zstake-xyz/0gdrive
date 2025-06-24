import { NextRequest, NextResponse } from 'next/server';

// Allowed domains for CORS
const ALLOWED_ORIGINS = [
  'https://0gdrive.zstake.xyz',
  'https://0gdrive.test.zstake.xyz',
  'http://localhost:3000',
  'http://localhost:3333'
];

// Validate origin
function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const url = request.nextUrl.searchParams.get('url');
    const origin = request.headers.get('origin');
    
    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Validate origin
    if (origin && !isAllowedOrigin(origin)) {
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...request.headers,
      },
      body: body,
    });

    const responseText = await response.text();
    
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');
    const origin = request.headers.get('origin');
    
    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Validate origin
    if (origin && !isAllowedOrigin(origin)) {
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...request.headers,
      },
    });

    const responseText = await response.text();
    
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
} 