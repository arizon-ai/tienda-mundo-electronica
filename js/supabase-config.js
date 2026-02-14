/**
 * Supabase Client Configuration
 * Mundo Electrónica - tiendamundoelectronica.com
 */
(function () {
    'use strict';

    const SUPABASE_URL = 'https://bd.clients.arizonai.cloud';
    const SUPABASE_ANON_KEY =
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MDc0MTg0MCwiZXhwIjo0OTI2NDE1NDQwLCJyb2xlIjoiYW5vbiJ9.G9y4jfrnmnceD9qmaXFSH0Q6Zj14pbZZF40F5YffaOE';

    // Initialize Supabase client
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        console.error('[MundoElectronica] Supabase JS SDK not loaded. Include the CDN script first.');
        return;
    }

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ========================
    // Auth Helpers
    // ========================

    async function signUp(email, password, fullName) {
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
        });
        return { data, error };
    }

    async function signIn(email, password) {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        return { data, error };
    }

    async function signOut() {
        const { error } = await client.auth.signOut();
        if (!error) {
            window.location.href = '/';
        }
        return { error };
    }

    async function getSession() {
        const { data, error } = await client.auth.getSession();
        return { session: data?.session || null, error };
    }

    async function getUser() {
        const { data, error } = await client.auth.getUser();
        return { user: data?.user || null, error };
    }

    async function resetPassword(email) {
        const { data, error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/authentication-pages/reset-password',
        });
        return { data, error };
    }

    async function updatePassword(newPassword) {
        const { data, error } = await client.auth.updateUser({ password: newPassword });
        return { data, error };
    }

    // ========================
    // Auth State UI Updates
    // ========================

    function updateAuthUI(session) {
        // Find sign-in links in the footer and nav
        var signInLinks = document.querySelectorAll('a[href*="sign-in"]');
        var signUpLinks = document.querySelectorAll('a[href*="sign-up"]');

        if (session && session.user) {
            // User is logged in — change "Sign In" to "Mi Cuenta" / "Sign Out"
            signInLinks.forEach(function (link) {
                if (link.closest('.footer-menu-link')) {
                    link.textContent = 'Mi Cuenta';
                    link.href = '#';
                    link.addEventListener('click', function (e) {
                        e.preventDefault();
                        signOut();
                    });
                }
            });
            signUpLinks.forEach(function (link) {
                if (link.closest('.footer-menu-link')) {
                    link.textContent = 'Cerrar Sesión';
                    link.href = '#';
                    link.addEventListener('click', function (e) {
                        e.preventDefault();
                        signOut();
                    });
                }
            });
        }
    }

    // Listen for auth changes
    client.auth.onAuthStateChange(function (event, session) {
        updateAuthUI(session);
    });

    // Initial check
    getSession().then(function (result) {
        if (result.session) {
            updateAuthUI(result.session);
        }
    });

    // ========================
    // Export to global scope
    // ========================

    window.MundoElectronica = window.MundoElectronica || {};
    window.MundoElectronica.supabase = client;
    window.MundoElectronica.auth = {
        signUp: signUp,
        signIn: signIn,
        signOut: signOut,
        getSession: getSession,
        getUser: getUser,
        resetPassword: resetPassword,
        updatePassword: updatePassword,
    };
})();
