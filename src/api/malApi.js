// MyAnimeList API Service
// Handles all MAL API interactions with OAuth2 authentication

class MALApiService {
    constructor() {
        this.baseUrl = 'https://api.myanimelist.net/v2';
        this.clientId = '7d40aab44a745bbefc83c9df14413f86'; // Replace with your actual client ID
        // Use full URL for GitHub Pages compatibility
        this.redirectUri = window.location.href.split('?')[0]; // Remove query parameters
        this.rateLimit = {
            requestsPerSecond: 1,
            lastRequestTime: 0
        };
        
        // Debug OAuth configuration
        console.log('MAL OAuth Configuration:', {
            clientId: this.clientId,
            redirectUri: this.redirectUri,
            currentUrl: window.location.href,
            origin: window.location.origin,
            pathname: window.location.pathname
        });
    }

    // OAuth2 Authentication
    async authenticate() {
        const authUrl = `https://myanimelist.net/v1/oauth2/authorize?` +
            `response_type=code&` +
            `client_id=${this.clientId}&` +
            `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
            `code_challenge=${await this.generateCodeChallenge()}&` +
            `code_challenge_method=S256&` +
            `scope=read write`;
        
        window.location.href = authUrl;
    }

    // Generate PKCE code challenge
    async generateCodeChallenge() {
        const codeVerifier = this.generateCodeVerifier();
        localStorage.setItem('mal_code_verifier', codeVerifier);
        
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    generateCodeVerifier() {
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    // Exchange authorization code for access token
    async exchangeCodeForToken(code) {
        const codeVerifier = localStorage.getItem('mal_code_verifier');
        
        console.log('MAL OAuth: Exchanging code for token...', {
            clientId: this.clientId,
            redirectUri: this.redirectUri,
            hasCodeVerifier: !!codeVerifier,
            codeLength: code?.length
        });
        
        if (!codeVerifier) {
            throw new Error('Code verifier not found. Please try authenticating again.');
        }

        // Use serverless OAuth proxy to bypass CORS
        const proxyUrl = 'https://your-oauth-proxy.netlify.app/.netlify/functions/oauth-proxy';
        
        try {
            console.log('Using OAuth proxy for token exchange...');
            
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platform: 'mal',
                    code: code,
                    clientId: this.clientId,
                    redirectUri: this.redirectUri,
                    codeVerifier: codeVerifier
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('OAuth Proxy Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText
                });
                throw new Error(`OAuth proxy failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(`OAuth failed: ${result.error}`);
            }

