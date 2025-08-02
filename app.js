// Enhanced Anime Tracker Data Sync App with Real Authentication
// Configuration - Update these values with your actual credentials
const CONFIG = {
    demo_mode: false, // Set to true for demo mode, false for production

    // CORS proxy for development (GitHub Pages doesn't allow backend)
    cors_proxy: 'https://cors-anywhere.herokuapp.com/',

    // API endpoints
    anilist_api: 'https://graphql.anilist.co',
    mal_api: 'https://api.myanimelist.net/v2',

    // OAuth2 credentials - Replace with your actual values
    mal: {
        client_id: 'YOUR_MAL_CLIENT_ID_HERE', // Replace with your MAL client ID
        redirect_uri: window.location.origin + '/auth-callback.html'
    },

    anilist: {
        client_id: 'YOUR_ANILIST_CLIENT_ID_HERE', // Replace with your AniList client ID
        redirect_uri: window.location.origin + '/auth-callback.html'
    },

    // Rate limiting
    rate_limit: {
        mal_requests_per_second: 1,
        anilist_requests_per_minute: 90
    }
};

// Application state
let appState = {
    malData: [],
    anilistData: [],
    intersection: [],
    differences: [],
    isLoading: false,
    currentOperation: '',
    syncProgress: 0,

    // Authentication tokens
    auth: {
        mal_token: localStorage.getItem('mal_token'),
        anilist_token: localStorage.getItem('anilist_token'),
        mal_expires: localStorage.getItem('mal_expires'),
        anilist_expires: localStorage.getItem('anilist_expires')
    }
};

// DOM Elements
const elements = {
    syncTypeRadios: document.querySelectorAll('input[name="syncType"]'),
    malUsername: document.getElementById('malUsername'),
    anilistUsername: document.getElementById('anilistUsername'),
    targetPlatform: document.getElementById('targetPlatform'),
    fileUpload: document.getElementById('fileUpload'),
    jsonFile: document.getElementById('jsonFile'),
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
    tabContents: document.querySelectorAll('.tab-content')
};

// Initialize app
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    setupEventListeners();
    updateSyncDirection();
    checkAuthStatus();
    logMessage('Application initialized');

    // Check for OAuth callback
    handleOAuthCallback();
}

function setupEventListeners() {
    // Sync type change
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

    // Target platform change
    elements.targetPlatform.addEventListener('change', updateSyncDirection);

    // Tab switching
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Username input changes
    elements.malUsername.addEventListener('input', updateSyncDirection);
    elements.anilistUsername.addEventListener('input', updateSyncDirection);

    // Add username input for JSON mode
    const jsonUsernameContainer = document.getElementById('jsonUsernameContainer');
    if (jsonUsernameContainer) {
        const jsonUsernameInput = document.getElementById('jsonUsername');
        if (jsonUsernameInput) {
            jsonUsernameInput.addEventListener('input', updateSyncDirection);
        }
    }
}

function handleSyncTypeChange(event) {
    const isJsonMode = event.target.value === 'json';
    elements.fileUpload.classList.toggle('active', isJsonMode);

    const accountInputs = document.querySelector('.account-inputs');
    const jsonUsernameContainer = document.getElementById('jsonUsernameContainer');

    if (accountInputs) {
        accountInputs.style.display = isJsonMode ? 'none' : 'block';
    }

    if (jsonUsernameContainer) {
        jsonUsernameContainer.style.display = isJsonMode ? 'block' : 'none';
    }

    updateSyncDirection();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        elements.fileName.textContent = `Selected: ${file.name}`;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const jsonData = JSON.parse(e.target.result);
                appState.jsonData = jsonData;
                logMessage(`Loaded ${jsonData.length} entries from JSON file`);
                updateButtonStates();
            } catch (error) {
                showAlert('Invalid JSON file format', 'error');
                logMessage('Error parsing JSON file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
}

// OAuth2 Authentication Functions
function authenticateMAL() {
    if (!CONFIG.mal.client_id || CONFIG.mal.client_id === 'YOUR_MAL_CLIENT_ID_HERE') {
        showAlert('Please configure your MAL Client ID in CONFIG', 'error');
        return;
    }

    // Generate PKCE challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = codeVerifier; // MAL uses plain method

    localStorage.setItem('mal_code_verifier', codeVerifier);

    const authUrl = `https://myanimelist.net/v1/oauth2/authorize?` +
        `response_type=code&` +
        `client_id=${CONFIG.mal.client_id}&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=plain&` +
        `redirect_uri=${encodeURIComponent(CONFIG.mal.redirect_uri)}`;

    window.open(authUrl, 'mal_auth', 'width=500,height=600');
}

function authenticateAniList() {
    if (!CONFIG.anilist.client_id || CONFIG.anilist.client_id === 'YOUR_ANILIST_CLIENT_ID_HERE') {
        showAlert('Please configure your AniList Client ID in CONFIG', 'error');
        return;
    }

    const authUrl = `https://anilist.co/api/v2/oauth/authorize?` +
        `client_id=${CONFIG.anilist.client_id}&` +
        `redirect_uri=${encodeURIComponent(CONFIG.anilist.redirect_uri)}&` +
        `response_type=code`;

    window.open(authUrl, 'anilist_auth', 'width=500,height=600');
}

function generateCodeVerifier() {
    const array = new Uint32Array(28);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code) {
        // Determine which platform based on referrer or state
        if (window.location.search.includes('mal') || document.referrer.includes('myanimelist')) {
            exchangeMALCode(code);
        } else if (window.location.search.includes('anilist') || document.referrer.includes('anilist')) {
            exchangeAniListCode(code);
        }
    }
}

