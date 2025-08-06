// AniList API Service
// Handles all AniList API interactions with OAuth2 authentication and GraphQL

class AniListApiService {
    constructor() {
        this.baseUrl = 'https://graphql.anilist.co';
        this.tokenUrl = 'https://anilist.co/api/v2/oauth/token';
        this.clientId = '29038'; // Replace with your actual client ID
        this.clientSecret = 'your_client_secret'; // Replace with your actual client secret
        // Use full URL for GitHub Pages compatibility
        this.redirectUri = 'https://first-steps-cy4.pages.dev/'; // Cloudflare Pages deployment URL
        
        this.rateLimit = {
            requestsPerMinute: 90,
            requests: [],
            lastCleanup: 0
        };
        
        // Debug OAuth configuration
        console.log('AniList OAuth Configuration:', {
            clientId: this.clientId,
            redirectUri: this.redirectUri,
            currentUrl: window.location.href,
            origin: window.location.origin,
            pathname: window.location.pathname
        });
    }

    // OAuth2 Authentication
    async authenticate() {
        const authUrl = `https://anilist.co/api/v2/oauth/authorize?` +
            `client_id=${this.clientId}&` +
            `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
            `response_type=code`;
        
        window.location.href = authUrl;
    }

    // Exchange authorization code for access token
    async exchangeCodeForToken(code) {
        console.log('AniList OAuth: Exchanging code for token...', {
            clientId: this.clientId,
            redirectUri: this.redirectUri,
            codeLength: code?.length
        });
        
        // Use your Netlify Function for real OAuth token exchange
        const proxyUrl = 'https://anime-list-sync.netlify.app/.netlify/functions/oauth-proxy';
        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platform: 'anilist',
                    code: code,
                    clientId: this.clientId,
                    clientSecret: this.clientSecret,
                    redirectUri: this.redirectUri
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OAuth proxy failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(`OAuth failed: ${result.error}`);
            }
            this.storeTokens(result.data);
            return result.data;
        } catch (error) {
            console.error('AniList OAuth Error:', error);
            throw new Error(`OAuth token exchange failed: ${error.message}`);
        }
    }

    // Store tokens securely
    storeTokens(tokenData) {
        const expiresAt = Date.now() + (tokenData.expires_in * 1000);
        
        localStorage.setItem('anilist_access_token', tokenData.access_token);
        localStorage.setItem('anilist_expires_at', expiresAt.toString());
    }

    // Get valid access token
    async getValidToken() {
        const accessToken = localStorage.getItem('anilist_access_token');
        const expiresAt = parseInt(localStorage.getItem('anilist_expires_at') || '0');

        if (!accessToken) {
            throw new Error('No access token available. Please authenticate first.');
        }

        if (Date.now() >= expiresAt) {
            localStorage.removeItem('anilist_access_token');
            localStorage.removeItem('anilist_expires_at');
            throw new Error('Token expired. Please re-authenticate.');
        }

        return accessToken;
    }

    // Rate limiting for AniList (90 requests per minute)
    async enforceRateLimit() {
        const now = Date.now();
        
        // Clean up old requests (older than 1 minute)
        if (now - this.rateLimit.lastCleanup > 10000) { // Cleanup every 10 seconds
            this.rateLimit.requests = this.rateLimit.requests.filter(
                timestamp => now - timestamp < 60000
            );
            this.rateLimit.lastCleanup = now;
        }

        // Check if we're at the rate limit
        if (this.rateLimit.requests.length >= this.rateLimit.requestsPerMinute) {
            const oldestRequest = Math.min(...this.rateLimit.requests);
            const waitTime = 60000 - (now - oldestRequest) + 1000; // Add 1 second buffer
            
            if (waitTime > 0) {
                console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        this.rateLimit.requests.push(now);
    }

    // Make GraphQL request
    async makeGraphQLRequest(query, variables = {}) {
        await this.enforceRateLimit();
        
        const token = await this.getValidToken();

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: query,
                variables: variables
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('anilist_access_token');
                localStorage.removeItem('anilist_expires_at');
                throw new Error('Authentication failed. Please re-authenticate.');
            }
            throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.errors) {
            console.error('GraphQL errors:', result.errors);
            throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
        }

        return result.data;
    }

    // Get user's anime list using GraphQL (no OAuth required for public data)
    async getUserAnimeList(username) {
        console.log(`Fetching AniList anime list for user: ${username}`);
        
        const query = `
            query ($username: String) {
                MediaListCollection(userName: $username, type: ANIME) {
                    lists {
                        entries {
                            id
                            mediaId
                            status
                            score
                            progress
                            media {
                                id
                                title {
                                    userPreferred
                                }
                                episodes
                                startDate {
                                    year
                                    month
                                    day
                                }
                                endDate {
                                    year
                                    month
                                    day
                                }
                            }
                            startedAt {
                                year
                                month
                                day
                            }
                            completedAt {
                                year
                                month
                                day
                            }
                            notes
                            customLists
                        }
                    }
                }
            }
        `;

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: { username }
                })
            });

            if (!response.ok) {
                throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.errors) {
                throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
            }

            const animeList = [];
            
            if (result.data?.MediaListCollection?.lists) {
                result.data.MediaListCollection.lists.forEach(list => {
                    if (list.entries) {
                        animeList.push(...list.entries.map(item => ({
                            id: item.mediaId,
                            title: item.media.title.userPreferred,
                            status: item.status.toLowerCase(),
                            score: item.score || 0,
                            progress: item.progress || 0,
                            total_episodes: item.media.episodes || 0,
                            start_date: this.formatDate(item.startedAt),
                            finish_date: this.formatDate(item.completedAt),
                            notes: item.notes || '',
                            tags: item.customLists || [],
                            platform: 'anilist'
                        })));
                    }
                });
            }
            
            console.log(`Fetched ${animeList.length} anime from AniList`);
            return animeList;
            
        } catch (error) {
            console.error('Error fetching AniList anime list:', error);
            throw new Error(`Failed to fetch AniList anime list: ${error.message}`);
        }
    }

    // Get user's manga list using GraphQL (no OAuth required for public data)
    async getUserMangaList(username) {
        console.log(`Fetching AniList manga list for user: ${username}`);
        
        const query = `
            query ($username: String) {
                MediaListCollection(userName: $username, type: MANGA) {
                    lists {
                        entries {
                            id
                            mediaId
                            status
                            score
                            progress
                            progressVolumes
                            media {
                                id
                                title {
                                    userPreferred
                                }
                                chapters
                                volumes
                                startDate {
                                    year
                                    month
                                    day
                                }
                                endDate {
                                    year
                                    month
                                    day
                                }
                            }
                            startedAt {
                                year
                                month
                                day
                            }
                            completedAt {
                                year
                                month
                                day
                            }
                            notes
                            customLists
                        }
                    }
                }
            }
        `;

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: { username }
                })
            });

            if (!response.ok) {
                throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.errors) {
                throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
            }

            const mangaList = [];
            
            if (result.data?.MediaListCollection?.lists) {
                result.data.MediaListCollection.lists.forEach(list => {
                    if (list.entries) {
                        mangaList.push(...list.entries.map(item => ({
                            id: item.mediaId,
                            title: item.media.title.userPreferred,
                            status: item.status.toLowerCase(),
                            score: item.score || 0,
                            progress_chapters: item.progress || 0,
                            progress_volumes: item.progressVolumes || 0,
                            total_chapters: item.media.chapters || 0,
                            total_volumes: item.media.volumes || 0,
                            start_date: this.formatDate(item.startedAt),
                            finish_date: this.formatDate(item.completedAt),
                            notes: item.notes || '',
                            tags: item.customLists || [],
                            platform: 'anilist'
                        })));
                    }
                });
            }
            
            console.log(`Fetched ${mangaList.length} manga from AniList`);
            return mangaList;
            
        } catch (error) {
            console.error('Error fetching AniList manga list:', error);
            throw new Error(`Failed to fetch AniList manga list: ${error.message}`);
        }
    }

    // Search for anime by title
    async searchAnime(title) {
        const query = `
            query ($search: String) {
                Media(search: $search, type: ANIME) {
                    id
                    title {
                        romaji
                        english
                        native
                    }
                    episodes
                    status
                }
            }
        `;

        try {
            const data = await this.makeGraphQLRequest(query, { search: title });
            return data.Media;
        } catch (error) {
            console.error('Error searching anime:', error);
            return null;
        }
    }

    // Search for manga by title
    async searchManga(title) {
        const query = `
            query ($search: String) {
                Media(search: $search, type: MANGA) {
                    id
                    title {
                        romaji
                        english
                        native
                    }
                    chapters
                    volumes
                    status
                }
            }
        `;

        try {
            const data = await this.makeGraphQLRequest(query, { search: title });
            return data.Media;
        } catch (error) {
            console.error('Error searching manga:', error);
            return null;
        }
    }

    // Add anime to user's list
    async addAnimeToList(mediaId, listData) {
        const query = `
            mutation ($mediaId: Int, $status: MediaListStatus, $score: Int, $progress: Int, $startedAt: FuzzyDateInput, $completedAt: FuzzyDateInput, $notes: String) {
                SaveMediaListEntry(mediaId: $mediaId, status: $status, score: $score, progress: $progress, startedAt: $startedAt, completedAt: $completedAt, notes: $notes) {
                    id
                    status
                    score
                    progress
                }
            }
        `;

        const variables = {
            mediaId: parseInt(mediaId),
            status: listData.status.toUpperCase(),
            ...(listData.score && { score: listData.score }),
            ...(listData.progress && { progress: listData.progress }),
            ...(listData.start_date && { startedAt: this.parseDate(listData.start_date) }),
            ...(listData.finish_date && { completedAt: this.parseDate(listData.finish_date) }),
            ...(listData.notes && { notes: listData.notes })
        };

        return await this.makeGraphQLRequest(query, variables);
    }

    // Add manga to user's list
    async addMangaToList(mediaId, listData) {
        const query = `
            mutation ($mediaId: Int, $status: MediaListStatus, $score: Int, $progress: Int, $progressVolumes: Int, $startedAt: FuzzyDateInput, $completedAt: FuzzyDateInput, $notes: String) {
                SaveMediaListEntry(mediaId: $mediaId, status: $status, score: $score, progress: $progress, progressVolumes: $progressVolumes, startedAt: $startedAt, completedAt: $completedAt, notes: $notes) {
                    id
                    status
                    score
                    progress
                    progressVolumes
                }
            }
        `;

        const variables = {
            mediaId: parseInt(mediaId),
            status: listData.status.toUpperCase(),
            ...(listData.score && { score: listData.score }),
            ...(listData.progress_chapters && { progress: listData.progress_chapters }),
            ...(listData.progress_volumes && { progressVolumes: listData.progress_volumes }),
            ...(listData.start_date && { startedAt: this.parseDate(listData.start_date) }),
            ...(listData.finish_date && { completedAt: this.parseDate(listData.finish_date) }),
            ...(listData.notes && { notes: listData.notes })
        };

        return await this.makeGraphQLRequest(query, variables);
    }

    // Helper method to format date
    formatDate(dateObj) {
        if (!dateObj || !dateObj.year) return null;
        
        const year = dateObj.year;
        const month = dateObj.month ? String(dateObj.month).padStart(2, '0') : '01';
        const day = dateObj.day ? String(dateObj.day).padStart(2, '0') : '01';
        
        return `${year}-${month}-${day}`;
    }

    // Helper method to parse date string
    parseDate(dateString) {
        if (!dateString) return null;
        
        const date = new Date(dateString);
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
        };
    }

    // Check authentication status
    isAuthenticated() {
        const token = localStorage.getItem('anilist_access_token');
        const expiresAt = parseInt(localStorage.getItem('anilist_expires_at') || '0');
        return token && Date.now() < expiresAt;
    }

    // Logout
    logout() {
        localStorage.removeItem('anilist_access_token');
        localStorage.removeItem('anilist_expires_at');
    }
}

// Export the service
window.AniListApiService = AniListApiService;