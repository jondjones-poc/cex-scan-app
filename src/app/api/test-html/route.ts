import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log(`Testing HTML fetch for URL: ${url}`);

    // Make the request server-side to bypass CORS
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-GB,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1"
      },
      redirect: "follow",
      method: "GET"
    });

    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText.substring(0, 2000)
      }, { status: response.status });
    }

    const html = await response.text();
    
    return NextResponse.json({
      success: true,
      status: response.status,
      url: response.url,
      htmlLength: html.length,
      htmlSample: html.substring(0, 5000),
      htmlEnd: html.substring(Math.max(0, html.length - 2000)),
      headers: Object.fromEntries(response.headers.entries())
    });

  } catch (error) {
    console.error("HTML fetch error:", error);
    return NextResponse.json({ 
      error: `Fetch error: ${(error as Error).message}`,
      success: false
    }, { status: 500 });
  }
}