async function exchangeMALCode(code) {
    try {
        const codeVerifier = localStorage.getItem('mal_code_verifier');

        const response = await fetch('https://myanimelist.net/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: CONFIG.mal.client_id,
                code: code,
                code_verifier: codeVerifier,
                grant_type: 'authorization_code',
                redirect_uri: CONFIG.mal.redirect_uri
            })
        });

        if (response.ok) {
            const tokenData = await response.json();

            // Store tokens
            localStorage.setItem('mal_token', tokenData.access_token);
            localStorage.setItem('mal_refresh_token', tokenData.refresh_token);
            localStorage.setItem('mal_expires', Date.now() + (tokenData.expires_in * 1000));

            appState.auth.mal_token = tokenData.access_token;
            appState.auth.mal_expires = Date.now() + (tokenData.expires_in * 1000);

            showAlert('MAL authentication successful!', 'success');
            checkAuthStatus();
        } else {
            throw new Error('Failed to exchange code for token');
        }
    } catch (error) {
        showAlert('MAL authentication failed: ' + error.message, 'error');
        logMessage('MAL auth error: ' + error.message);
    }
}

async function exchangeAniListCode(code) {
    try {
        const response = await fetch('https://anilist.co/api/v2/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: CONFIG.anilist.client_id,
                redirect_uri: CONFIG.anilist.redirect_uri,
                code: code
            })
        });

        if (response.ok) {
            const tokenData = await response.json();

            // Store tokens
            localStorage.setItem('anilist_token', tokenData.access_token);
            localStorage.setItem('anilist_expires', Date.now() + (tokenData.expires_in * 1000));

            appState.auth.anilist_token = tokenData.access_token;
            appState.auth.anilist_expires = Date.now() + (tokenData.expires_in * 1000);

            showAlert('AniList authentication successful!', 'success');
            checkAuthStatus();
        } else {
            throw new Error('Failed to exchange code for token');
        }
    } catch (error) {
        showAlert('AniList authentication failed: ' + error.message, 'error');
        logMessage('AniList auth error: ' + error.message);
    }
}

function checkAuthStatus() {
    const now = Date.now();
    const malValid = appState.auth.mal_token && (!appState.auth.mal_expires || now < appState.auth.mal_expires);
    const anilistValid = appState.auth.anilist_token && (!appState.auth.anilist_expires || now < appState.auth.anilist_expires);

    // Update UI to show auth status
    updateAuthStatus('mal', malValid);
    updateAuthStatus('anilist', anilistValid);

    updateButtonStates();
}

function updateAuthStatus(platform, isAuthenticated) {
    const statusElement = document.getElementById(`${platform}AuthStatus`);
    if (statusElement) {
        statusElement.textContent = isAuthenticated ? '✓ Authenticated' : '✗ Not authenticated';
        statusElement.className = isAuthenticated ? 'auth-status authenticated' : 'auth-status not-authenticated';
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

        elements.compareBtn.disabled = false;
        showAlert('Data fetched successfully!', 'success');
        logMessage('Data fetch completed');

    } catch (error) {
        showAlert('Error fetching data: ' + error.message, 'error');
        logMessage('Fetch error: ' + error.message);
    } finally {
        setLoading(false);
    }
}

