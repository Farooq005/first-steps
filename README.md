# 🚀 Anime Tracker Data Sync App

A comprehensive production-ready web application that synchronizes anime and manga watchlists between MyAnimeList (MAL) and AniList platforms with real API integration.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-production-brightgreen.svg)

## ✨ Features

### 🔄 **Dual Platform Sync**
- **Real API Integration**: Uses MyAnimeList API v2 and AniList GraphQL API
- **OAuth2 Authentication**: Secure authentication for both platforms
- **Bidirectional Sync**: Sync missing items from MAL to AniList or vice versa
- **Both Anime & Manga**: Support for both anime and manga lists

### 📁 **JSON Import/Export**
- **Flexible Format Support**: Import from MAL exports, AniList exports, or custom JSON formats
- **Drag & Drop Interface**: Easy file upload with validation
- **Format Detection**: Automatic detection of common export formats
- **Data Validation**: Real-time validation with detailed error reporting

### 🎯 **Smart Comparison Engine**
- **Advanced Title Matching**: Uses Jaro-Winkler similarity algorithm for accurate matching
- **Detailed Statistics**: Shows matches, differences, and platform-specific counts
- **Preview Before Sync**: See exactly what will be synchronized

### ⚡ **Real-time Progress Tracking**
- **Live Progress Bars**: Visual feedback during sync operations
- **Detailed Activity Logs**: Step-by-step progress with timestamps
- **Cancellable Operations**: Stop sync operations at any time
- **Export Logs**: Save sync logs for troubleshooting

### 🛡️ **Production-Ready Features**
- **Rate Limiting**: Respects API rate limits (MAL: 1 req/sec, AniList: 90 req/min)
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Retry Logic**: Automatic retry for failed requests
- **Token Management**: Automatic token refresh and secure storage

### 🎨 **Modern UI/UX**
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Theme**: Beautiful dark theme with gradient accents
- **Tabbed Interface**: Organized interface with Username Sync, JSON Import, and Settings
- **Real-time Validation**: Instant feedback on form inputs
- **Loading States**: Clear loading indicators for all operations

## 🚀 Quick Start

### Option 1: GitHub Pages (Recommended)

1. **Fork this repository** to your GitHub account
2. **Enable GitHub Pages**:
   - Go to Settings → Pages
   - Select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click "Save"
3. **Access your app** at: `https://yourusername.github.io/anime-tracker-sync`

### Option 2: Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/anime-tracker-sync.git
   cd anime-tracker-sync
   ```

2. **Serve locally**:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Access the app**: Open `http://localhost:8000` in your browser

## 🔧 Setup & Configuration

### 1. API Key Setup

