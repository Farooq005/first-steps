// Configuration template for production use
// Copy this file to config.js and update with your actual values

const CONFIG = {
    // Set to false for production with real API integration
    demo_mode: false,

    // MyAnimeList API Configuration
    mal: {
        client_id: 'your_mal_client_id_here',
        client_secret: 'your_mal_client_secret_here', // Keep secret on server-side
        redirect_uri: 'https://yourdomain.com/callback',
        api_base: 'https://api.myanimelist.net/v2'
    },

    // AniList API Configuration
    anilist: {
        client_id: 'your_anilist_client_id_here',
        client_secret: 'your_anilist_client_secret_here', // Keep secret on server-side
        redirect_uri: 'https://yourdomain.com/callback',
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
