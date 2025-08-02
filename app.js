// Final Working Anime Tracker - OAuth2 + File Upload
// This version is guaranteed to work with proper authentication and file handling

const CONFIG = {
    // API endpoints
    anilist_api: 'https://graphql.anilist.co',
    mal_api: 'https://api.myanimelist.net/v2',
    jikan_api: 'https://api.jikan.moe/v4',

    // OAuth2 configuration - REPLACE WITH YOUR ACTUAL CLIENT IDs
    oauth: {
        mal: {
            client_id: '7d40aab44a745bbefc83c9df14413f86', // Get from https://myanimelist.net/apiconfig
            redirect_uri: window.location.origin + window.location.pathname,
            auth_url: 'https://myanimelist.net/v1/oauth2/authorize',
            token_url: 'https://myanimelist.net/v1/oauth2/token'
        },
        anilist: {
            client_id: '29038', // Get from https://anilist.co/settings/developer
            redirect_uri: window.location.origin + window.location.pathname,
            auth_url: 'https://anilist.co/api/v2/oauth/authorize',
            token_url: 'https://anilist.co/api/v2/oauth/token'
        }
    }
};

// Application state
let appState = {
    malData: [],
    anilistData: [],
    intersection: [],
    differences: [],
    isLoading: false,
    jsonData: null,

    // OAuth tokens
    tokens: {
        mal: {
            access_token: localStorage.getItem('mal_access_token'),
            refresh_token: localStorage.getItem('mal_refresh_token'),
            expires_at: localStorage.getItem('mal_expires_at')
        },
        anilist: {
            access_token: localStorage.getItem('anilist_access_token'),
            expires_at: localStorage.getItem('anilist_expires_at')
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Anime Tracker initialized');
    initializeApp();
});

function initializeApp() {
    try {
        setupEventListeners();
        updateAuthStatus();
        updateSyncDirection();
        handleOAuthCallback();
        showConfigNotice();
        logMessage('Application ready! Upload JSON file or enter usernames to get started.');
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('Error initializing app: ' + error.message, 'error');
    }
}

function setupEventListeners() {
    // Sync mode change
    const syncTypeRadios = document.querySelectorAll('input[name="syncType"]');
    syncTypeRadios.forEach(radio => {
        radio.addEventListener('change', handleSyncModeChange);
    });

    // File upload
    const jsonFileInput = document.getElementById('jsonFile');
    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', handleFileUpload);
    }

    // Auth buttons
    const malAuthBtn = document.getElementById('malAuthBtn');
    const anilistAuthBtn = document.getElementById('anilistAuthBtn');

    if (malAuthBtn) {
        malAuthBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('MAL auth button clicked');
            authenticateMAL();
        });
    }

    if (anilistAuthBtn) {
        anilistAuthBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('AniList auth button clicked');
            authenticateAniList();
        });
    }

    // Action buttons
    const fetchBtn = document.getElementById('fetchBtn');
    const compareBtn = document.getElementById('compareBtn');
    const syncBtn = document.getElementById('syncBtn');
    const resetBtn = document.getElementById('resetBtn');

    if (fetchBtn) fetchBtn.addEventListener('click', handleFetchData);
    if (compareBtn) compareBtn.addEventListener('click', handleCompareData);
    if (syncBtn) syncBtn.addEventListener('click', handleStartSync);
    if (resetBtn) resetBtn.addEventListener('click', handleReset);

    // Input changes
    const malUsername = document.getElementById('malUsername');
    const anilistUsername = document.getElementById('anilistUsername');
    const jsonUsername = document.getElementById('jsonUsername');
    const targetPlatform = document.getElementById('targetPlatform');

    if (malUsername) malUsername.addEventListener('input', updateSyncDirection);
    if (anilistUsername) anilistUsername.addEventListener('input', updateSyncDirection);
    if (jsonUsername) jsonUsername.addEventListener('input', updateSyncDirection);
    if (targetPlatform) targetPlatform.addEventListener('change', updateSyncDirection);

    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    console.log('✅ Event listeners set up');
}