            console.log('MAL OAuth: Token exchange successful via proxy');
            this.storeTokens(result.data);
            return result.data;
            
        } catch (error) {
            console.error('MAL OAuth Error:', error);
            throw new Error(`OAuth token exchange failed: ${error.message}`);
        }
    }

    // Store tokens securely
    storeTokens(tokenData) {
        const expiresAt = Date.now() + (tokenData.expires_in * 1000);
        
        localStorage.setItem('mal_access_token', tokenData.access_token);
        localStorage.setItem('mal_refresh_token', tokenData.refresh_token);
        localStorage.setItem('mal_expires_at', expiresAt.toString());
    }

    // Get valid access token (refresh if needed)
    async getValidToken() {
        const accessToken = localStorage.getItem('mal_access_token');
        const refreshToken = localStorage.getItem('mal_refresh_token');
        const expiresAt = parseInt(localStorage.getItem('mal_expires_at') || '0');

        if (!accessToken) {
            throw new Error('No access token available. Please authenticate first.');
        }

        // Check if token is expired
        if (Date.now() >= expiresAt - 60000) { // Refresh 1 minute before expiry
            if (!refreshToken) {
                throw new Error('Token expired and no refresh token available. Please re-authenticate.');
            }
            return await this.refreshToken(refreshToken);
        }

        return accessToken;
    }

    // Refresh access token
    async refreshToken(refreshToken) {
        const response = await fetch('https://myanimelist.net/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: this.clientId,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) {
            localStorage.removeItem('mal_access_token');
            localStorage.removeItem('mal_refresh_token');
            localStorage.removeItem('mal_expires_at');
            throw new Error('Failed to refresh token. Please re-authenticate.');
        }

        const tokenData = await response.json();
        this.storeTokens(tokenData);
        return tokenData.access_token;
    }

    // Rate limiting helper
    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.rateLimit.lastRequestTime;
        const minInterval = 1000 / this.rateLimit.requestsPerSecond;

        if (timeSinceLastRequest < minInterval) {
            await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
        }

        this.rateLimit.lastRequestTime = Date.now();
    }

    // Make authenticated API request
    async makeRequest(endpoint, options = {}) {
        await this.enforceRateLimit();
        
        const token = await this.getValidToken();
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('mal_access_token');
                localStorage.removeItem('mal_refresh_token');
                localStorage.removeItem('mal_expires_at');
                throw new Error('Authentication failed. Please re-authenticate.');
            }
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    // Get user's anime list
    async getUserAnimeList(username = '@me', limit = 1000, offset = 0) {
        const allAnime = [];
        let hasMore = true;
        let currentOffset = offset;

        while (hasMore && allAnime.length < 10000) { // Safety limit
            const endpoint = `/users/${username}/animelist?` +
                `fields=list_status,num_episodes,start_date,finish_date,score,tags,comments,updated_at&` +
                `limit=${Math.min(limit, 1000)}&` +
                `offset=${currentOffset}&` +
                `sort=list_updated_at`;

            try {
                const response = await this.makeRequest(endpoint);
                
                if (response.data && response.data.length > 0) {
                    allAnime.push(...response.data);
                    currentOffset += response.data.length;
                    
                    // Check if we have more data
                    hasMore = response.paging && response.paging.next;
                } else {
                    hasMore = false;
                }
            } catch (error) {
                console.error('Error fetching anime list:', error);
                throw error;
            }
        }

        return allAnime.map(item => ({
            id: item.node.id,
            title: item.node.title,
            status: item.list_status.status,
            score: item.list_status.score || 0,
            progress: item.list_status.num_episodes_watched || 0,
            total_episodes: item.node.num_episodes || 0,
            start_date: item.list_status.start_date,
            finish_date: item.list_status.finish_date,
            updated_at: item.list_status.updated_at,
            tags: item.list_status.tags || [],
            comments: item.list_status.comments || '',
            platform: 'mal'
        }));
    }

    // Get user's manga list
    async getUserMangaList(username = '@me', limit = 1000, offset = 0) {
        const allManga = [];
        let hasMore = true;
        let currentOffset = offset;

        while (hasMore && allManga.length < 10000) { // Safety limit
            const endpoint = `/users/${username}/mangalist?` +
                `fields=list_status,num_chapters,num_volumes,start_date,finish_date,score,tags,comments,updated_at&` +
                `limit=${Math.min(limit, 1000)}&` +
                `offset=${currentOffset}&` +
                `sort=list_updated_at`;

            try {
                const response = await this.makeRequest(endpoint);
                
                if (response.data && response.data.length > 0) {
                    allManga.push(...response.data);
                    currentOffset += response.data.length;
                    
                    // Check if we have more data
                    hasMore = response.paging && response.paging.next;
                } else {
                    hasMore = false;
                }
            } catch (error) {
                console.error('Error fetching manga list:', error);
                throw error;
            }
        }

        return allManga.map(item => ({
            id: item.node.id,
            title: item.node.title,
            status: item.list_status.status,
            score: item.list_status.score || 0,
            progress_chapters: item.list_status.num_chapters_read || 0,
            progress_volumes: item.list_status.num_volumes_read || 0,
            total_chapters: item.node.num_chapters || 0,
            total_volumes: item.node.num_volumes || 0,
            start_date: item.list_status.start_date,
            finish_date: item.list_status.finish_date,
            updated_at: item.list_status.updated_at,
            tags: item.list_status.tags || [],
            comments: item.list_status.comments || '',
            platform: 'mal'
        }));
    }

    // Add anime to user's list
    async addAnimeToList(animeId, listData) {
        const endpoint = `/anime/${animeId}/my_list_status`;
        
        const body = {
            status: listData.status,
            ...(listData.score && { score: listData.score }),
            ...(listData.progress && { num_episodes_watched: listData.progress }),
            ...(listData.start_date && { start_date: listData.start_date }),
            ...(listData.finish_date && { finish_date: listData.finish_date }),
            ...(listData.tags && { tags: listData.tags.join(',') }),
            ...(listData.comments && { comments: listData.comments })
        };

        return await this.makeRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    // Add manga to user's list
    async addMangaToList(mangaId, listData) {
        const endpoint = `/manga/${mangaId}/my_list_status`;
        
        const body = {
            status: listData.status,
            ...(listData.score && { score: listData.score }),
            ...(listData.progress_chapters && { num_chapters_read: listData.progress_chapters }),
            ...(listData.progress_volumes && { num_volumes_read: listData.progress_volumes }),
            ...(listData.start_date && { start_date: listData.start_date }),
            ...(listData.finish_date && { finish_date: listData.finish_date }),
            ...(listData.tags && { tags: listData.tags.join(',') }),
            ...(listData.comments && { comments: listData.comments })
        };

        return await this.makeRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    // Check authentication status
    isAuthenticated() {
        const token = localStorage.getItem('mal_access_token');
        const expiresAt = parseInt(localStorage.getItem('mal_expires_at') || '0');
        return token && Date.now() < expiresAt;
    }

    // Logout
    logout() {
        localStorage.removeItem('mal_access_token');
        localStorage.removeItem('mal_refresh_token');
        localStorage.removeItem('mal_expires_at');
        localStorage.removeItem('mal_code_verifier');
    }
}

// Export the service
window.MALApiService = MALApiService;