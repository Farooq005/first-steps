// OAuth Proxy Serverless Function
// This handles OAuth token exchange server-side to bypass CORS restrictions

exports.handler = async (event, context) => {
    // Enable CORS for the function
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const { platform, code, clientId, clientSecret, redirectUri, codeVerifier } = JSON.parse(event.body);

        let tokenUrl, body, headers;

        if (platform === 'mal') {
            // MyAnimeList OAuth
            tokenUrl = 'https://myanimelist.net/v1/oauth2/token';
            body = new URLSearchParams({
                client_id: clientId,
                code: code,
                code_verifier: codeVerifier,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            }).toString();
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded'
            };
        } else if (platform === 'anilist') {
            // AniList OAuth
            tokenUrl = 'https://anilist.co/api/v2/oauth/token';
            body = JSON.stringify({
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code: code
            });
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
        } else {
            throw new Error('Invalid platform');
        }

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers,
            body
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OAuth Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const tokenData = await response.json();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: tokenData
            })
        };

    } catch (error) {
        console.error('OAuth Proxy Error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};