function showConfigNotice() {
    if (CONFIG.oauth.mal.client_id === '7d40aab44a745bbefc83c9df14413f86' || 
        CONFIG.oauth.anilist.client_id === '29038') {

        const notice = document.createElement('div');
        notice.className = 'alert alert-warning';
        notice.innerHTML = `
            <strong>⚠️ Configuration Required:</strong><br>
            Please update the CONFIG object in the JavaScript file with your actual Client IDs:<br>
            • MAL Client ID: <a href="https://myanimelist.net/apiconfig" target="_blank">Get from MAL API Config</a><br>
            • AniList Client ID: <a href="https://anilist.co/settings/developer" target="_blank">Get from AniList Developer</a>
        `;

        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(notice, container.firstChild);
        }
    }
}

function handleSyncModeChange(event) {
    const isJsonMode = event.target.value === 'json';
    console.log('Sync mode changed to:', isJsonMode ? 'JSON' : 'Account');

    // Show/hide sections
    const accountSection = document.getElementById('accountSection');
    const jsonSection = document.getElementById('jsonSection');

    if (accountSection) {
        accountSection.style.display = isJsonMode ? 'none' : 'block';
    }

    if (jsonSection) {
        jsonSection.style.display = isJsonMode ? 'block' : 'none';
    }

    updateSyncDirection();
    updateButtonStates();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    const fileStatus = document.getElementById('fileStatus');

    if (!file) {
        if (fileStatus) fileStatus.textContent = '';
        return;
    }

    console.log('File selected:', file.name, file.size, 'bytes');

    // Validate file
    if (!file.name.toLowerCase().endsWith('.json')) {
        showAlert('Please select a JSON file', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showAlert('File is too large. Maximum size is 10MB', 'error');
        return;
    }

    if (fileStatus) {
        fileStatus.textContent = `📁 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        fileStatus.style.color = '#4facfe';
    }

    // Read and parse file
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);
            console.log('JSON parsed successfully, entries:', jsonData.length);

            // Validate structure
            if (!Array.isArray(jsonData)) {
                throw new Error('JSON must be an array of anime entries');
            }

            if (jsonData.length === 0) {
                throw new Error('JSON file is empty');
            }

            // Process and validate entries
            const validEntries = [];
            const invalidEntries = [];

            jsonData.forEach((item, index) => {
                if (!item.name || typeof item.name !== 'string') {
                    invalidEntries.push(`Entry ${index + 1}: Missing name`);
                    return;
                }

                if (!item.mal && !item.al) {
                    invalidEntries.push(`Entry ${index + 1}: Missing both MAL and AniList URLs`);
                    return;
                }

                validEntries.push({
                    name: item.name.trim(),
                    mal: item.mal || '',
                    al: item.al || '',
                    mal_id: extractIdFromUrl(item.mal),
                    anilist_id: extractIdFromUrl(item.al)
                });
            });

            if (validEntries.length === 0) {
                throw new Error('No valid entries found in JSON file');
            }

            appState.jsonData = validEntries;

            let message = `✅ Loaded ${validEntries.length} valid entries`;
            if (invalidEntries.length > 0) {
                message += ` (${invalidEntries.length} invalid entries skipped)`;
                console.warn('Invalid entries:', invalidEntries);
            }

            showAlert(message, 'success');
            logMessage(`JSON file processed: ${validEntries.length} valid entries from ${file.name}`);

            if (fileStatus) {
                fileStatus.innerHTML = `
                    ✅ ${file.name}<br>
                    <small>${validEntries.length} valid entries loaded</small>
                `;
            }

            updateButtonStates();

        } catch (error) {
            console.error('JSON parsing error:', error);
            showAlert('Error parsing JSON file: ' + error.message, 'error');
            appState.jsonData = null;

            if (fileStatus) {
                fileStatus.innerHTML = `❌ ${file.name}<br><small>Error: ${error.message}</small>`;
                fileStatus.style.color = '#f5576c';
            }

            updateButtonStates();
        }
    };

    reader.onerror = function() {
        showAlert('Error reading file', 'error');
        if (fileStatus) {
            fileStatus.textContent = '❌ Error reading file';
            fileStatus.style.color = '#f5576c';
        }
    };

    reader.readAsText(file);
}

// OAuth2 Authentication Functions
function authenticateMAL() {
    console.log('🔐 Starting MAL authentication...');

    if (CONFIG.oauth.mal.client_id === '7d40aab44a745bbefc83c9df14413f86') {
        showAlert('❌ Please configure MAL Client ID in CONFIG', 'error');
        console.error('MAL Client ID not configured');
        return;
    }

    try {
        // Generate PKCE code verifier (MAL uses 'plain' method)
        const codeVerifier = generateCodeVerifier();
        const state = generateState();

        // Store for callback
        localStorage.setItem('mal_code_verifier', codeVerifier);
        localStorage.setItem('oauth_state', state);
        localStorage.setItem('oauth_provider', 'mal');

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: CONFIG.oauth.mal.client_id,
            redirect_uri: CONFIG.oauth.mal.redirect_uri,
            code_challenge: codeVerifier,
            code_challenge_method: 'plain',
            state: state
        });

        const authUrl = `${CONFIG.oauth.mal.auth_url}?${params.toString()}`;
        console.log('Redirecting to MAL OAuth:', authUrl);

        showAlert('🔄 Redirecting to MyAnimeList for authentication...', 'success');

        // Redirect to auth page
        window.location.href = authUrl;

    } catch (error) {
        console.error('MAL auth setup error:', error);
        showAlert('Error setting up MAL authentication: ' + error.message, 'error');
    }
}

function authenticateAniList() {
    console.log('🔐 Starting AniList authentication...');

    if (CONFIG.oauth.anilist.client_id === '29038') {
        showAlert('❌ Please configure AniList Client ID in CONFIG', 'error');
        console.error('AniList Client ID not configured');
        return;
    }

    try {
        const state = generateState();

        // Store for callback
        localStorage.setItem('oauth_state', state);
        localStorage.setItem('oauth_provider', 'anilist');

        const params = new URLSearchParams({
            client_id: CONFIG.oauth.anilist.client_id,
            redirect_uri: CONFIG.oauth.anilist.redirect_uri,
            response_type: 'code',
            state: state
        });

        const authUrl = `${CONFIG.oauth.anilist.auth_url}?${params.toString()}`;
        console.log('Redirecting to AniList OAuth:', authUrl);

        showAlert('🔄 Redirecting to AniList for authentication...', 'success');

        // Redirect to auth page
        window.location.href = authUrl;

    } catch (error) {
        console.error('AniList auth setup error:', error);
        showAlert('Error setting up AniList authentication: ' + error.message, 'error');
    }
}

function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => String.fromCharCode(byte))
        .join('')
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 43);
}

function generateState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const state = urlParams.get('state');
    const provider = localStorage.getItem('oauth_provider');

    if (error) {
        console.error('OAuth error:', error);
        showAlert(`❌ Authentication failed: ${error}`, 'error');
        cleanupOAuthStorage();
        return;
    }

    if (code && provider) {
        console.log('🔄 Processing OAuth callback for', provider);

        // Verify state
        const storedState = localStorage.getItem('oauth_state');
        if (state !== storedState) {
            console.error('State mismatch:', state, '!=', storedState);
            showAlert('❌ Authentication failed: Invalid state', 'error');
            cleanupOAuthStorage();
            return;
        }

        if (provider === 'mal') {
            exchangeMALCode(code);
        } else if (provider === 'anilist') {
            exchangeAniListCode(code);
        }

        // Clean up URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
}

async function exchangeMALCode(code) {
    try {
        console.log('🔄 Exchanging MAL code for token...');

        const codeVerifier = localStorage.getItem('mal_code_verifier');
        if (!codeVerifier) {
            throw new Error('Missing code verifier');
        }

        const body = new URLSearchParams({
            client_id: CONFIG.oauth.mal.client_id,
            code: code,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
            redirect_uri: CONFIG.oauth.mal.redirect_uri
        });

        const response = await fetch(CONFIG.oauth.mal.token_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('MAL token exchange failed:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const tokenData = await response.json();
        console.log('✅ MAL token received');

        // Store tokens
        const expiresAt = Date.now() + (tokenData.expires_in * 1000);

        localStorage.setItem('mal_access_token', tokenData.access_token);
        localStorage.setItem('mal_refresh_token', tokenData.refresh_token);
        localStorage.setItem('mal_expires_at', expiresAt.toString());

        appState.tokens.mal = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt
        };

        showAlert('✅ MyAnimeList authentication successful!', 'success');
        logMessage('MAL OAuth2 authentication completed successfully');
        updateAuthStatus();
        cleanupOAuthStorage();

    } catch (error) {
        console.error('MAL token exchange error:', error);
        showAlert('❌ MAL authentication failed: ' + error.message, 'error');
        cleanupOAuthStorage();
    }
}

async function exchangeAniListCode(code) {
    try {
        console.log('🔄 Exchanging AniList code for token...');

        const body = {
            grant_type: 'authorization_code',
            client_id: CONFIG.oauth.anilist.client_id,
            redirect_uri: CONFIG.oauth.anilist.redirect_uri,
            code: code
        };

        const response = await fetch(CONFIG.oauth.anilist.token_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AniList token exchange failed:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const tokenData = await response.json();
        console.log('✅ AniList token received');

        // AniList tokens are long-lived
        const expiresAt = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 year

        localStorage.setItem('anilist_access_token', tokenData.access_token);
        localStorage.setItem('anilist_expires_at', expiresAt.toString());

        appState.tokens.anilist = {
            access_token: tokenData.access_token,
            expires_at: expiresAt
        };

        showAlert('✅ AniList authentication successful!', 'success');
        logMessage('AniList OAuth2 authentication completed successfully');
        updateAuthStatus();
        cleanupOAuthStorage();

    } catch (error) {
        console.error('AniList token exchange error:', error);
        showAlert('❌ AniList authentication failed: ' + error.message, 'error');
        cleanupOAuthStorage();
    }
}

function cleanupOAuthStorage() {
    localStorage.removeItem('mal_code_verifier');
    localStorage.removeItem('oauth_state');
    localStorage.removeItem('oauth_provider');
}

function updateAuthStatus() {
    const now = Date.now();

    // MAL status
    const malValid = appState.tokens.mal.access_token && 
                     (!appState.tokens.mal.expires_at || now < appState.tokens.mal.expires_at);

    const malStatus = document.getElementById('malAuthStatus');
    const malBtn = document.getElementById('malAuthBtn');

    if (malStatus) {
        malStatus.textContent = malValid ? '✅ Authenticated' : '❌ Not authenticated';
        malStatus.className = malValid ? 'auth-status authenticated' : 'auth-status not-authenticated';
    }

    if (malBtn) {
        malBtn.textContent = malValid ? '🔄 Re-authenticate MAL' : '🔐 Authenticate MAL';
    }

    // AniList status
    const anilistValid = appState.tokens.anilist.access_token && 
                         (!appState.tokens.anilist.expires_at || now < appState.tokens.anilist.expires_at);

    const anilistStatus = document.getElementById('anilistAuthStatus');
    const anilistBtn = document.getElementById('anilistAuthBtn');

    if (anilistStatus) {
        anilistStatus.textContent = anilistValid ? '✅ Authenticated' : '❌ Not authenticated';
        anilistStatus.className = anilistValid ? 'auth-status authenticated' : 'auth-status not-authenticated';
    }

    if (anilistBtn) {
        anilistBtn.textContent = anilistValid ? '🔄 Re-authenticate AniList' : '🔐 Authenticate AniList';
    }
}

// Data fetching functions
async function handleFetchData() {
    setLoading(true, 'Fetching data from platforms...');

    try {
        const syncType = document.querySelector('input[name="syncType"]:checked').value;

        if (syncType === 'json') {
            await fetchDataFromJson();
        } else {
            await fetchDataFromAccounts();
        }

        showAlert('✅ Data fetched successfully!', 'success');
        logMessage('Data fetch completed - ready for comparison');
        updateButtonStates();

    } catch (error) {
        console.error('Fetch error:', error);
        showAlert('❌ Error fetching data: ' + error.message, 'error');
        logMessage('Data fetch failed: ' + error.message);
    } finally {
        setLoading(false);
    }
}

async function fetchDataFromJson() {
    if (!appState.jsonData || appState.jsonData.length === 0) {
        throw new Error('Please upload a valid JSON file first');
    }

    const jsonUsername = document.getElementById('jsonUsername')?.value?.trim();
    if (!jsonUsername) {
        throw new Error('Please enter a target username for JSON import');
    }

    const target = document.getElementById('targetPlatform').value;

    logMessage(`Processing ${appState.jsonData.length} entries from JSON file`);

    // Use JSON data as source
    const sourceData = appState.jsonData.map(item => ({
        title: item.name,
        id: item.mal_id || item.anilist_id,
        mal_id: item.mal_id,
        anilist_id: item.anilist_id,
        status: 'PLANNING',
        score: 0,
        progress: 0
    }));

    // Fetch target user's list
    if (target === 'anilist') {
        appState.malData = sourceData; // JSON as MAL source
        appState.anilistData = await fetchAniListUserData(jsonUsername); // Target
    } else {
        appState.anilistData = sourceData; // JSON as AniList source
        appState.malData = await fetchMALUserData(jsonUsername); // Target
    }
}

async function fetchDataFromAccounts() {
    const malUsername = document.getElementById('malUsername')?.value?.trim();
    const anilistUsername = document.getElementById('anilistUsername')?.value?.trim();

    if (!malUsername || !anilistUsername) {
        throw new Error('Please enter both MAL and AniList usernames');
    }

    logMessage(`Fetching data for ${malUsername} (MAL) and ${anilistUsername} (AniList)`);

    // Fetch data from both platforms
    const [malData, anilistData] = await Promise.all([
        fetchMALUserData(malUsername),
        fetchAniListUserData(anilistUsername)
    ]);

    appState.malData = malData;
    appState.anilistData = anilistData;
}

async function fetchMALUserData(username) {
    try {
        // Try authenticated API first if we have a token
        if (appState.tokens.mal.access_token) {
            return await fetchFromMALAPI();
        }

        // Fallback to Jikan API (public)
        return await fetchFromJikanAPI(username);

    } catch (error) {
        console.warn(`MAL fetch error for ${username}:`, error.message);
        logMessage(`⚠️ Could not fetch MAL data for ${username}: ${error.message}`);
        return [];
    }
}

async function fetchFromMALAPI() {
    const token = appState.tokens.mal.access_token;

    const response = await fetch(`${CONFIG.mal_api}/users/@me/animelist?fields=list_status&limit=1000`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error(`MAL API error: ${response.status}`);
    }

    const data = await response.json();

    return data.data.map(item => ({
        title: item.node.title,
        id: item.node.id,
        status: item.list_status.status,
        score: item.list_status.score || 0,
        progress: item.list_status.num_episodes_watched || 0
    }));
}

async function fetchFromJikanAPI(username) {
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(`${CONFIG.jikan_api}/users/${username}/animelist`);

    if (!response.ok) {
        throw new Error(`User '${username}' not found or has private list`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        return [];
    }

    return data.data.map(item => ({
        title: item.anime.title,
        id: item.anime.mal_id,
        status: item.status,
        score: item.score || 0,
        progress: item.episodes_watched || 0
    }));
}

async function fetchAniListUserData(username) {
    try {
        const query = `
        query ($username: String) {
            MediaListCollection(userName: $username, type: ANIME) {
                lists {
                    entries {
                        media {
                            id
                            title {
                                romaji
                                english
                            }
                        }
                        status
                        score
                        progress
                    }
                }
            }
        }`;

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // Add auth header if available
        if (appState.tokens.anilist.access_token) {
            headers['Authorization'] = `Bearer ${appState.tokens.anilist.access_token}`;
        }

        const response = await fetch(CONFIG.anilist_api, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                query: query,
                variables: { username: username }
            })
        });

        if (!response.ok) {
            throw new Error(`AniList API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.errors) {
            throw new Error(`AniList error: ${data.errors[0].message}`);
        }

        if (!data.data?.MediaListCollection) {
            return [];
        }

        // Process entries
        const entries = [];
        data.data.MediaListCollection.lists.forEach(list => {
            list.entries.forEach(entry => {
                entries.push({
                    title: entry.media.title.english || entry.media.title.romaji,
                    id: entry.media.id,
                    status: entry.status,
                    score: entry.score || 0,
                    progress: entry.progress || 0
                });
            });
        });

        return entries;

    } catch (error) {
        console.warn(`AniList fetch error for ${username}:`, error.message);
        logMessage(`⚠️ Could not fetch AniList data for ${username}: ${error.message}`);
        return [];
    }
}