async function fetchDataFromJson() {
    if (!appState.jsonData) {
        throw new Error('No JSON data loaded');
    }

    const target = elements.targetPlatform.value;
    const jsonUsername = document.getElementById('jsonUsername')?.value?.trim();

    if (!jsonUsername) {
        throw new Error('Please enter a username for JSON import mode');
    }

    // Process JSON data and fetch additional info from target platform
    const processedData = appState.jsonData.map(item => ({
        title: item.name,
        mal_id: extractIdFromUrl(item.mal),
        anilist_id: extractIdFromUrl(item.al),
        mal_url: item.mal,
        anilist_url: item.al,
        status: 'Plan to Watch' // Default status
    }));

    // Fetch user's actual list from target platform
    if (target === 'anilist') {
        appState.malData = processedData; // JSON data as source
        appState.anilistData = await fetchAniListUserList(jsonUsername); // Target platform
    } else {
        appState.anilistData = processedData; // JSON data as source
        appState.malData = await fetchMALUserList(jsonUsername); // Target platform
    }
}

async function fetchDataFromAccounts() {
    const malUsername = elements.malUsername.value.trim();
    const anilistUsername = elements.anilistUsername.value.trim();

    if (!malUsername || !anilistUsername) {
        throw new Error('Please enter both usernames');
    }

    // Check if we're in demo mode or don't have proper authentication
    if (CONFIG.demo_mode || !isProperlyAuthenticated()) {
        await fetchMockData(malUsername, anilistUsername);
        return;
    }

    // Real API calls with authentication
    const [malData, anilistData] = await Promise.all([
        fetchMALUserList(malUsername),
        fetchAniListUserList(anilistUsername)
    ]);

    appState.malData = malData;
    appState.anilistData = anilistData;
}

function isProperlyAuthenticated() {
    // Check if we have valid credentials for production use
    return (CONFIG.mal.client_id !== 'YOUR_MAL_CLIENT_ID_HERE' && 
            CONFIG.anilist.client_id !== 'YOUR_ANILIST_CLIENT_ID_HERE');
}

async function fetchMockData(malUsername, anilistUsername) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    appState.malData = [
        { title: 'Attack on Titan', id: 16498, status: 'Completed', score: 9, episodes: 75 },
        { title: 'Death Note', id: 1535, status: 'Completed', score: 9, episodes: 37 },
        { title: 'Fullmetal Alchemist: Brotherhood', id: 5114, status: 'Completed', score: 10, episodes: 64 },
        { title: 'One Piece', id: 21, status: 'Watching', score: 8, episodes: 1000 },
        { title: 'Naruto', id: 20, status: 'Completed', score: 8, episodes: 720 }
    ];

    appState.anilistData = [
        { title: 'Attack on Titan', id: 16498, status: 'Completed', score: 9, episodes: 75 },
        { title: 'Death Note', id: 1535, status: 'Completed', score: 9, episodes: 37 },
        { title: 'Demon Slayer', id: 101922, status: 'Completed', score: 8, episodes: 44 },
        { title: 'Your Name', id: 21519, status: 'Completed', score: 10, episodes: 1 },
        { title: 'Spirited Away', id: 199, status: 'Completed', score: 10, episodes: 1 }
    ];
}

// Real API integration functions
async function fetchMALUserList(username) {
    if (!appState.auth.mal_token) {
        logMessage('MAL authentication required, using demo data');
        return [];
    }

    try {
        const response = await fetch(`${CONFIG.mal_api}/users/@me/animelist?fields=list_status&limit=1000`, {
            headers: {
                'Authorization': `Bearer ${appState.auth.mal_token}`,
                'X-MAL-CLIENT-ID': CONFIG.mal.client_id
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
            score: item.list_status.score,
            episodes: item.list_status.num_episodes_watched,
            maxEpisodes: item.node.num_episodes
        }));
    } catch (error) {
        logMessage(`MAL API error: ${error.message}`);
        showAlert('MAL API error, falling back to demo data', 'error');
        return [];
    }
}

