import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('id') || '4974365615789AB';
  
  try {
    // Check API
    const apiUrl = `https://api.webuy.com/api/v2/boxes/${encodeURIComponent(productId)}`;
    const apiResponse = await fetch(apiUrl, {
      headers: {
        "accept": "application/json",
        "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1)",
      },
      cache: "no-store"
    });
    
    let apiData = null;
    if (apiResponse.ok) {
      apiData = await apiResponse.json();
    }
    
    // Check HTML page
    const productUrl = `https://uk.webuy.com/product-detail/?id=${encodeURIComponent(productId)}`;
    const htmlResponse = await fetch(productUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CeX-Monitor/0.1)",
        "accept": "text/html",
      },
      cache: "no-store"
    });
    
    let html = '';
    let storeMatches: string[] = [];
    if (htmlResponse.ok) {
      html = await htmlResponse.text();
      
      // Look for store-related content
      const storeKeywords = ['store', 'location', 'branch', 'available at', 'collect from'];
      storeKeywords.forEach(keyword => {
        const regex = new RegExp(`.{0,200}${keyword}.{0,200}`, 'gi');
        const matches = html.match(regex);
        if (matches) {
          storeMatches.push(...matches.slice(0, 5));
        }
      });
      
      // Look for script tags with store data
      const scriptMatches = html.match(/<script[^>]*>([\s\S]{0,5000})<\/script>/gi);
      const scriptStoreData: string[] = [];
      if (scriptMatches) {
        scriptMatches.forEach(script => {
          if (script.toLowerCase().includes('store') || script.toLowerCase().includes('location')) {
            scriptStoreData.push(script.substring(0, 1000));
          }
        });
      }
      
      return NextResponse.json({
        productId,
        apiData: apiData ? {
          hasData: true,
          boxKeys: apiData?.response?.data?.boxDetails?.[0] ? Object.keys(apiData.response.data.boxDetails[0]) : [],
          boxSample: apiData?.response?.data?.boxDetails?.[0] ? 
            JSON.stringify(apiData.response.data.boxDetails[0]).substring(0, 2000) : null,
          fullResponse: apiData
        } : { hasData: false },
        html: {
          length: html.length,
          storeMatches: storeMatches.slice(0, 10),
          scriptStoreData: scriptStoreData.slice(0, 3),
          sample: html.substring(0, 5000)
        }
      });
    }
    
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
