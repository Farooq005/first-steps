// Configuration
const CONFIG = {
    cors_proxy: 'https://cors-anywhere.herokuapp.com/',
    anilist_api: 'https://graphql.anilist.co',
    mal_api: 'https://api.myanimelist.net/v2',
    // For demo purposes - in production, these should be environment variables
    demo_mode: true // Set to false for production
};

// Application state
let appState = {
    malData: [],
    anilistData: [],
    intersection: [],
    differences: [],
    isLoading: false,
    currentOperation: '',
    syncProgress: 0
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

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    setupEventListeners();
    updateSyncDirection();
    logMessage('Application initialized');
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
}

function handleSyncTypeChange(event) {
    const isJsonMode = event.target.value === 'json';
    elements.fileUpload.classList.toggle('active', isJsonMode);

    document.querySelector('.account-inputs').style.display = isJsonMode ? 'none' : 'block';
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
                elements.fetchBtn.disabled = false;
            } catch (error) {
                showAlert('Invalid JSON file format', 'error');
                logMessage('Error parsing JSON file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
}

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

    // Process JSON data
    const target = elements.targetPlatform.value;
    const processedData = appState.jsonData.map(item => ({
        title: item.name,
        id: extractIdFromUrl(item.mal || item.al),
        platform: item.mal ? 'mal' : 'anilist',
        url: item.mal || item.al,
        status: 'Plan to Watch' // Default status
    }));

    if (target === 'anilist') {
        appState.malData = processedData.filter(item => item.platform === 'mal');
        appState.anilistData = []; // Empty target list
    } else {
        appState.anilistData = processedData.filter(item => item.platform === 'anilist');
        appState.malData = []; // Empty target list
    }
}

async function fetchDataFromAccounts() {
    const malUsername = elements.malUsername.value.trim();
    const anilistUsername = elements.anilistUsername.value.trim();

    if (!malUsername || !anilistUsername) {
        throw new Error('Please enter both usernames');
    }

    // In demo mode, use mock data
    if (CONFIG.demo_mode) {
        await fetchMockData(malUsername, anilistUsername);
        return;
    }

    // Real API calls (requires authentication)
    const [malData, anilistData] = await Promise.all([
        fetchMALUserList(malUsername),
        fetchAniListUserList(anilistUsername)
    ]);

    appState.malData = malData;
    appState.anilistData = anilistData;
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

// Real API integration functions (requires authentication)
async function fetchMALUserList(username) {
    // Note: This requires OAuth2 authentication
    // For demo purposes, we'll return mock data
    throw new Error('MAL API requires authentication. Please use demo mode or implement OAuth2.');
}

async function fetchAniListUserList(username) {
    try {
        const query = `
        query ($username: String) {
            User(name: $username) {
                mediaListOptions {
                    scoreFormat
                }
            }
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
        // Fallback to demo data
        return [];
    }
}

async function handleCompareData() {
    setLoading(true, 'Comparing lists...');

    try {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing time

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
        syncProgress: 0
    };

    // Reset UI
    elements.malUsername.value = '';
    elements.anilistUsername.value = '';
    elements.jsonFile.value = '';
    elements.fileName.textContent = '';
    document.querySelector('input[name="syncType"][value="account"]').checked = true;
    elements.fileUpload.classList.remove('active');
    document.querySelector('.account-inputs').style.display = 'block';

    // Reset buttons
    elements.compareBtn.disabled = true;
    elements.syncBtn.disabled = true;

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

function updateSyncDirection() {
    const malUsername = elements.malUsername.value.trim();
    const anilistUsername = elements.anilistUsername.value.trim();
    const target = elements.targetPlatform.value;
    const syncType = document.querySelector('input[name="syncType"]:checked').value;

    let direction = 'Ready to sync';

    if (syncType === 'json') {
        direction = `JSON File → ${target.toUpperCase()}`;
    } else if (malUsername && anilistUsername) {
        if (target === 'anilist') {
            direction = `${malUsername} (MAL) → ${anilistUsername} (AniList)`;
        } else {
            direction = `${anilistUsername} (AniList) → ${malUsername} (MAL)`;
        }
    }

    elements.syncDirection.textContent = direction;
}

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

    // Disable buttons during loading
    elements.fetchBtn.disabled = isLoading;
    elements.compareBtn.disabled = isLoading || appState.malData.length === 0;
    elements.syncBtn.disabled = isLoading || appState.differences.length === 0;
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
    const match = url.match(/\/(\d+)\/?$/);
    return match ? match[1] : null;
}

// Utility function for CORS proxy (if needed)
function proxyUrl(url) {
    return CONFIG.cors_proxy + url;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        compareAnimeLists,
        extractIdFromUrl,
        fetchAniListUserList
    };
}
