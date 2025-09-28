const config = {
    API_BASE: process.env.NODE_ENV === 'production' 
        ? '/api'  // Same domain in production
        : 'http://localhost:5000/api'  // Local development
};

export default config;