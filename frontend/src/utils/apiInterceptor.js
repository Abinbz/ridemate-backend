/**
 * Global API Interceptor for fetch
 * This overrides the native fetch to globally handle specific error codes, 
 * like 403 Forbidden which is returned when a user is banned.
 */

const originalFetch = window.fetch;

window.fetch = async (...args) => {
    try {
        const response = await originalFetch(...args);
        
        // Handle 403 Forbidden (Banned user attempt)
        if (response.status === 403) {
            const clone = response.clone();
            const data = await clone.json().catch(() => ({}));
            
            // Specifically handling the ban message
            if (data.message && (data.message.toLowerCase().includes('banned') || data.message.toLowerCase().includes('suspended') || data.message.toLowerCase().includes('restricted'))) {
                console.warn("[BAN INTERCEPT] User is banned. Clearing session...");
                
                // Alert the user
                alert("ACCESS DENIED: Your account has been restricted or banned from using this platform.");
                
                // Clear local session data
                localStorage.clear();
                
                // Redirect to login/home
                window.location.href = '/';
            }
        }
        
        return response;
    } catch (error) {
        console.error("[FETCH INTERCEPT ERROR]", error);
        throw error;
    }
};

console.log("🛡️ Global API Security Interceptor initialized.");
