// AniList API Service
// Handles all AniList API interactions with OAuth2 authentication and GraphQL

class AniListApiService {
    constructor() {
        this.baseUrl = 'https://graphql.anilist.co';
        this.authUrl = 'https://anilist.co/api/v2/oauth/authorize';
        this.tokenUrl = 'https://anilist.co/api/v2/oauth/token';
        this.clientId = '29038'; // Replace with your actual client ID
        this.clientSecret = 'EESvhR7XUzdpWNhWBRYPWGJjIGcP9qW04vUhT9QW'; // Keep this secure
        this.redirectUri = window.location.origin + window.location.pathname;
        this.rateLimit = {
            requestsPerMinute: 90,
            requests: [],
            lastCleanup: Date.now()
        };
    }

    // OAuth2 Authentication
    async authenticate() {
        const authUrl = `${this.authUrl}?` +
            `client_id=${this.clientId}&` +
            `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
            `response_type=code`;
        
        window.location.href = authUrl;
    }

    // Exchange authorization code for access token
    async exchangeCodeForToken(code) {
        const response = await fetch(this.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: this.redirectUri,
                code: code
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to exchange code for token: ${response.statusText}`);
        }

        const tokenData = await response.json();
        this.storeTokens(tokenData);
        return tokenData;
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

    // Get user's anime list
    async getUserAnimeList(username) {
        const query = `
            query ($username: String) {
                MediaListCollection(userName: $username, type: ANIME) {
                    lists {
                        entries {
                            id
                            status
                            score
                            progress
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
                            updatedAt
                            notes
                            media {
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
                    }
                }
            }
        `;

        try {
            const data = await this.makeGraphQLRequest(query, { username });
            
            if (!data.MediaListCollection || !data.MediaListCollection.lists) {
                return [];
            }

            const allEntries = [];
            data.MediaListCollection.lists.forEach(list => {
                if (list.entries) {
                    allEntries.push(...list.entries);
                }
            });

            return allEntries.map(entry => ({
                id: entry.media.id,
                title: entry.media.title.romaji || entry.media.title.english || entry.media.title.native,
                status: entry.status.toLowerCase(),
                score: entry.score || 0,
                progress: entry.progress || 0,
                total_episodes: entry.media.episodes || 0,
                start_date: this.formatDate(entry.startedAt),
                finish_date: this.formatDate(entry.completedAt),
                updated_at: entry.updatedAt,
                notes: entry.notes || '',
                platform: 'anilist'
            }));
        } catch (error) {
            console.error('Error fetching AniList anime list:', error);
            throw error;
        }
    }

    // Get user's manga list
    async getUserMangaList(username) {
        const query = `
            query ($username: String) {
                MediaListCollection(userName: $username, type: MANGA) {
                    lists {
                        entries {
                            id
                            status
                            score
                            progress
                            progressVolumes
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
                            updatedAt
                            notes
                            media {
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
                    }
                }
            }
        `;

        try {
            const data = await this.makeGraphQLRequest(query, { username });
            
            if (!data.MediaListCollection || !data.MediaListCollection.lists) {
                return [];
            }

            const allEntries = [];
            data.MediaListCollection.lists.forEach(list => {
                if (list.entries) {
                    allEntries.push(...list.entries);
                }
            });

            return allEntries.map(entry => ({
                id: entry.media.id,
                title: entry.media.title.romaji || entry.media.title.english || entry.media.title.native,
                status: entry.status.toLowerCase(),
                score: entry.score || 0,
                progress_chapters: entry.progress || 0,
                progress_volumes: entry.progressVolumes || 0,
                total_chapters: entry.media.chapters || 0,
                total_volumes: entry.media.volumes || 0,
                start_date: this.formatDate(entry.startedAt),
                finish_date: this.formatDate(entry.completedAt),
                updated_at: entry.updatedAt,
                notes: entry.notes || '',
                platform: 'anilist'
            }));
        } catch (error) {
            console.error('Error fetching AniList manga list:', error);
            throw error;
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