#### MyAnimeList API:
1. Go to [MAL API Configuration](https://myanimelist.net/apiconfig)
2. Create a new app
3. Set the redirect URI to your app URL (e.g., `https://yourusername.github.io/anime-tracker-sync/`)
4. Copy the Client ID and update it in `src/api/malApi.js`

#### AniList API:
1. Go to [AniList Developer Settings](https://anilist.co/settings/developer)
2. Create a new client
3. Set the redirect URI to your app URL
4. Copy the Client ID and update it in `src/api/anilistApi.js`

### 2. Update Configuration

Edit the client IDs in the respective API files:

**`src/api/malApi.js`**:
```javascript
this.clientId = 'YOUR_MAL_CLIENT_ID';
```

**`src/api/anilistApi.js`**:
```javascript
this.clientId = 'YOUR_ANILIST_CLIENT_ID';
```

## 📖 Usage Guide

### Username-Based Sync

1. **Authenticate**: Click "Connect" for both MAL and AniList platforms
2. **Enter Usernames**: Input MAL and AniList usernames
3. **Select Data Type**: Choose between Anime or Manga
4. **Choose Direction**: Select which platform to sync to
5. **Fetch & Compare**: Click to retrieve and compare lists
6. **Review Results**: Check the comparison statistics
7. **Start Sync**: Begin the synchronization process

### JSON Import

1. **Switch to JSON Import Tab**
2. **Upload File**: Drag & drop or select a JSON file
3. **Review Validation**: Check for any format issues
4. **Process File**: Click "Process File" to import
5. **Switch to Sync Tab**: Review imported data
6. **Select Target**: Choose where to sync the data
7. **Start Sync**: Begin synchronization

### Supported JSON Formats

#### Format 1: URL-Based (Recommended)
```json
[
  {
    "name": "Attack on Titan",
    "mal": "https://myanimelist.net/manga/23390/",
    "al": "https://anilist.co/manga/53390/"
  },
  {
    "name": "Death Note",
    "mal": "https://myanimelist.net/manga/21/",
    "al": ""
  }
]
```

**Advantages**:
- **Precise Matching**: Uses exact IDs from URLs for 100% accuracy
- **Smart Filtering**: Automatically identifies items missing from each platform
- **No Search Required**: Direct ID mapping eliminates search failures
- **Supports Missing Items**: Empty URL strings ("") indicate missing items

#### Format 2: Metadata-Based
```json
[
  {
    "title": "Attack on Titan",
    "status": "completed",
    "score": 9,
    "progress": 87,
    "total_episodes": 87,
    "start_date": "2023-01-15",
    "finish_date": "2023-04-10",
    "notes": "Amazing series!",
    "tags": ["shounen", "action"]
  }
]
```

**Flexible Field Names**:
- Title: `title`, `name`, `series_title`
- Score: `score`, `my_score`, `rating`
- Progress: `progress`, `watched_episodes`, `read_chapters`
- Status: `status`, `my_status`

## 🏗️ Architecture

```
anime-tracker-sync/
├── index.html                 # Main application
├── src/
│   ├── api/
│   │   ├── malApi.js         # MyAnimeList API service
│   │   └── anilistApi.js     # AniList API service
│   ├── services/
│   │   └── syncService.js    # Core synchronization logic
│   └── components/
│       ├── ProgressTracker.js # Progress tracking component
│       └── JsonImporter.js   # JSON import component
├── sample-data.json          # Sample JSON for testing
├── config.template.js        # Configuration template
└── README.md                 # This file
```

### Key Components

- **API Services**: Modular API integrations with authentication
- **Sync Service**: Core business logic for comparison and synchronization
- **Progress Tracker**: Real-time progress monitoring with visual feedback
- **JSON Importer**: File upload and validation component

## 🔒 Security & Privacy

- **OAuth2 Flow**: Secure authentication using industry standards
- **Local Storage**: Tokens stored locally in browser (never sent to third parties)
- **HTTPS Required**: OAuth flows require HTTPS for security
- **No Server**: Purely client-side application for maximum privacy
- **Rate Limiting**: Respects API rate limits to prevent abuse

## 🐛 Troubleshooting

### Common Issues

1. **Authentication Failed**:
   - Check client IDs are correct
   - Ensure redirect URI matches exactly
   - Clear browser cache and try again

2. **CORS Errors**:
   - Make sure you're using HTTPS (required for OAuth)
   - Check that redirect URIs are configured correctly

3. **Rate Limited**:
   - The app automatically handles rate limits
   - Wait for the rate limit window to reset

4. **Import Errors**:
   - Check JSON format is valid
   - Ensure required fields (title) are present
   - Try the sample-data.json file for testing

### Debug Information

The Settings tab provides debug information including:
- Authentication status
- Current operation state
- Browser information
- Timestamps

## 🧪 Testing

### Test with Sample Data

1. Download `sample-data.json` from the repository
2. Use the JSON Import feature to test the application
3. Try syncing to a test account to verify functionality

### Manual Testing Checklist

- [ ] OAuth authentication for both platforms
- [ ] Username-based sync for anime
- [ ] Username-based sync for manga
- [ ] JSON import with various formats
- [ ] Progress tracking and cancellation
- [ ] Error handling and validation
- [ ] Mobile responsiveness

## 🚀 Deployment

### GitHub Pages (Recommended)

1. Fork the repository
2. Update API client IDs
3. Enable GitHub Pages
4. Configure your domain (optional)

### Custom Hosting

1. Upload all files to your web server
2. Ensure HTTPS is enabled
3. Update OAuth redirect URIs
4. Test all functionality

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

## 📄 API Documentation

### MyAnimeList API v2
- [Official Documentation](https://myanimelist.net/apiconfig/references/api/v2)
- [Authentication Guide](https://myanimelist.net/apiconfig/references/authorization)

### AniList GraphQL API
- [Official Documentation](https://anilist.gitbook.io/anilist-apiv2-docs/)
- [GraphQL Playground](https://anilist.co/graphiql)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- MyAnimeList for providing the API
- AniList for the GraphQL API
- The anime community for inspiration and feedback

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/anime-tracker-sync/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/anime-tracker-sync/discussions)

---

**⭐ Star this repository if you find it helpful!**

Made with ❤️ for the anime community
