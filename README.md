# Anime Tracker Data Sync App

A modern web application that synchronizes anime and manga watchlists between MyAnimeList (MAL) and AniList platforms.

![App Screenshot](https://via.placeholder.com/800x400?text=Anime+Tracker+Data+Sync+App)

## 🚀 Features

- **Dual Platform Support**: Sync between MyAnimeList and AniList
- **JSON Import**: Import anime/manga lists from JSON files
- **Real-time Progress**: Visual feedback during sync operations
- **Comparison Engine**: Find intersections and differences between lists
- **Modern UI**: Clean, responsive design with dark theme
- **Cross-Origin Support**: Handles CORS issues with proxy configuration

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **APIs**: MyAnimeList API v2, AniList GraphQL API
- **Deployment**: GitHub Pages
- **Authentication**: OAuth2 (for production use)

## 📦 Quick Start

### Option 1: GitHub Pages Deployment

1. **Fork this repository** to your GitHub account
2. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
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

2. **Serve locally** (choose one method):
   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js (with live-server)
   npx live-server

   # Using PHP
   php -S localhost:8000
   ```

3. **Open in browser**: Navigate to `http://localhost:8000`

## 🔧 Configuration

### For Production Use (Real API Integration)

1. **MyAnimeList API Setup**:
   - Register your app at [MAL API Config](https://myanimelist.net/apiconfig)
   - Get your `client_id` and `client_secret`
   - Set up OAuth2 redirect URI

2. **AniList API Setup**:
   - Create an app at [AniList Developer Settings](https://anilist.co/settings/developer)
   - Configure redirect URI for your domain

3. **Update Configuration**:
   ```javascript
   // In app.js, update CONFIG object
   const CONFIG = {
       demo_mode: false, // Set to false for production
       mal_client_id: 'your_mal_client_id',
       anilist_client_id: 'your_anilist_client_id',
       redirect_uri: 'your_app_url/callback'
   };
   ```

### Environment Variables (Optional)

Create a `.env` file for sensitive configuration:
```env
MAL_CLIENT_ID=your_mal_client_id
MAL_CLIENT_SECRET=your_mal_client_secret
ANILIST_CLIENT_ID=your_anilist_client_id
ANILIST_CLIENT_SECRET=your_anilist_client_secret
```

## 🚀 Deployment Guide

### GitHub Pages (Recommended)

1. **Create GitHub Repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/anime-tracker-sync.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Repository Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: "main" / "(root)"
   - Save changes

3. **Custom Domain** (Optional):
   - Add `CNAME` file with your domain
   - Configure DNS settings

### Alternative Deployment Options

#### Netlify
1. Connect your GitHub repository
2. Build settings: 
   - Build command: (leave empty)
   - Publish directory: `/`
3. Deploy

#### Vercel
1. Import GitHub repository
2. Framework preset: "Other"
3. Build command: (leave empty)
4. Output directory: `./`
5. Deploy

#### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 📱 Usage

### Account Sync Mode

1. **Enter Usernames**: Input your MAL and AniList usernames
2. **Select Target**: Choose which platform to sync to
3. **Fetch Data**: Click "Fetch Data" to retrieve lists
4. **Compare**: Click "Compare Lists" to analyze differences
5. **Sync**: Click "Start Sync" to transfer missing entries

### JSON Import Mode

1. **Select JSON Import**: Switch to JSON file import mode
2. **Upload File**: Choose your JSON file (see format below)
3. **Select Target**: Choose destination platform
4. **Process**: Follow the fetch → compare → sync workflow

#### JSON Format
```json
[
  {
    "name": "Attack on Titan",
    "mal": "https://myanimelist.net/anime/16498/",
    "al": "https://anilist.co/anime/16498/"
  },
  {
    "name": "Death Note", 
    "mal": "https://myanimelist.net/anime/1535/",
    "al": ""
  }
]
```

## 🔒 Security & Authentication

### Production Security Checklist

- [ ] Implement proper OAuth2 flows
- [ ] Store tokens securely (not in localStorage)
- [ ] Use HTTPS for all API calls
- [ ] Validate all user inputs
- [ ] Implement rate limiting
- [ ] Add CSRF protection
- [ ] Sanitize API responses

### OAuth2 Implementation

```javascript
// Example OAuth2 flow for MAL
async function authenticateMAL() {
    const authUrl = `https://myanimelist.net/v1/oauth2/authorize?` +
        `response_type=code&` +
        `client_id=${MAL_CLIENT_ID}&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=plain&` +
        `redirect_uri=${REDIRECT_URI}`;

    window.location.href = authUrl;
}
```

## 🐛 Troubleshooting

### Common Issues

**CORS Errors**:
- For development, use a CORS proxy
- For production, implement proper backend authentication
- Consider using browser extensions for testing

**API Rate Limits**:
- Implement exponential backoff
- Add delay between requests
- Cache responses when possible

**Authentication Failures**:
- Verify client credentials
- Check redirect URI configuration
- Ensure proper OAuth2 flow implementation

### Debug Mode

Enable debug logging:
```javascript
// Add to app.js
const DEBUG = true;

function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[DEBUG] ${message}`, data);
    }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow ES6+ standards
- Maintain responsive design
- Add error handling for all API calls
- Write descriptive commit messages
- Test on multiple browsers

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [MyAnimeList](https://myanimelist.net/) for their API
- [AniList](https://anilist.co/) for their GraphQL API
- [GitHub Pages](https://pages.github.com/) for free hosting
- The anime community for inspiration

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/anime-tracker-sync/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/anime-tracker-sync/discussions)
- **Email**: your.email@example.com

---

**Note**: This application is for personal use and educational purposes. Please respect the terms of service of both MyAnimeList and AniList APIs.