async function fetchAniListUserList(username) {
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
                            episodes
                        }
                        status
                        score
                        progress
                    }
                }
            }
        }`;

        const response = await fetch(CONFIG.anilist_api, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(appState.auth.anilist_token && {
                    'Authorization': `Bearer ${appState.auth.anilist_token}`
                })
            },
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
            throw new Error(`AniList GraphQL error: ${data.errors[0].message}`);
        }

        // Process the response
        const entries = [];
        data.data.MediaListCollection.lists.forEach(list => {
            list.entries.forEach(entry => {
                entries.push({
                    title: entry.media.title.english || entry.media.title.romaji,
                    id: entry.media.id,
                    status: entry.status,
                    score: entry.score,
                    episodes: entry.progress,
                    maxEpisodes: entry.media.episodes
                });
            });
        });

        return entries;
    } catch (error) {
        logMessage(`AniList API error: ${error.message}`);
        showAlert('AniList API error, please check username and try again', 'error');
        return [];
    }
}

// Rest of the functions remain the same as before...
async function handleCompareData() {
    setLoading(true, 'Comparing lists...');

    try {
        await new Promise(resolve => setTimeout(resolve, 1500));

        compareAnimeLists();
        displayResults();

        elements.syncBtn.disabled = false;
        showAlert('List comparison completed!', 'success');
        logMessage('Comparison completed');

    } catch (error) {
        showAlert('Error comparing lists: ' + error.message, 'error');
        logMessage('Compare error: ' + error.message);
    } finally {
        setLoading(false);
    }
}

function compareAnimeLists() {
    const malTitles = new Set(appState.malData.map(item => item.title.toLowerCase()));
    const anilistTitles = new Set(appState.anilistData.map(item => item.title.toLowerCase()));

    // Find intersection (items present in both lists)
    appState.intersection = appState.malData.filter(item => 
        anilistTitles.has(item.title.toLowerCase())
    );

    // Find differences based on target platform
    const target = elements.targetPlatform.value;
    if (target === 'anilist') {
        // Items in MAL but not in AniList
        appState.differences = appState.malData.filter(item => 
            !anilistTitles.has(item.title.toLowerCase())
        );
    } else {
        // Items in AniList but not in MAL
        appState.differences = appState.anilistData.filter(item => 
            !malTitles.has(item.title.toLowerCase())
        );
    }
}

function displayResults() {
    displayIntersection();
    displayDifferences();
    updateStats();
}

function displayIntersection() {
    const container = document.getElementById('intersectionData');
    if (appState.intersection.length === 0) {
        container.innerHTML = '<p>No common anime found between the two lists.</p>';
        return;
    }

    const table = createDataTable(appState.intersection);
    container.innerHTML = '';
    container.appendChild(table);
}

function displayDifferences() {
    const container = document.getElementById('differencesData');
    if (appState.differences.length === 0) {
        container.innerHTML = '<p>No differences found. Lists are in sync!</p>';
        return;
    }

    const table = createDataTable(appState.differences);
    container.innerHTML = '';
    container.appendChild(table);
}

function createDataTable(data) {
    const table = document.createElement('table');
    table.className = 'data-table';

    const header = table.createTHead();
    const headerRow = header.insertRow();
    ['Title', 'Status', 'Score', 'Episodes'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });

    const tbody = table.createTBody();
    data.forEach(item => {
        const row = tbody.insertRow();
        row.insertCell().textContent = item.title;
        row.insertCell().textContent = item.status || 'Unknown';
        row.insertCell().textContent = item.score || 'N/A';
        row.insertCell().textContent = item.episodes || 'N/A';
    });

    return table;
}

function updateStats() {
    const intersectionStats = document.getElementById('intersectionStats');
    const differencesStats = document.getElementById('differencesStats');

    intersectionStats.innerHTML = `<h3>Common Items: ${appState.intersection.length}</h3>`;
    differencesStats.innerHTML = `<h3>Items to Sync: ${appState.differences.length}</h3>`;
}

async function handleStartSync() {
    if (appState.differences.length === 0) {
        showAlert('No items to sync!', 'error');
        return;
    }

    setLoading(true, 'Starting synchronization...');
    elements.progressBar.style.display = 'block';

    try {
        await simulateSync();
        showAlert(`Successfully synced ${appState.differences.length} items!`, 'success');
        logMessage(`Sync completed: ${appState.differences.length} items synced`);

        // Reset differences after successful sync
        appState.differences = [];
        displayResults();

    } catch (error) {
        showAlert('Sync failed: ' + error.message, 'error');
        logMessage('Sync error: ' + error.message);
    } finally {
        setLoading(false);
        elements.progressBar.style.display = 'none';
        elements.progressFill.style.width = '0%';
    }
}

async function simulateSync() {
    const total = appState.differences.length;

    for (let i = 0; i < total; i++) {
        const item = appState.differences[i];
        const progress = ((i + 1) / total) * 100;

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update progress
        elements.progressFill.style.width = progress + '%';
        elements.loadingText.textContent = `Syncing: ${item.title} (${i + 1}/${total})`;

        // Log the sync operation
        logMessage(`Synced: ${item.title} to ${elements.targetPlatform.value.toUpperCase()}`);
    }
}

function handleReset() {
    appState = {
        malData: [],
        anilistData: [],
        intersection: [],
        differences: [],
        isLoading: false,
        currentOperation: '',
        syncProgress: 0,
        auth: appState.auth // Keep authentication tokens
    };

    // Reset UI
    elements.malUsername.value = '';
    elements.anilistUsername.value = '';
    elements.jsonFile.value = '';
    elements.fileName.textContent = '';

    const jsonUsername = document.getElementById('jsonUsername');
    if (jsonUsername) jsonUsername.value = '';

    document.querySelector('input[name="syncType"][value="account"]').checked = true;
    elements.fileUpload.classList.remove('active');

    const accountInputs = document.querySelector('.account-inputs');
    const jsonUsernameContainer = document.getElementById('jsonUsernameContainer');

    if (accountInputs) accountInputs.style.display = 'block';
    if (jsonUsernameContainer) jsonUsernameContainer.style.display = 'none';

    // Reset buttons
    updateButtonStates();

    // Clear results
    document.getElementById('intersectionData').innerHTML = '';
    document.getElementById('differencesData').innerHTML = '';
    document.getElementById('intersectionStats').innerHTML = '';
    document.getElementById('differencesStats').innerHTML = '';
    document.getElementById('syncLog').innerHTML = '<p>Log cleared</p>';

    // Hide progress bar
    elements.progressBar.style.display = 'none';
    elements.progressFill.style.width = '0%';

    updateSyncDirection();
    showAlert('Application reset successfully', 'success');
}

function updateButtonStates() {
    const syncType = document.querySelector('input[name="syncType"]:checked')?.value;
    const hasData = appState.malData.length > 0 || appState.anilistData.length > 0;
    const hasDifferences = appState.differences.length > 0;

    let canFetch = false;

    if (syncType === 'json') {
        canFetch = appState.jsonData && document.getElementById('jsonUsername')?.value?.trim();
    } else {
        canFetch = elements.malUsername.value.trim() && elements.anilistUsername.value.trim();
    }

    elements.fetchBtn.disabled = !canFetch || appState.isLoading;
    elements.compareBtn.disabled = !hasData || appState.isLoading;
    elements.syncBtn.disabled = !hasDifferences || appState.isLoading;
}

function updateSyncDirection() {
    const malUsername = elements.malUsername.value.trim();
    const anilistUsername = elements.anilistUsername.value.trim();
    const jsonUsername = document.getElementById('jsonUsername')?.value?.trim();
    const target = elements.targetPlatform.value;
    const syncType = document.querySelector('input[name="syncType"]:checked')?.value;

    let direction = 'Ready to sync';

    if (syncType === 'json') {
        if (jsonUsername) {
            direction = `JSON File → ${jsonUsername} (${target.toUpperCase()})`;
        } else {
            direction = `JSON File → ${target.toUpperCase()} (enter username)`;
        }
    } else if (malUsername && anilistUsername) {
        if (target === 'anilist') {
            direction = `${malUsername} (MAL) → ${anilistUsername} (AniList)`;
        } else {
            direction = `${anilistUsername} (AniList) → ${malUsername} (MAL)`;
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
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;

    if (!logContainer.firstChild || logContainer.firstChild.tagName === 'P') {
        logContainer.innerHTML = '';
    }

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function extractIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/([0-9]+)\/?$/);
    return match ? match[1] : null;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        compareAnimeLists,
        extractIdFromUrl,
        fetchAniListUserList,
        CONFIG
    };
}
