// Configuration template for production use
// Copy this file to config.js and update with your actual values

const CONFIG = {
    // Set to false for production with real API integration
    demo_mode: false,

    // MyAnimeList API Configuration
    mal: {
        client_id: '7d40aab44a745bbefc83c9df14413f86',
        client_secret: 'b777891e34ef1d5d3972c461ed123af68d5e1d5a1699b1f0945c1c045866148b', // Keep secret on server-side
        redirect_uri: 'https://farooq005.github.io/first-steps/',
        api_base: 'https://api.myanimelist.net/v2'
    },

    // AniList API Configuration
    anilist: {
        client_id: '29038',
        client_secret: 'EESvhR7XUzdpWNhWBRYPWGJjIGcP9qW04vUhT9QW', // Keep secret on server-side
        redirect_uri: 'https://farooq005.github.io/first-steps/',
        api_base: 'https://graphql.anilist.co'
    },

    // CORS Proxy (for development only)
    cors_proxy: 'https://cors-anywhere.herokuapp.com/',

    // Rate limiting settings
    rate_limit: {
        mal_requests_per_second: 1,
        anilist_requests_per_minute: 90
    },

    // UI Settings
    ui: {
        theme: 'dark',
        auto_save: true,
        debug_mode: false
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
