import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    message: 'Test route working',
    offerId: params.id,
    url: request.url
  });
}
