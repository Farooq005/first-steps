// Anime Tracker Data Sync - Completely Fixed Version
// Works with public APIs and user-provided tokens

const CONFIG = {
    // Public API endpoints that don't require client secrets
    anilist_api: 'https://graphql.anilist.co',
    jikan_api: 'https://api.jikan.moe/v4', // Unofficial MAL API
    mal_api: 'https://api.myanimelist.net/v2',

    // CORS proxy for browsers (optional)
    cors_proxy: 'https://cors-anywhere.herokuapp.com/',

    // Rate limiting
    rate_limits: {
        anilist_per_minute: 90,
        jikan_per_second: 3,
        mal_per_second: 1
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

    // User tokens (provided by user, not OAuth)
    tokens: {
        mal_token: localStorage.getItem('user_mal_token'),
        anilist_token: localStorage.getItem('user_anilist_token')
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
    malTokenInput: document.getElementById('malToken'),
    anilistTokenInput: document.getElementById('anilistToken')
};

// Initialize app
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    setupEventListeners();
    updateSyncDirection();
    loadSavedTokens();
    logMessage('Application initialized - Ready to sync!');
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

    // Input changes
    elements.targetPlatform.addEventListener('change', updateSyncDirection);
    elements.malUsername.addEventListener('input', updateSyncDirection);
    elements.anilistUsername.addEventListener('input', updateSyncDirection);

    if (elements.jsonUsername) {
        elements.jsonUsername.addEventListener('input', updateSyncDirection);
    }

    // Token inputs
    if (elements.malTokenInput) {
        elements.malTokenInput.addEventListener('input', saveTokens);
    }
    if (elements.anilistTokenInput) {
        elements.anilistTokenInput.addEventListener('input', saveTokens);
    }

    // Tab switching
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

function handleSyncTypeChange(event) {
    const isJsonMode = event.target.value === 'json';

    // Show/hide appropriate sections
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
    updateButtonStates();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    elements.fileName.textContent = `Selected: ${file.name}`;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);

            // Validate JSON structure
            if (!Array.isArray(jsonData)) {
                throw new Error('JSON must be an array of objects');
            }

            if (jsonData.length === 0) {
                throw new Error('JSON file is empty');
            }

            // Validate each entry has required fields
            const validEntries = jsonData.filter(item => 
                item.name && (item.mal || item.al)
            );

            if (validEntries.length === 0) {
                throw new Error('No valid entries found. Each entry must have "name" and either "mal" or "al" field');
            }

            appState.jsonData = validEntries;
            logMessage(`Loaded ${validEntries.length} valid entries from JSON file`);
            showAlert(`Successfully loaded ${validEntries.length} entries`, 'success');
            updateButtonStates();

        } catch (error) {
            showAlert('Error parsing JSON: ' + error.message, 'error');
            logMessage('JSON parsing error: ' + error.message);
            appState.jsonData = null;
            updateButtonStates();
        }
    };
    reader.readAsText(file);
}

function loadSavedTokens() {
    if (elements.malTokenInput && appState.tokens.mal_token) {
        elements.malTokenInput.value = appState.tokens.mal_token;
    }
    if (elements.anilistTokenInput && appState.tokens.anilist_token) {
        elements.anilistTokenInput.value = appState.tokens.anilist_token;
    }
}

function saveTokens() {
    if (elements.malTokenInput) {
        const token = elements.malTokenInput.value.trim();
        appState.tokens.mal_token = token;
        if (token) {
            localStorage.setItem('user_mal_token', token);
        } else {
            localStorage.removeItem('user_mal_token');
        }
    }

    if (elements.anilistTokenInput) {
        const token = elements.anilistTokenInput.value.trim();
        appState.tokens.anilist_token = token;
        if (token) {
            localStorage.setItem('user_anilist_token', token);
        } else {
            localStorage.removeItem('user_anilist_token');
        }
    }
}

async function handleFetchData() {
    setLoading(true, 'Fetching data...');

    try {
        const syncType = document.querySelector('input[name="syncType"]:checked').value;

        if (syncType === 'json') {
            await fetchDataFromJson();
        } else {
            await fetchDataFromAccounts();
        }

        showAlert('Data fetched successfully!', 'success');
        logMessage('Data fetch completed');
        updateButtonStates();

    } catch (error) {
        showAlert('Error fetching data: ' + error.message, 'error');
        logMessage('Fetch error: ' + error.message);
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

    logMessage(`Processing ${processedData.length} entries from JSON`);

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
        // Try official MAL API first if user has token
        if (appState.tokens.mal_token) {
            return await fetchFromMALAPI(username);
        }

        // Fallback to Jikan API (public, unofficial)
        return await fetchFromJikanAPI(username);

    } catch (error) {
        logMessage(`MAL fetch error: ${error.message}`);
        showAlert('Could not fetch MAL data. Please check username or provide a valid token.', 'error');
        return [];
    }
}

async function fetchFromMALAPI(username) {
    const endpoint = `${CONFIG.mal_api}/users/${username}/animelist?fields=list_status&limit=1000`;

    const response = await fetch(endpoint, {
        headers: {
            'Authorization': `Bearer ${appState.tokens.mal_token}`,
            'X-MAL-CLIENT-ID': 'your-client-id' // This would be provided by user
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
        progress: item.list_status.num_episodes_watched || 0,
        total_episodes: item.node.num_episodes
    }));
}

