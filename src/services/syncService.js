// Data Synchronization Service
// Handles comparison, syncing, and progress tracking between MAL and AniList

class SyncService {
    constructor() {
        this.malApi = new MALApiService();
        this.anilistApi = new AniListApiService();
        this.progressCallbacks = [];
        this.isRunning = false;
        this.currentOperation = null;
    }

    // Add progress callback
    onProgress(callback) {
        this.progressCallbacks.push(callback);
    }

    // Remove progress callback
    removeProgressCallback(callback) {
        const index = this.progressCallbacks.indexOf(callback);
        if (index > -1) {
            this.progressCallbacks.splice(index, 1);
        }
    }

    // Emit progress update
    emitProgress(data) {
        this.progressCallbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Progress callback error:', error);
            }
        });
    }

    // Normalize title for comparison
    normalizeTitle(title) {
        if (!title) return '';
        
        return title
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Replace special characters with spaces
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim()
            .replace(/\b(the|a|an)\b/g, '') // Remove common articles
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Calculate title similarity using Jaro-Winkler distance
    calculateSimilarity(str1, str2) {
        if (str1 === str2) return 1.0;
        if (!str1 || !str2) return 0.0;

        const len1 = str1.length;
        const len2 = str2.length;
        
        if (len1 === 0 && len2 === 0) return 1.0;
        if (len1 === 0 || len2 === 0) return 0.0;

        const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
        const str1Matches = new Array(len1).fill(false);
        const str2Matches = new Array(len2).fill(false);

        let matches = 0;
        let transpositions = 0;

        // Find matches
        for (let i = 0; i < len1; i++) {
            const start = Math.max(0, i - matchWindow);
            const end = Math.min(i + matchWindow + 1, len2);

            for (let j = start; j < end; j++) {
                if (str2Matches[j] || str1[i] !== str2[j]) continue;
                str1Matches[i] = true;
                str2Matches[j] = true;
                matches++;
                break;
            }
        }

        if (matches === 0) return 0.0;

        // Count transpositions
        let k = 0;
        for (let i = 0; i < len1; i++) {
            if (!str1Matches[i]) continue;
            while (!str2Matches[k]) k++;
            if (str1[i] !== str2[k]) transpositions++;
            k++;
        }

        const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

        // Jaro-Winkler modification
        const prefix = Math.min(4, Math.min(len1, len2));
        let prefixLength = 0;
        for (let i = 0; i < prefix; i++) {
            if (str1[i] === str2[i]) prefixLength++;
            else break;
        }

        return jaro + (0.1 * prefixLength * (1 - jaro));
    }

    // Find matches between two lists based on title similarity
    findMatches(list1, list2, threshold = 0.85) {
        const matches = [];
        const used = new Set();

        for (const item1 of list1) {
            const normalizedTitle1 = this.normalizeTitle(item1.title);
            let bestMatch = null;
            let bestSimilarity = 0;

            for (let i = 0; i < list2.length; i++) {
                if (used.has(i)) continue;

                const item2 = list2[i];
                const normalizedTitle2 = this.normalizeTitle(item2.title);
                const similarity = this.calculateSimilarity(normalizedTitle1, normalizedTitle2);

                if (similarity >= threshold && similarity > bestSimilarity) {
                    bestMatch = { item: item2, index: i };
                    bestSimilarity = similarity;
                }
            }

            if (bestMatch) {
                matches.push({
                    platform1Item: item1,
                    platform2Item: bestMatch.item,
                    similarity: bestSimilarity
                });
                used.add(bestMatch.index);
            }
        }

        return matches;
    }

    // Compare two lists and find intersections and differences
    compareLists(malList, anilistList) {
        this.emitProgress({
            type: 'status',
            message: 'Comparing lists...',
            progress: 0
        });

        // Find matches from MAL to AniList
        const malToAnilistMatches = this.findMatches(malList, anilistList);
        
        // Find matches from AniList to MAL
        const anilistToMalMatches = this.findMatches(anilistList, malList);

        // Combine matches and remove duplicates
        const allMatches = new Map();
        
        malToAnilistMatches.forEach(match => {
            const key = `${match.platform1Item.id}-${match.platform2Item.id}`;
            allMatches.set(key, {
                malItem: match.platform1Item,
                anilistItem: match.platform2Item,
                similarity: match.similarity
            });
        });

        anilistToMalMatches.forEach(match => {
            const key = `${match.platform2Item.id}-${match.platform1Item.id}`;
            if (!allMatches.has(key)) {
                allMatches.set(key, {
                    malItem: match.platform2Item,
                    anilistItem: match.platform1Item,
                    similarity: match.similarity
                });
            }
        });

        const intersection = Array.from(allMatches.values());

        // Find items only in MAL
        const matchedMalIds = new Set(intersection.map(match => match.malItem.id));
        const malOnly = malList.filter(item => !matchedMalIds.has(item.id));

        // Find items only in AniList
        const matchedAnilistIds = new Set(intersection.map(match => match.anilistItem.id));
        const anilistOnly = anilistList.filter(item => !matchedAnilistIds.has(item.id));

        this.emitProgress({
            type: 'status',
            message: 'Comparison complete',
            progress: 100
        });

        return {
            intersection,
            differences: {
                malOnly,
                anilistOnly
            },
            stats: {
                malTotal: malList.length,
                anilistTotal: anilistList.length,
                matches: intersection.length,
                malOnlyCount: malOnly.length,
                anilistOnlyCount: anilistOnly.length
            }
        };
    }

    // Fetch data from both platforms
    async fetchAllData(malUsername, anilistUsername, dataType = 'anime') {
        this.emitProgress({
            type: 'status',
            message: 'Starting data fetch...',
            progress: 0
        });

        const results = {
            malData: [],
            anilistData: [],
            errors: []
        };

        try {
            // Fetch MAL data
            this.emitProgress({
                type: 'status',
                message: 'Fetching MyAnimeList data...',
                progress: 25
            });

            if (dataType === 'anime') {
                results.malData = await this.malApi.getUserAnimeList(malUsername);
            } else {
                results.malData = await this.malApi.getUserMangaList(malUsername);
            }

            this.emitProgress({
                type: 'status',
                message: `Fetched ${results.malData.length} items from MAL`,
                progress: 50
            });

        } catch (error) {
            console.error('Error fetching MAL data:', error);
            results.errors.push({
                platform: 'MAL',
                error: error.message
            });
        }

        try {
            // Fetch AniList data
            this.emitProgress({
                type: 'status',
                message: 'Fetching AniList data...',
                progress: 75
            });

            if (dataType === 'anime') {
                results.anilistData = await this.anilistApi.getUserAnimeList(anilistUsername);
            } else {
                results.anilistData = await this.anilistApi.getUserMangaList(anilistUsername);
            }

            this.emitProgress({
                type: 'status',
                message: `Fetched ${results.anilistData.length} items from AniList`,
                progress: 100
            });

        } catch (error) {
            console.error('Error fetching AniList data:', error);
            results.errors.push({
                platform: 'AniList',
                error: error.message
            });
        }

        return results;
    }

    // Sync missing items to target platform
    async syncToTarget(missingItems, targetPlatform, dataType = 'anime') {
        if (!missingItems || missingItems.length === 0) {
            this.emitProgress({
                type: 'status',
                message: 'No items to sync',
                progress: 100
            });
            return { success: 0, failed: 0, errors: [] };
        }

        this.isRunning = true;
        this.currentOperation = 'sync';

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        this.emitProgress({
            type: 'status',
            message: `Starting sync to ${targetPlatform}...`,
            progress: 0
        });

        for (let i = 0; i < missingItems.length; i++) {
            if (!this.isRunning) break; // Allow cancellation

            const item = missingItems[i];
            const progress = ((i + 1) / missingItems.length) * 100;

            try {
                this.emitProgress({
                    type: 'item',
                    message: `Syncing: ${item.title}`,
                    progress: progress,
                    current: i + 1,
                    total: missingItems.length
                });

                let searchResult = null;
                let success = false;

                if (targetPlatform === 'anilist') {
                    // Search for the anime/manga on AniList
                    if (dataType === 'anime') {
                        searchResult = await this.anilistApi.searchAnime(item.title);
                    } else {
                        searchResult = await this.anilistApi.searchManga(item.title);
                    }

                    if (searchResult) {
                        // Add to AniList
                        const listData = {
                            status: this.mapStatusToAniList(item.status),
                            score: item.score,
                            progress: item.progress || item.progress_chapters,
                            progress_volumes: item.progress_volumes,
                            start_date: item.start_date,
                            finish_date: item.finish_date,
                            notes: item.comments || item.notes
                        };

                        if (dataType === 'anime') {
                            await this.anilistApi.addAnimeToList(searchResult.id, listData);
                        } else {
                            await this.anilistApi.addMangaToList(searchResult.id, listData);
                        }
                        success = true;
                    }
                } else if (targetPlatform === 'mal') {
                    // For MAL, we need to search first (implement search if not available)
                    // For now, we'll skip items that can't be found
                    this.emitProgress({
                        type: 'warning',
                        message: `Cannot search on MAL - skipping ${item.title}`,
                        progress: progress
                    });
                }

                if (success) {
                    results.success++;
                    this.emitProgress({
                        type: 'success',
                        message: `✓ Added: ${item.title}`,
                        progress: progress
                    });
                } else {
                    results.failed++;
                    results.errors.push({
                        item: item.title,
                        error: 'Could not find matching item on target platform'
                    });
                }

            } catch (error) {
                console.error(`Error syncing ${item.title}:`, error);
                results.failed++;
                results.errors.push({
                    item: item.title,
                    error: error.message
                });

                this.emitProgress({
                    type: 'error',
                    message: `✗ Failed: ${item.title} - ${error.message}`,
                    progress: progress
                });
            }

            // Add delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.isRunning = false;
        this.currentOperation = null;

        this.emitProgress({
            type: 'complete',
            message: `Sync complete: ${results.success} successful, ${results.failed} failed`,
            progress: 100
        });

        return results;
    }

    // Map status values between platforms
    mapStatusToAniList(malStatus) {
        const statusMap = {
            'watching': 'CURRENT',
            'completed': 'COMPLETED',
            'on_hold': 'PAUSED',
            'dropped': 'DROPPED',
            'plan_to_watch': 'PLANNING',
            'reading': 'CURRENT',
            'plan_to_read': 'PLANNING'
        };
        return statusMap[malStatus] || 'PLANNING';
    }

    mapStatusToMAL(anilistStatus) {
        const statusMap = {
            'CURRENT': 'watching',
            'COMPLETED': 'completed',
            'PAUSED': 'on_hold',
            'DROPPED': 'dropped',
            'PLANNING': 'plan_to_watch'
        };
        return statusMap[anilistStatus] || 'plan_to_watch';
    }

    // Process JSON import data
    processJsonImport(jsonData, targetPlatform, dataType = 'anime') {
        if (!jsonData || !Array.isArray(jsonData)) {
            throw new Error('Invalid JSON data format. Expected an array of items.');
        }

        this.emitProgress({
            type: 'status',
            message: 'Processing JSON import data...',
            progress: 0
        });

        // Normalize JSON data to our internal format
        const normalizedData = jsonData.map(item => {
            // Flexible JSON format support
            return {
                id: item.id || item.mal_id || item.anilist_id || Math.random(),
                title: item.title || item.name || item.series_title,
                status: item.status || item.my_status || 'plan_to_watch',
                score: item.score || item.my_score || 0,
                progress: item.progress || item.watched_episodes || item.read_chapters || 0,
                progress_chapters: item.progress_chapters || item.read_chapters || 0,
                progress_volumes: item.progress_volumes || item.read_volumes || 0,
                total_episodes: item.total_episodes || item.num_episodes || 0,
                total_chapters: item.total_chapters || item.num_chapters || 0,
                total_volumes: item.total_volumes || item.num_volumes || 0,
                start_date: item.start_date || item.started_date,
                finish_date: item.finish_date || item.finished_date,
                notes: item.notes || item.comments || '',
                tags: item.tags || [],
                platform: 'json'
            };
        });

        this.emitProgress({
            type: 'status',
            message: `Processed ${normalizedData.length} items from JSON`,
            progress: 100
        });

        return normalizedData;
    }

    // Cancel running operation
    cancel() {
        this.isRunning = false;
        this.emitProgress({
            type: 'cancelled',
            message: 'Operation cancelled by user',
            progress: 0
        });
    }

    // Get current operation status
    getStatus() {
        return {
            isRunning: this.isRunning,
            currentOperation: this.currentOperation
        };
    }

    // Authentication helpers
    isMALAuthenticated() {
        return this.malApi.isAuthenticated();
    }

    isAniListAuthenticated() {
        return this.anilistApi.isAuthenticated();
    }

    async authenticateMAL() {
        return await this.malApi.authenticate();
    }

    async authenticateAniList() {
        return await this.anilistApi.authenticate();
    }

    // Handle OAuth callbacks
    async handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (!code) return false;

        try {
            // Determine which platform based on stored state or URL
            const isMAL = localStorage.getItem('oauth_platform') === 'mal';
            
            if (isMAL) {
                await this.malApi.exchangeCodeForToken(code);
                localStorage.removeItem('oauth_platform');
                return { platform: 'mal', success: true };
            } else {
                await this.anilistApi.exchangeCodeForToken(code);
                localStorage.removeItem('oauth_platform');
                return { platform: 'anilist', success: true };
            }
        } catch (error) {
            console.error('OAuth callback error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export the service
window.SyncService = SyncService;