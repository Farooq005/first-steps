// Netlify Function: OAuth Proxy
// Handles OAuth token exchange server-side to bypass CORS restrictions

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const { platform, code, clientId, clientSecret, redirectUri, codeVerifier } = JSON.parse(event.body || '{}');

    if (!platform || !code || !clientId || !redirectUri) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    let tokenUrl;
    let body;
    let headers;

    if (platform === 'mal') {
      tokenUrl = 'https://myanimelist.net/v1/oauth2/token';
      body = new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }).toString();
      headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    } else if (platform === 'anilist') {
      tokenUrl = 'https://anilist.co/api/v2/oauth/token';
      const resolvedSecret = clientSecret || process.env.ANILIST_CLIENT_SECRET || undefined;
      const payload = {
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code
      };
      if (resolvedSecret) payload.client_secret = resolvedSecret;
      body = JSON.stringify(payload);
      headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    } else {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Invalid platform' }) };
    }

    const response = await fetch(tokenUrl, { method: 'POST', headers, body });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: `OAuth Error: ${response.status} ${response.statusText} - ${errorText}` })
      };
    }

    const tokenData = await response.json();

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, data: tokenData }) };
  } catch (error) {
    console.error('OAuth Proxy Error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message }) };
  }
};