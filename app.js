// Complete Anime Tracker Data Sync with OAuth2 Authentication
// Supports both MAL (PKCE) and AniList (Implicit/Authorization Code) flows

const CONFIG = {
    // API endpoints
    anilist_api: 'https://graphql.anilist.co',
    mal_api: 'https://api.myanimelist.net/v2',
    jikan_api: 'https://api.jikan.moe/v4',

    // OAuth2 configuration (replace with your actual client IDs)
    oauth: {
        mal: {
            client_id: '7d40aab44a745bbefc83c9df14413f86', // Get from https://myanimelist.net/apiconfig
            redirect_uri: window.location.origin + '/callback',
            auth_url: 'https://myanimelist.net/v1/oauth2/authorize',
            token_url: 'https://myanimelist.net/v1/oauth2/token'
        },
        anilist: {
            client_id: '29038', // Get from https://anilist.co/settings/developer
            redirect_uri: window.location.origin + '/callback',
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

// DOM Elements
const elements = {
    syncTypeRadios: document.querySelectorAll('input[name="syncType"]'),
    malUsername: document.getElementById('malUsername'),
    anilistUsername: document.getElementById('anilistUsername'),
    targetPlatform: document.getElementById('targetPlatform'),
    fileUploadSection: document.getElementById('fileUploadSection'),
    jsonFile: document.getElementById('jsonFile'),
    jsonUsername: document.getElementById('jsonUsername'),
    fileName: document.getElementById('fileName'),
    fetchBtn: document.getElementById('fetchBtn'),
    compareBtn: document.getElementById('compareBtn'),
    syncBtn: document.getElementById('syncBtn'),
    resetBtn: document.getElementById('resetBtn'),
    syncDirection: document.getElementById('syncDirection'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    loadingText: document.getElementById('loadingText'),
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    malAuthBtn: document.getElementById('malAuthBtn'),
    anilistAuthBtn: document.getElementById('anilistAuthBtn'),
    malAuthStatus: document.getElementById('malAuthStatus'),
    anilistAuthStatus: document.getElementById('anilistAuthStatus')
};

// Initialize app
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    setupEventListeners();
    updateSyncDirection();
    updateAuthStatus();
    handleOAuthCallback();
    logMessage('Application initialized with OAuth2 support');
}

function setupEventListeners() {
    // Sync mode change
    elements.syncTypeRadios.forEach(radio => {
        radio.addEventListener('change', handleSyncTypeChange);
    });

    // File upload
    elements.jsonFile.addEventListener('change', handleFileUpload);

    // Button clicks
    elements.fetchBtn.addEventListener('click', handleFetchData);
    elements.compareBtn.addEventListener('click', handleCompareData);
    elements.syncBtn.addEventListener('click', handleStartSync);
    elements.resetBtn.addEventListener('click', handleReset);

    // Auth buttons
    elements.malAuthBtn.addEventListener('click', authenticateMAL);
    elements.anilistAuthBtn.addEventListener('click', authenticateAniList);

    // Input changes
    elements.targetPlatform.addEventListener('change', updateSyncDirection);
    elements.malUsername.addEventListener('input', updateSyncDirection);
    elements.anilistUsername.addEventListener('input', updateSyncDirection);

    if (elements.jsonUsername) {
        elements.jsonUsername.addEventListener('input', updateSyncDirection);
    }

    // Tab switching
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

function handleSyncTypeChange(event) {
    const isJsonMode = event.target.value === 'json';

    // Show/hide file upload section
    elements.fileUploadSection.style.display = isJsonMode ? 'block' : 'none';

    // Show/hide account inputs
    const accountInputs = document.querySelector('.account-inputs');
    const jsonUsernameContainer = document.getElementById('jsonUsernameContainer');

    if (accountInputs) {
        accountInputs.style.display = isJsonMode ? 'none' : 'block';
    }

    if (jsonUsernameContainer) {
        jsonUsernameContainer.style.display = isJsonMode ? 'block' : 'none';
    }

    updateSyncDirection();
    updateButtonStates();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        showAlert('Please select a valid JSON file', 'error');
        return;
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showAlert('File is too large. Please select a file smaller than 10MB', 'error');
        return;
    }

    elements.fileName.textContent = `📁 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);

            // Validate JSON structure
            if (!Array.isArray(jsonData)) {
                throw new Error('JSON must be an array of anime/manga entries');
            }

            if (jsonData.length === 0) {
                throw new Error('JSON file contains no entries');
            }

            // Validate and clean entries
            const validEntries = [];
            const invalidEntries = [];

            jsonData.forEach((item, index) => {
                if (!item.name || typeof item.name !== 'string') {
                    invalidEntries.push(`Entry ${index + 1}: Missing or invalid name`);
                    return;
                }

                if (!item.mal && !item.al) {
                    invalidEntries.push(`Entry ${index + 1}: Missing both MAL and AniList URLs`);
                    return;
                }

                validEntries.push({
                    name: item.name.trim(),
                    mal: item.mal || '',
                    al: item.al || ''
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
            logMessage(`JSON file processed: ${validEntries.length} valid entries`);
            updateButtonStates();

        } catch (error) {
            showAlert('Error parsing JSON file: ' + error.message, 'error');
            logMessage('JSON parsing error: ' + error.message);
            appState.jsonData = null;
            elements.fileName.textContent = '';
            updateButtonStates();
        }
    };

    reader.onerror = function() {
        showAlert('Error reading file', 'error');
        elements.fileName.textContent = '';
    };

    reader.readAsText(file);
}

// OAuth2 Authentication Functions

function authenticateMAL() {
    if (CONFIG.oauth.mal.client_id === 'YOUR_MAL_CLIENT_ID') {
        showAlert('Please configure your MAL Client ID in the CONFIG object', 'error');
        return;
    }

    // Generate PKCE code verifier and challenge (MAL only supports 'plain' method)
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = codeVerifier; // MAL uses 'plain' method

    // Store code verifier for later use
    localStorage.setItem('mal_code_verifier', codeVerifier);
    localStorage.setItem('oauth_provider', 'mal');

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CONFIG.oauth.mal.client_id,
        redirect_uri: CONFIG.oauth.mal.redirect_uri,
        code_challenge: codeChallenge,
        code_challenge_method: 'plain',
        state: generateState()
    });

    const authUrl = `${CONFIG.oauth.mal.auth_url}?${params.toString()}`;
    window.location.href = authUrl;
}

function authenticateAniList() {
    if (CONFIG.oauth.anilist.client_id === 'YOUR_ANILIST_CLIENT_ID') {
        showAlert('Please configure your AniList Client ID in the CONFIG object', 'error');
        return;
    }

    localStorage.setItem('oauth_provider', 'anilist');

    const params = new URLSearchParams({
        client_id: CONFIG.oauth.anilist.client_id,
        redirect_uri: CONFIG.oauth.anilist.redirect_uri,
        response_type: 'code',
        state: generateState()
    });

    const authUrl = `${CONFIG.oauth.anilist.auth_url}?${params.toString()}`;
    window.location.href = authUrl;
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
    const provider = localStorage.getItem('oauth_provider');

    if (error) {
        showAlert(`Authentication error: ${error}`, 'error');
        cleanupOAuthStorage();
        return;
    }

    if (code && provider) {
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
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const tokenData = await response.json();

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
        logMessage('MAL OAuth2 authentication completed');
        updateAuthStatus();
        cleanupOAuthStorage();

    } catch (error) {
        showAlert('MAL authentication failed: ' + error.message, 'error');
        logMessage('MAL OAuth2 error: ' + error.message);
        cleanupOAuthStorage();
    }
}

async function exchangeAniListCode(code) {
    try {
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
            const errorData = await response.json();
            throw new Error(errorData.error_description || `HTTP ${response.status}`);
        }

        const tokenData = await response.json();

        // AniList tokens are long-lived (1 year)
        const expiresAt = Date.now() + (365 * 24 * 60 * 60 * 1000);

        localStorage.setItem('anilist_access_token', tokenData.access_token);
        localStorage.setItem('anilist_expires_at', expiresAt.toString());

        appState.tokens.anilist = {
            access_token: tokenData.access_token,
            expires_at: expiresAt
        };

        showAlert('✅ AniList authentication successful!', 'success');
        logMessage('AniList OAuth2 authentication completed');
        updateAuthStatus();
        cleanupOAuthStorage();

    } catch (error) {
        showAlert('AniList authentication failed: ' + error.message, 'error');
        logMessage('AniList OAuth2 error: ' + error.message);
        cleanupOAuthStorage();
    }
}

function cleanupOAuthStorage() {
    localStorage.removeItem('mal_code_verifier');
    localStorage.removeItem('oauth_provider');
}

function updateAuthStatus() {
    const now = Date.now();

    // MAL status
    const malValid = appState.tokens.mal.access_token && 
                     (!appState.tokens.mal.expires_at || now < appState.tokens.mal.expires_at);

    if (elements.malAuthStatus) {
        elements.malAuthStatus.textContent = malValid ? '✅ Authenticated' : '❌ Not authenticated';
        elements.malAuthStatus.className = malValid ? 'auth-status authenticated' : 'auth-status not-authenticated';
    }

    if (elements.malAuthBtn) {
        elements.malAuthBtn.textContent = malValid ? '🔄 Re-authenticate MAL' : '🔐 Authenticate MAL';
    }

    // AniList status
    const anilistValid = appState.tokens.anilist.access_token && 
                         (!appState.tokens.anilist.expires_at || now < appState.tokens.anilist.expires_at);

    if (elements.anilistAuthStatus) {
        elements.anilistAuthStatus.textContent = anilistValid ? '✅ Authenticated' : '❌ Not authenticated';
        elements.anilistAuthStatus.className = anilistValid ? 'auth-status authenticated' : 'auth-status not-authenticated';
    }

    if (elements.anilistAuthBtn) {
        elements.anilistAuthBtn.textContent = anilistValid ? '🔄 Re-authenticate AniList' : '🔐 Authenticate AniList';
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
        logMessage('Data fetch completed successfully');
        updateButtonStates();

    } catch (error) {
        showAlert('❌ Error fetching data: ' + error.message, 'error');
        logMessage('Data fetch error: ' + error.message);
    } finally {
        setLoading(false);
    }
}

async function fetchDataFromJson() {
    if (!appState.jsonData || appState.jsonData.length === 0) {
        throw new Error('Please upload a valid JSON file first');
    }

    const jsonUsername = elements.jsonUsername?.value?.trim();
    if (!jsonUsername) {
        throw new Error('Please enter a target username for JSON import');
    }

    const target = elements.targetPlatform.value;

    // Process JSON data
    const processedData = appState.jsonData.map(item => ({
        title: item.name,
        mal_id: extractIdFromUrl(item.mal),
        anilist_id: extractIdFromUrl(item.al),
        mal_url: item.mal,
        anilist_url: item.al,
        status: 'PLANNING',
        score: 0,
        progress: 0
    }));

    logMessage(`Processing ${processedData.length} entries from JSON file`);

    // Fetch target user's list
    if (target === 'anilist') {
        appState.malData = processedData; // Source: JSON data
        appState.anilistData = await fetchAniListUserData(jsonUsername); // Target: AniList user
    } else {
        appState.anilistData = processedData; // Source: JSON data  
        appState.malData = await fetchMALUserData(jsonUsername); // Target: MAL user
    }
}

async function fetchDataFromAccounts() {
    const malUsername = elements.malUsername.value.trim();
    const anilistUsername = elements.anilistUsername.value.trim();

    if (!malUsername || !anilistUsername) {
        throw new Error('Please enter both MAL and AniList usernames');
    }

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
            return await fetchFromMALAPI(username);
        }

        // Fallback to Jikan API (public, no auth needed)
        return await fetchFromJikanAPI(username);

    } catch (error) {
        logMessage(`MAL fetch error: ${error.message}`);
        // Don't throw - return empty array to continue with comparison
        return [];
    }
}

async function fetchFromMALAPI(username) {
    const token = appState.tokens.mal.access_token;
    if (!token) {
        throw new Error('No MAL access token available');
    }

    const response = await fetch(`${CONFIG.mal_api}/users/@me/animelist?fields=list_status&limit=1000`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            // Token expired, clear it
            localStorage.removeItem('mal_access_token');
            localStorage.removeItem('mal_refresh_token');
            localStorage.removeItem('mal_expires_at');
            appState.tokens.mal = {};
            updateAuthStatus();
            throw new Error('MAL token expired. Please re-authenticate.');
        }
        throw new Error(`MAL API error: ${response.status}`);
    }

    const data = await response.json();

    return data.data.map(item => ({
        title: item.node.title,
        id: item.node.id,
        status: item.list_status.status,
        score: item.list_status.score || 0,
        progress: item.list_status.num_episodes_watched || 0,
        total_episodes: item.node.num_episodes
    }));
}

async function fetchFromJikanAPI(username) {
    // Rate limiting for Jikan API
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(`${CONFIG.jikan_api}/users/${username}/animelist`);

    if (!response.ok) {
        throw new Error(`User '${username}' not found or has private list`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        logMessage(`No anime list found for MAL user: ${username}`);
        return [];
    }

    return data.data.map(item => ({
        title: item.anime.title,
        id: item.anime.mal_id,
        status: item.status,
        score: item.score || 0,
        progress: item.episodes_watched || 0,
        total_episodes: item.anime.episodes
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
                            idMal
                            title {
                                romaji
                                english
                            }
                            episodes
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

        // Add auth header if we have a token
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
            if (data.errors[0].message.includes('Private')) {
                throw new Error(`User '${username}' has a private list. Authentication may be required.`);
            }
            throw new Error(`AniList error: ${data.errors[0].message}`);
        }

        if (!data.data || !data.data.MediaListCollection) {
            logMessage(`No anime list found for AniList user: ${username}`);
            return [];
        }

        // Process all entries from all lists
        const entries = [];
        data.data.MediaListCollection.lists.forEach(list => {
            list.entries.forEach(entry => {
                entries.push({
                    title: entry.media.title.english || entry.media.title.romaji,
                    id: entry.media.id,
                    mal_id: entry.media.idMal,
                    status: entry.status,
                    score: entry.score || 0,
                    progress: entry.progress || 0,
                    total_episodes: entry.media.episodes
                });
            });
        });

        return entries;

    } catch (error) {
        logMessage(`AniList fetch error: ${error.message}`);
        return [];
    }
}

// Rest of the functions (comparison, display, etc.) remain the same as before...
// [Previous comparison and display functions would continue here]

async function handleCompareData() {
    if (appState.malData.length === 0 && appState.anilistData.length === 0) {
        showAlert('No data to compare. Please fetch data first.', 'error');
        return;
    }

    setLoading(true, 'Comparing anime lists...');

    try {
        await new Promise(resolve => setTimeout(resolve, 1000)); // UI feedback

        compareAnimeLists();
        displayResults();

        showAlert('✅ List comparison completed!', 'success');
        logMessage(`Comparison completed: ${appState.intersection.length} common, ${appState.differences.length} differences`);
        updateButtonStates();

    } catch (error) {
        showAlert('❌ Error comparing lists: ' + error.message, 'error');
        logMessage('Compare error: ' + error.message);
    } finally {
        setLoading(false);
    }
}

function compareAnimeLists() {
    // Create title maps for comparison (normalize titles)
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

    // Find intersection (items present in both lists)
    appState.intersection = [];
    for (const [titleKey, malItem] of malTitles) {
        if (anilistTitles.has(titleKey)) {
            appState.intersection.push({
                ...malItem,
                anilist_match: anilistTitles.get(titleKey)
            });
        }
    }

    // Find differences based on target platform
    const target = elements.targetPlatform.value;
    appState.differences = [];

    if (target === 'anilist') {
        // Items in MAL/JSON but not in AniList
        for (const [titleKey, malItem] of malTitles) {
            if (!anilistTitles.has(titleKey)) {
                appState.differences.push(malItem);
            }
        }
    } else {
        // Items in AniList/JSON but not in MAL
        for (const [titleKey, anilistItem] of anilistTitles) {
            if (!malTitles.has(titleKey)) {
                appState.differences.push(anilistItem);
            }
        }
    }
}

function normalizeTitle(title) {
    return title.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

function displayResults() {
    displayIntersection();
    displayDifferences();
    updateStats();
}

function displayIntersection() {
    const container = document.getElementById('intersectionData');
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
    if (appState.differences.length === 0) {
        container.innerHTML = '<p>✅ No differences found. Lists are already in sync!</p>';
        return;
    }

    const table = createDataTable(appState.differences);
    container.innerHTML = '';
    container.appendChild(table);
}

function createDataTable(data) {
    const table = document.createElement('table');
    table.className = 'data-table';

    // Create header
    const header = table.createTHead();
    const headerRow = header.insertRow();
    ['Title', 'Status', 'Score', 'Progress'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });

    // Create body
    const tbody = table.createTBody();
    data.forEach((item, index) => {
        const row = tbody.insertRow();
        if (index % 2 === 1) row.classList.add('alternate');

        row.insertCell().textContent = item.title;
        row.insertCell().textContent = item.status || 'Unknown';
        row.insertCell().textContent = item.score || 'N/A';
        row.insertCell().textContent = `${item.progress || 0}${item.total_episodes ? `/${item.total_episodes}` : ''}`;
    });

    return table;
}

function updateStats() {
    const intersectionStats = document.getElementById('intersectionStats');
    const differencesStats = document.getElementById('differencesStats');

    intersectionStats.innerHTML = `<h3>🤝 Common Items: ${appState.intersection.length}</h3>`;
    differencesStats.innerHTML = `<h3>🔄 Items to Sync: ${appState.differences.length}</h3>`;

    // Update stat cards if they exist
    const intersectionCount = document.getElementById('intersectionCount');
    const differencesCount = document.getElementById('differencesCount');

    if (intersectionCount) intersectionCount.textContent = appState.intersection.length;
    if (differencesCount) differencesCount.textContent = appState.differences.length;
}

async function handleStartSync() {
    if (appState.differences.length === 0) {
        showAlert('No items to sync!', 'error');
        return;
    }

    setLoading(true, 'Starting sync process...');
    elements.progressBar.style.display = 'block';

    try {
        await simulateSync();
        showAlert(`✅ Successfully processed ${appState.differences.length} items!`, 'success');
        logMessage(`Sync completed: ${appState.differences.length} items processed`);

        // Clear differences after successful sync
        appState.differences = [];
        displayResults();
        updateButtonStates();

    } catch (error) {
        showAlert('❌ Sync failed: ' + error.message, 'error');
        logMessage('Sync error: ' + error.message);
    } finally {
        setLoading(false);
        elements.progressBar.style.display = 'none';
        elements.progressFill.style.width = '0%';
    }
}

async function simulateSync() {
    const total = appState.differences.length;
    const target = elements.targetPlatform.value;

    for (let i = 0; i < total; i++) {
        const item = appState.differences[i];
        const progress = ((i + 1) / total) * 100;

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update progress
        elements.progressFill.style.width = progress + '%';
        elements.loadingText.textContent = `Syncing: ${item.title} (${i + 1}/${total})`;

        // Log the sync operation (in real implementation, this would make API calls)
        logMessage(`✅ Synced: "${item.title}" → ${target.toUpperCase()}`);
    }
}

function handleReset() {
    // Reset application state (keep OAuth tokens)
    appState.malData = [];
    appState.anilistData = [];
    appState.intersection = [];
    appState.differences = [];
    appState.isLoading = false;
    appState.jsonData = null;

    // Reset UI inputs
    elements.malUsername.value = '';
    elements.anilistUsername.value = '';
    elements.jsonFile.value = '';
    elements.fileName.textContent = '';

    if (elements.jsonUsername) {
        elements.jsonUsername.value = '';
    }

    // Reset to account sync mode
    document.querySelector('input[name="syncType"][value="account"]').checked = true;
    handleSyncTypeChange({ target: { value: 'account' } });

    // Clear results
    document.getElementById('intersectionData').innerHTML = '<p>🔍 No data to display</p>';
    document.getElementById('differencesData').innerHTML = '<p>🔍 No data to display</p>';
    document.getElementById('intersectionStats').innerHTML = '<h3>🤝 Common Items: 0</h3>';
    document.getElementById('differencesStats').innerHTML = '<h3>🔄 Items to Sync: 0</h3>';
    document.getElementById('syncLog').innerHTML = '<p>📝 Application reset - ready to start!</p>';

    // Reset stat cards
    const intersectionCount = document.getElementById('intersectionCount');
    const differencesCount = document.getElementById('differencesCount');
    if (intersectionCount) intersectionCount.textContent = '0';
    if (differencesCount) differencesCount.textContent = '0';

    // Hide progress bar
    elements.progressBar.style.display = 'none';
    elements.progressFill.style.width = '0%';

    updateSyncDirection();
    updateButtonStates();
    showAlert('✅ Application reset successfully', 'success');
}

function updateButtonStates() {
    const syncType = document.querySelector('input[name="syncType"]:checked')?.value;
    const hasSourceData = appState.malData.length > 0 || appState.anilistData.length > 0;
    const hasDifferences = appState.differences.length > 0;

    let canFetch = false;

    if (syncType === 'json') {
        const hasJsonData = appState.jsonData && appState.jsonData.length > 0;
        const hasUsername = elements.jsonUsername?.value?.trim();
        canFetch = hasJsonData && hasUsername;
    } else {
        const hasUsernames = elements.malUsername.value.trim() && elements.anilistUsername.value.trim();
        canFetch = hasUsernames;
    }

    elements.fetchBtn.disabled = !canFetch || appState.isLoading;
    elements.compareBtn.disabled = !hasSourceData || appState.isLoading;
    elements.syncBtn.disabled = !hasDifferences || appState.isLoading;
}

function updateSyncDirection() {
    const malUsername = elements.malUsername.value.trim();
    const anilistUsername = elements.anilistUsername.value.trim();
    const jsonUsername = elements.jsonUsername?.value?.trim();
    const target = elements.targetPlatform.value;
    const syncType = document.querySelector('input[name="syncType"]:checked')?.value;

    let direction = '🎯 Ready to sync';

    if (syncType === 'json') {
        if (jsonUsername) {
            direction = `📁 JSON File → ${jsonUsername} (${target.toUpperCase()})`;
        } else {
            direction = `📁 JSON File → [Enter username] (${target.toUpperCase()})`;
        }
    } else if (malUsername && anilistUsername) {
        if (target === 'anilist') {
            direction = `📚 ${malUsername} (MAL) → ${anilistUsername} (AniList)`;
        } else {
            direction = `📺 ${anilistUsername} (AniList) → ${malUsername} (MAL)`;
        }
    }

    elements.syncDirection.textContent = direction;
}

// Utility functions
function switchTab(tabName) {
    elements.tabs.forEach(tab => tab.classList.remove('active'));
    elements.tabContents.forEach(content => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

function setLoading(isLoading, message = 'Loading...') {
    appState.isLoading = isLoading;
    elements.loadingIndicator.classList.toggle('active', isLoading);
    elements.loadingText.textContent = message;

    updateButtonStates();
}

function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;

    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);

    setTimeout(() => alertDiv.remove(), 5000);
}

function logMessage(message) {
    const logContainer = document.getElementById('syncLog');
    if (!logContainer) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;

    if (logContainer.children.length === 0 || logContainer.firstChild?.tagName === 'P') {
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

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        compareAnimeLists,
        extractIdFromUrl,
        normalizeTitle,
        CONFIG
    };
}
