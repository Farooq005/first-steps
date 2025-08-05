# 🔧 OAuth Connection Troubleshooting Guide

## 🐛 Common OAuth Issues & Fixes

### Issue 1: Authentication Redirects But Doesn't Complete

**Symptoms:**
- App redirects to MAL/AniList correctly
- User approves access
- Redirects back to app but connection status shows "Not Connected"
- Console shows OAuth errors

**Causes & Solutions:**

1. **Client ID Mismatch**
   ```javascript
   // Check in browser console:
   console.log('Current Client IDs:', {
       mal: document.querySelector('script').textContent.match(/clientId.*?'([^']+)'/)?.[1],
       redirectUri: window.location.origin + window.location.pathname
   });
   ```
   
   **Fix:** Update client IDs in:
   - `src/api/malApi.js` → Line 6: `this.clientId = 'YOUR_ACTUAL_MAL_CLIENT_ID'`
   - `src/api/anilistApi.js` → Line 9: `this.clientId = 'YOUR_ACTUAL_ANILIST_CLIENT_ID'`

2. **Redirect URI Mismatch**
   ```
   Error: "invalid_request" or "redirect_uri_mismatch"
   ```
   
   **Fix:** Ensure exact match between:
   - App URL: `https://yoursite.github.io/anime-tracker-sync/`
   - MAL API Config redirect URI: `https://yoursite.github.io/anime-tracker-sync/`
   - AniList Developer Settings redirect URI: `https://yoursite.github.io/anime-tracker-sync/`
   
   **Note:** No trailing slash vs trailing slash matters!

3. **HTTPS Required**
   ```
   Error: "invalid_request" or mixed content warnings
   ```
   
   **Fix:** OAuth2 requires HTTPS. Use:
   - GitHub Pages (automatic HTTPS)
   - Netlify, Vercel (automatic HTTPS)
   - Custom domain with SSL certificate

### Issue 2: Code Exchange Fails

**Symptoms:**
- App receives OAuth code in URL
- Console shows "Failed to exchange code for token"
- Network tab shows 400/401 errors to token endpoint

**Debug Steps:**

1. **Check Console Logs**
   ```javascript
   // Open browser console during OAuth flow
   // Look for detailed error messages:
   "MAL OAuth Error: {status: 400, statusText: 'Bad Request', errorText: '...'}"
   ```

2. **Verify Code Verifier (MAL Only)**
   ```javascript
   // Check if code verifier exists:
   console.log('Code Verifier:', localStorage.getItem('mal_code_verifier'));
   ```
   
   **Fix:** If missing, clear storage and try again:
   ```javascript
   localStorage.clear();
   ```

3. **Check Network Requests**
   - Open Developer Tools → Network tab
   - Look for POST requests to token endpoints
   - Check request/response details

### Issue 3: Token Storage Issues

**Symptoms:**
- Authentication appears to work
- Page refresh shows "Not Connected" again
- Tokens not persisting

**Debug & Fix:**
```javascript
// Check stored tokens:
console.log('Stored Tokens:', {
    malToken: localStorage.getItem('mal_access_token'),
    malExpiry: localStorage.getItem('mal_expires_at'),
    anilistToken: localStorage.getItem('anilist_access_token'),
    anilistExpiry: localStorage.getItem('anilist_expires_at')
});

// Check if tokens are expired:
const malExpiry = parseInt(localStorage.getItem('mal_expires_at') || '0');
const anilistExpiry = parseInt(localStorage.getItem('anilist_expires_at') || '0');
console.log('Token Status:', {
    malExpired: Date.now() >= malExpiry,
    anilistExpired: Date.now() >= anilistExpiry,
    now: Date.now()
});
```

## 🛠️ Step-by-Step OAuth Setup

### 1. MAL API Setup
1. Go to [MAL API Config](https://myanimelist.net/apiconfig)
2. Click "Create App"
3. Fill in details:
   - **App Name**: Your app name
   - **Description**: Brief description
   - **App Type**: Web
   - **Redirect URI**: `https://yourdomain.com/path/` (exact match!)
4. Submit and get your Client ID
5. Update `src/api/malApi.js`:
   ```javascript
   this.clientId = 'YOUR_CLIENT_ID_HERE';
   ```

### 2. AniList API Setup
1. Go to [AniList Developer Settings](https://anilist.co/settings/developer)
2. Click "Create Client"
3. Fill in details:
   - **Name**: Your app name
   - **Redirect URI**: `https://yourdomain.com/path/` (exact match!)
4. Save and get your Client ID
5. Update `src/api/anilistApi.js`:
   ```javascript
   this.clientId = 'YOUR_CLIENT_ID_HERE';
   ```

### 3. Testing OAuth Flow

1. **Test Locally First** (if possible with localhost redirect)
2. **Check Browser Console** for detailed error messages
3. **Verify URLs** match exactly in API configs
4. **Test Both Platforms** separately

## 🔍 Debug Information

The app includes comprehensive debug information in the Settings tab:

```javascript
// Access debug info programmatically:
console.log('Debug Info:', getDebugInfo());
```

Key debug fields:
- `hasOAuthCode`: Whether OAuth code is in URL
- `oauthPlatform`: Which platform is being authenticated
- `malAuthenticated`/`anilistAuthenticated`: Current auth status
- `localStorage`: Token storage status

## 📞 Common Error Messages

### MAL Errors
```
"invalid_request": Check redirect URI and client ID
"invalid_client": Client ID incorrect
"invalid_grant": Code expired or already used
"unsupported_grant_type": Should be "authorization_code"
```

### AniList Errors
```
"invalid_request": Check redirect URI format
"invalid_client": Client ID or secret incorrect
"invalid_grant": Authorization code invalid
```

## ✅ Verification Checklist

Before reporting OAuth issues:

- [ ] Client IDs updated in code files
- [ ] Redirect URIs match exactly (including trailing slash)
- [ ] HTTPS is working (not HTTP)
- [ ] No browser extensions blocking requests
- [ ] Console shows detailed error messages
- [ ] Network tab shows OAuth request/response
- [ ] localStorage is not disabled
- [ ] Using latest version of app code

## 🆘 Still Having Issues?

1. **Check Browser Console** - Most issues show detailed error messages
2. **Try Incognito Mode** - Eliminates extension interference
3. **Test Different Browser** - Verify it's not browser-specific
4. **Clear Storage** - `localStorage.clear()` and try again
5. **Check API Status** - Verify MAL/AniList APIs are operational

## 📋 Quick Debug Commands

Paste these in browser console for quick debugging:

```javascript
// Clear all auth data and restart
localStorage.clear(); window.location.reload();

// Check current auth status
console.log('Auth Status:', {
  mal: app.syncService?.isMALAuthenticated(),
  anilist: app.syncService?.isAniListAuthenticated()
});

// Check stored tokens
Object.keys(localStorage).filter(k => k.includes('token') || k.includes('expires')).forEach(k => console.log(k, localStorage.getItem(k)));

// Test auth methods
app.syncService.authenticateMAL(); // Test MAL auth
app.syncService.authenticateAniList(); // Test AniList auth
```