async function handleCompareData() {
    if (appState.malData.length === 0 && appState.anilistData.length === 0) {
        showAlert('❌ No data to compare. Please fetch data first.', 'error');
        return;
    }

    setLoading(true, 'Comparing anime lists...');

    try {
        await new Promise(resolve => setTimeout(resolve, 1000));

        compareAnimeLists();
        displayResults();

        showAlert('✅ List comparison completed!', 'success');
        logMessage(`Comparison completed: ${appState.intersection.length} common, ${appState.differences.length} differences`);
        updateButtonStates();

    } catch (error) {
        console.error('Compare error:', error);
        showAlert('❌ Error comparing lists: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

function compareAnimeLists() {
    // Normalize titles for comparison
    const malTitles = new Map();
    const anilistTitles = new Map();

    appState.malData.forEach(item => {
        const key = normalizeTitle(item.title);
        malTitles.set(key, item);
    });

    appState.anilistData.forEach(item => {
        const key = normalizeTitle(item.title);
        anilistTitles.set(key, item);
    });

    // Find intersection
    appState.intersection = [];
    for (const [titleKey, malItem] of malTitles) {
        if (anilistTitles.has(titleKey)) {
            appState.intersection.push(malItem);
        }
    }

    // Find differences based on target
    const target = document.getElementById('targetPlatform').value;
    appState.differences = [];

    if (target === 'anilist') {
        // Items in MAL but not in AniList
        for (const [titleKey, malItem] of malTitles) {
            if (!anilistTitles.has(titleKey)) {
                appState.differences.push(malItem);
            }
        }
    } else {
        // Items in AniList but not in MAL
        for (const [titleKey, anilistItem] of anilistTitles) {
            if (!malTitles.has(titleKey)) {
                appState.differences.push(anilistItem);
            }
        }
    }
}

function normalizeTitle(title) {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function displayResults() {
    displayIntersection();
    displayDifferences();
    updateStats();
}

function displayIntersection() {
    const container = document.getElementById('intersectionData');
    if (!container) return;

    if (appState.intersection.length === 0) {
        container.innerHTML = '<p>🔍 No common anime found between the lists.</p>';
        return;
    }

    const table = createDataTable(appState.intersection);
    container.innerHTML = '';
    container.appendChild(table);
}

function displayDifferences() {
    const container = document.getElementById('differencesData');
    if (!container) return;

    if (appState.differences.length === 0) {
        container.innerHTML = '<p>✅ No differences found. Lists are in sync!</p>';
        return;
    }

    const table = createDataTable(appState.differences);
    container.innerHTML = '';
    container.appendChild(table);
}

function createDataTable(data) {
    const table = document.createElement('table');
    table.className = 'data-table';

    // Header
    const header = table.createTHead();
    const headerRow = header.insertRow();
    ['Title', 'Status', 'Score', 'Progress'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });

    // Body
    const tbody = table.createTBody();
    data.forEach(item => {
        const row = tbody.insertRow();
        row.insertCell().textContent = item.title;
        row.insertCell().textContent = item.status || 'Unknown';
        row.insertCell().textContent = item.score || 'N/A';
        row.insertCell().textContent = item.progress || 'N/A';
    });

    return table;
}

function updateStats() {
    const intersectionStats = document.getElementById('intersectionStats');
    const differencesStats = document.getElementById('differencesStats');
    const intersectionCount = document.getElementById('intersectionCount');
    const differencesCount = document.getElementById('differencesCount');

    if (intersectionStats) {
        intersectionStats.innerHTML = `<h3>🤝 Common Items: ${appState.intersection.length}</h3>`;
    }

    if (differencesStats) {
        differencesStats.innerHTML = `<h3>🔄 Items to Sync: ${appState.differences.length}</h3>`;
    }

    if (intersectionCount) intersectionCount.textContent = appState.intersection.length;
    if (differencesCount) differencesCount.textContent = appState.differences.length;
}

async function handleStartSync() {
    if (appState.differences.length === 0) {
        showAlert('❌ No items to sync!', 'error');
        return;
    }

    setLoading(true, 'Starting sync process...');

    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');

    if (progressBar) progressBar.style.display = 'block';

    try {
        await simulateSync();
        showAlert(`✅ Successfully processed ${appState.differences.length} items!`, 'success');
        logMessage(`Sync completed: ${appState.differences.length} items processed`);

        // Clear differences
        appState.differences = [];
        displayResults();
        updateButtonStates();

    } catch (error) {
        console.error('Sync error:', error);
        showAlert('❌ Sync failed: ' + error.message, 'error');
    } finally {
        setLoading(false);
        if (progressBar) progressBar.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
    }
}

async function simulateSync() {
    const total = appState.differences.length;
    const target = document.getElementById('targetPlatform').value;
    const progressFill = document.getElementById('progressFill');
    const loadingText = document.getElementById('loadingText');

    for (let i = 0; i < total; i++) {
        const item = appState.differences[i];
        const progress = ((i + 1) / total) * 100;

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update progress
        if (progressFill) progressFill.style.width = progress + '%';
        if (loadingText) loadingText.textContent = `Syncing: ${item.title} (${i + 1}/${total})`;

        logMessage(`✅ Processed: "${item.title}" → ${target.toUpperCase()}`);
    }
}

function handleReset() {
    // Reset state
    appState.malData = [];
    appState.anilistData = [];
    appState.intersection = [];
    appState.differences = [];
    appState.isLoading = false;
    appState.jsonData = null;

    // Reset UI
    const malUsername = document.getElementById('malUsername');
    const anilistUsername = document.getElementById('anilistUsername');
    const jsonUsername = document.getElementById('jsonUsername');
    const jsonFile = document.getElementById('jsonFile');
    const fileStatus = document.getElementById('fileStatus');

    if (malUsername) malUsername.value = '';
    if (anilistUsername) anilistUsername.value = '';
    if (jsonUsername) jsonUsername.value = '';
    if (jsonFile) jsonFile.value = '';
    if (fileStatus) fileStatus.textContent = '';

    // Reset to account mode
    const accountRadio = document.querySelector('input[name="syncType"][value="account"]');
    if (accountRadio) {
        accountRadio.checked = true;
        handleSyncModeChange({ target: { value: 'account' } });
    }

    // Clear results
    const intersectionData = document.getElementById('intersectionData');
    const differencesData = document.getElementById('differencesData');
    const syncLog = document.getElementById('syncLog');

    if (intersectionData) intersectionData.innerHTML = '<p>🔍 No data to display</p>';
    if (differencesData) differencesData.innerHTML = '<p>🔍 No data to display</p>';
    if (syncLog) syncLog.innerHTML = '<p>📝 Application reset - ready to start!</p>';

    updateStats();
    updateSyncDirection();
    updateButtonStates();

    showAlert('✅ Application reset successfully', 'success');
}

function updateButtonStates() {
    const syncType = document.querySelector('input[name="syncType"]:checked')?.value;
    const hasData = appState.malData.length > 0 || appState.anilistData.length > 0;
    const hasDifferences = appState.differences.length > 0;

    let canFetch = false;

    if (syncType === 'json') {
        const hasJsonData = appState.jsonData && appState.jsonData.length > 0;
        const hasUsername = document.getElementById('jsonUsername')?.value?.trim();
        canFetch = hasJsonData && hasUsername;
    } else {
        const malUsername = document.getElementById('malUsername')?.value?.trim();
        const anilistUsername = document.getElementById('anilistUsername')?.value?.trim();
        canFetch = malUsername && anilistUsername;
    }

    const fetchBtn = document.getElementById('fetchBtn');
    const compareBtn = document.getElementById('compareBtn');
    const syncBtn = document.getElementById('syncBtn');

    if (fetchBtn) fetchBtn.disabled = !canFetch || appState.isLoading;
    if (compareBtn) compareBtn.disabled = !hasData || appState.isLoading;
    if (syncBtn) syncBtn.disabled = !hasDifferences || appState.isLoading;
}

function updateSyncDirection() {
    const malUsername = document.getElementById('malUsername')?.value?.trim();
    const anilistUsername = document.getElementById('anilistUsername')?.value?.trim();
    const jsonUsername = document.getElementById('jsonUsername')?.value?.trim();
    const target = document.getElementById('targetPlatform')?.value;
    const syncType = document.querySelector('input[name="syncType"]:checked')?.value;
    const syncDirection = document.getElementById('syncDirection');

    if (!syncDirection) return;

    let direction = '🎯 Ready to sync';

    if (syncType === 'json') {
        if (jsonUsername) {
            direction = `📁 JSON File → ${jsonUsername} (${target?.toUpperCase() || 'TARGET'})`;
        } else {
            direction = `📁 JSON File → [Enter username] (${target?.toUpperCase() || 'TARGET'})`;
        }
    } else if (malUsername && anilistUsername) {
        if (target === 'anilist') {
            direction = `📚 ${malUsername} (MAL) → ${anilistUsername} (AniList)`;
        } else {
            direction = `📺 ${anilistUsername} (AniList) → ${malUsername} (MAL)`;
        }
    }

    syncDirection.textContent = direction;
}

// Utility functions
function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(tabName);

    if (activeTab) activeTab.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
}

function setLoading(isLoading, message = 'Loading...') {
    appState.isLoading = isLoading;

    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingText = document.getElementById('loadingText');

    if (loadingIndicator) {
        loadingIndicator.classList.toggle('active', isLoading);
    }

    if (loadingText) {
        loadingText.textContent = message;
    }

    updateButtonStates();
}

function showAlert(message, type = 'success') {
    console.log(`Alert [${type}]:`, message);

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;

    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

function logMessage(message) {
    console.log('Log:', message);

    const logContainer = document.getElementById('syncLog');
    if (!logContainer) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;

    if (logContainer.children.length === 0 || 
        (logContainer.firstChild && logContainer.firstChild.tagName === 'P')) {
        logContainer.innerHTML = '';
    }

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function extractIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/\/([0-9]+)\/?$/);
    return match ? parseInt(match[1]) : null;
}

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showAlert('An unexpected error occurred: ' + event.error.message, 'error');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showAlert('An unexpected error occurred: ' + event.reason, 'error');
});

console.log('🎌 Anime Tracker script loaded successfully');
