# OAuth Proxy Deployment Guide

## Overview
This serverless function handles OAuth token exchange server-side to bypass CORS restrictions on GitHub Pages.

## Deployment Options

### Option 1: Netlify Functions (Recommended)

1. **Create a new Netlify site:**
   ```bash
   # Create a new directory for the OAuth proxy
   mkdir oauth-proxy
   cd oauth-proxy
   ```

2. **Create the function file:**
   ```bash
   mkdir -p netlify/functions
   # Copy oauth-proxy.js to netlify/functions/oauth-proxy.js
   ```

3. **Create netlify.toml:**
   ```toml
   [build]
     functions = "netlify/functions"
   
   [[headers]]
     for = "/*"
     [headers.values]
       Access-Control-Allow-Origin = "*"
       Access-Control-Allow-Headers = "Content-Type"
       Access-Control-Allow-Methods = "POST, OPTIONS"
   ```

4. **Deploy to Netlify:**
   - Connect your GitHub repo to Netlify
   - Set build command: `echo "No build required"`
   - Set publish directory: `.`
   - Deploy

5. **Update the proxy URL in your app:**
   - Replace `https://your-oauth-proxy.netlify.app/.netlify/functions/oauth-proxy` 
   - With your actual Netlify function URL

### Option 2: Vercel Functions

1. **Create a new Vercel project:**
   ```bash
   mkdir oauth-proxy
   cd oauth-proxy
   npm init -y
   npm install @vercel/node
   ```

2. **Create the function:**
   ```bash
   mkdir -p api
   # Copy oauth-proxy.js to api/oauth-proxy.js
   ```

3. **Create vercel.json:**
   ```json
   {
     "functions": {
       "api/oauth-proxy.js": {
         "maxDuration": 10
       }
     },
     "headers": [
       {
         "source": "/api/(.*)",
         "headers": [
           { "key": "Access-Control-Allow-Origin", "value": "*" },
           { "key": "Access-Control-Allow-Headers", "value": "Content-Type" },
           { "key": "Access-Control-Allow-Methods", "value": "POST, OPTIONS" }
         ]
       }
     ]
   }
   ```

4. **Deploy to Vercel:**
   ```bash
   npx vercel
   ```

5. **Update the proxy URL in your app:**
   - Replace the proxy URL with your Vercel function URL

### Option 3: Cloudflare Workers

1. **Create a new Cloudflare Workers project:**
   ```bash
   npm create cloudflare@latest oauth-proxy
   ```

2. **Replace src/index.js with the OAuth proxy code:**
   ```javascript
   // Convert the Netlify function to Cloudflare Workers format
   export default {
     async fetch(request, env, ctx) {
       // Handle CORS
       if (request.method === 'OPTIONS') {
         return new Response(null, {
           status: 200,
           headers: {
             'Access-Control-Allow-Origin': '*',
             'Access-Control-Allow-Headers': 'Content-Type',
             'Access-Control-Allow-Methods': 'POST, OPTIONS'
           }
         });
       }

       // Handle OAuth requests
       if (request.method === 'POST') {
         const data = await request.json();
         // ... rest of the OAuth logic
       }
     }
   };
   ```

3. **Deploy:**
   ```bash
   npx wrangler deploy
   ```

## Security Considerations

1. **Rate Limiting:** Consider adding rate limiting to prevent abuse
2. **Validation:** Validate all input parameters
3. **Logging:** Add proper logging for debugging
4. **Environment Variables:** Store sensitive data in environment variables

## Testing

Test the function with curl:
```bash
curl -X POST https://your-function-url.netlify.app/.netlify/functions/oauth-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "mal",
    "code": "test_code",
    "clientId": "test_client_id",
    "redirectUri": "https://example.com",
    "codeVerifier": "test_verifier"
  }'
```

## Troubleshooting

1. **CORS Issues:** Ensure CORS headers are properly set
2. **Function Timeout:** Increase timeout if needed
3. **Memory Limits:** Monitor function memory usage
4. **Network Issues:** Check if the function can reach OAuth endpoints