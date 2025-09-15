// Simple test script to debug the API
const testUrl = 'https://uk.webuy.com/search/?categoryIds=1052&sortBy=prod_cex_uk_price_desc&stores=Boscombe~Bournemouth~Bournemouth+-+Castlepoint~Poole';

async function testAPI() {
  try {
    console.log('Testing API with URL:', testUrl);
    
    const response = await fetch('http://localhost:3000/api/scrape-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        url: testUrl, 
        showAllProducts: true 
      })
    });
    
    const result = await response.json();
    console.log('API Response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testAPI();