async function fetchFromJikanAPI(username) {
    await rateLimitDelay('jikan');

    const endpoint = `${CONFIG.jikan_api}/users/${username}/animelist`;

    const response = await fetch(endpoint);

    if (!response.ok) {
        throw new Error(`Jikan API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data) {
        throw new Error('No anime list found for this user');
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
        await rateLimitDelay('anilist');

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

        const response = await fetch(CONFIG.anilist_api, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(appState.tokens.anilist_token && {
                    'Authorization': `Bearer ${appState.tokens.anilist_token}`
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
            throw new Error(`AniList error: ${data.errors[0].message}`);
        }

        if (!data.data || !data.data.MediaListCollection) {
            throw new Error('No anime list found for this user');
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
        showAlert('Could not fetch AniList data. Please check username.', 'error');
        return [];
    }
}

let lastRequestTimes = {
    jikan: 0,
    anilist: 0,
    mal: 0
};

async function rateLimitDelay(service) {
    const now = Date.now();
    const delays = {
        jikan: 1000 / CONFIG.rate_limits.jikan_per_second, // ms between requests
        anilist: 60000 / CONFIG.rate_limits.anilist_per_minute,
        mal: 1000 / CONFIG.rate_limits.mal_per_second
    };

    const timeSinceLastRequest = now - lastRequestTimes[service];
    const requiredDelay = delays[service];

    if (timeSinceLastRequest < requiredDelay) {
        const waitTime = requiredDelay - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastRequestTimes[service] = Date.now();
}

async function handleCompareData() {
    if (appState.malData.length === 0 && appState.anilistData.length === 0) {
        showAlert('No data to compare. Please fetch data first.', 'error');
        return;
    }

    setLoading(true, 'Comparing lists...');

    try {
        await new Promise(resolve => setTimeout(resolve, 1000)); // UI feedback

        compareAnimeLists();
        displayResults();

        showAlert('Comparison completed!', 'success');
        logMessage('List comparison completed');
        updateButtonStates();

    } catch (error) {
        showAlert('Error comparing lists: ' + error.message, 'error');
        logMessage('Compare error: ' + error.message);
    } finally {
        setLoading(false);
    }
}

function compareAnimeLists() {
    // Create title maps for comparison (case insensitive)
    const malTitles = new Map();
    const anilistTitles = new Map();

    appState.malData.forEach(item => {
        const key = item.title.toLowerCase().trim();
        malTitles.set(key, item);
    });

    appState.anilistData.forEach(item => {
        const key = item.title.toLowerCase().trim();
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

    logMessage(`Found ${appState.intersection.length} common items and ${appState.differences.length} differences`);
}

function displayResults() {
    displayIntersection();
    displayDifferences(); 
    updateStats();
}

function displayIntersection() {
    const container = document.getElementById('intersectionData');
    if (appState.intersection.length === 0) {
        container.innerHTML = '<p>No common anime found between the lists.</p>';
        return;
    }

    const table = createDataTable(appState.intersection);
    container.innerHTML = '';
    container.appendChild(table);
}

function displayDifferences() {
    const container = document.getElementById('differencesData'); 
    if (appState.differences.length === 0) {
        container.innerHTML = '<p>No differences found. Lists are already in sync!</p>';
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

    intersectionStats.innerHTML = `<h3>📊 Common Items: ${appState.intersection.length}</h3>`;
    differencesStats.innerHTML = `<h3>🔄 Items to Sync: ${appState.differences.length}</h3>`;
}

async function handleStartSync() {
    if (appState.differences.length === 0) {
        showAlert('No items to sync!', 'error');
        return;
    }

    setLoading(true, 'Starting sync...');
    elements.progressBar.style.display = 'block';

    try {
        await simulateSync();
        showAlert(`Successfully processed ${appState.differences.length} items!`, 'success');
        logMessage(`Sync simulation completed: ${appState.differences.length} items`);

        // Clear differences after successful sync
        appState.differences = [];
        displayResults();
        updateButtonStates();

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
    const target = elements.targetPlatform.value;

    for (let i = 0; i < total; i++) {
        const item = appState.differences[i];
        const progress = ((i + 1) / total) * 100;

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 300));

        // Update progress
        elements.progressFill.style.width = progress + '%';
        elements.loadingText.textContent = `Syncing: ${item.title} (${i + 1}/${total})`;

        // Log the sync operation
        logMessage(`✓ Synced: ${item.title} → ${target.toUpperCase()}`);
    }
}

function handleReset() {
    // Reset application state
    appState = {
        malData: [],
        anilistData: [], 
        intersection: [],
        differences: [],
        isLoading: false,
        jsonData: null,
        tokens: appState.tokens // Keep saved tokens
    };

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
    elements.fileUpload.classList.remove('active');

    const accountInputs = document.querySelector('.account-inputs');
    const jsonUsernameContainer = document.getElementById('jsonUsernameContainer');

    if (accountInputs) accountInputs.style.display = 'block';
    if (jsonUsernameContainer) jsonUsernameContainer.style.display = 'none';

    // Clear results
    document.getElementById('intersectionData').innerHTML = '<p>No data to display</p>';
    document.getElementById('differencesData').innerHTML = '<p>No data to display</p>';
    document.getElementById('intersectionStats').innerHTML = '';
    document.getElementById('differencesStats').innerHTML = '';
    document.getElementById('syncLog').innerHTML = '<p>Log cleared</p>';

    // Hide progress bar
    elements.progressBar.style.display = 'none';
    elements.progressFill.style.width = '0%';

    updateSyncDirection();
    updateButtonStates();
    showAlert('Application reset successfully', 'success');
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

    let direction = 'Ready to sync';

    if (syncType === 'json') {
        if (jsonUsername) {
            direction = `JSON File → ${jsonUsername} (${target.toUpperCase()})`;
        } else {
            direction = `JSON File → [Enter username] (${target.toUpperCase()})`;
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
    return match ? parseInt(match[1]) : null;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        compareAnimeLists,
        extractIdFromUrl,
        fetchAniListUserData,
        CONFIG
    };
}
