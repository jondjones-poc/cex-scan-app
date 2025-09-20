import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    
    if (!imageUrl) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
    }

    // Validate that it's a CEX image URL for security
    if (!imageUrl.includes('uk.static.webuy.com') && !imageUrl.includes('webuy.com')) {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }

    // Fetch the image from CEX
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CeX-Monitor/0.1; +https://example.local)',
        'Referer': 'https://uk.webuy.com/'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: response.status });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return the image with no caching
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate', // No caching
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error("Image proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
