/**
 * Cart Manager — Mundo Electrónica
 * Session-based cart using Supabase cart_items table + localStorage fallback.
 */
(function () {
    'use strict';

    var SESSION_KEY = 'mundo_cart_session';
    var CART_CACHE_KEY = 'mundo_cart_cache';
    var sessionId = null;

    // ========================
    // Session ID
    // ========================

    function getSessionId() {
        if (sessionId) return sessionId;
        sessionId = localStorage.getItem(SESSION_KEY);
        if (!sessionId) {
            sessionId = generateUUID();
            localStorage.setItem(SESSION_KEY, sessionId);
        }
        return sessionId;
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0;
            var v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    // ========================
    // Supabase client helper
    // ========================

    function getClient() {
        if (window.MundoElectronica && window.MundoElectronica.supabase) {
            return window.MundoElectronica.supabase;
        }
        return null;
    }

    // ========================
    // Cart Operations
    // ========================

    async function getCart() {
        var client = getClient();
        if (!client) return getLocalCart();

        try {
            var result = await client
                .from('cart_items')
                .select('*, products(name, slug, price, image_url)')
                .eq('session_id', getSessionId())
                .order('created_at');

            if (result.error) {
                console.warn('[Cart] Falling back to local:', result.error.message);
                return getLocalCart();
            }
            // Cache locally
            localStorage.setItem(CART_CACHE_KEY, JSON.stringify(result.data));
            return result.data;
        } catch (e) {
            return getLocalCart();
        }
    }

    async function addToCart(productId, quantity) {
        quantity = quantity || 1;
        var client = getClient();
        if (!client) return addToLocalCart(productId, quantity);

        // Check if item already in cart
        var existing = await client
            .from('cart_items')
            .select('id, quantity')
            .eq('session_id', getSessionId())
            .eq('product_id', productId)
            .maybeSingle();

        if (existing.data) {
            // Update quantity
            var newQty = existing.data.quantity + quantity;
            var result = await client
                .from('cart_items')
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq('id', existing.data.id);

            await updateCartUI();
            return result;
        } else {
            // Insert new item
            var result = await client.from('cart_items').insert({
                session_id: getSessionId(),
                product_id: productId,
                quantity: quantity,
            });

            await updateCartUI();
            return result;
        }
    }

    async function removeFromCart(cartItemId) {
        var client = getClient();
        if (!client) return removeFromLocalCart(cartItemId);

        var result = await client.from('cart_items').delete().eq('id', cartItemId);
        await updateCartUI();
        return result;
    }

    async function updateCartQty(cartItemId, quantity) {
        if (quantity <= 0) return removeFromCart(cartItemId);

        var client = getClient();
        if (!client) return updateLocalCartQty(cartItemId, quantity);

        var result = await client
            .from('cart_items')
            .update({ quantity: quantity, updated_at: new Date().toISOString() })
            .eq('id', cartItemId);

        await updateCartUI();
        return result;
    }

    async function clearCart() {
        var client = getClient();
        if (!client) {
            localStorage.removeItem(CART_CACHE_KEY);
            updateCartUI();
            return;
        }

        await client.from('cart_items').delete().eq('session_id', getSessionId());
        localStorage.removeItem(CART_CACHE_KEY);
        await updateCartUI();
    }

    // ========================
    // Local Cart Fallback
    // ========================

    function getLocalCart() {
        try {
            return JSON.parse(localStorage.getItem(CART_CACHE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    function addToLocalCart(productId, quantity) {
        var cart = getLocalCart();
        var existing = cart.find(function (item) {
            return item.product_id === productId;
        });
        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.push({
                id: generateUUID(),
                product_id: productId,
                quantity: quantity,
                session_id: getSessionId(),
            });
        }
        localStorage.setItem(CART_CACHE_KEY, JSON.stringify(cart));
        updateCartUI();
        return { error: null };
    }

    function removeFromLocalCart(cartItemId) {
        var cart = getLocalCart().filter(function (item) {
            return item.id !== cartItemId;
        });
        localStorage.setItem(CART_CACHE_KEY, JSON.stringify(cart));
        updateCartUI();
        return { error: null };
    }

    function updateLocalCartQty(cartItemId, quantity) {
        var cart = getLocalCart();
        var item = cart.find(function (i) {
            return i.id === cartItemId;
        });
        if (item) item.quantity = quantity;
        localStorage.setItem(CART_CACHE_KEY, JSON.stringify(cart));
        updateCartUI();
        return { error: null };
    }

    // ========================
    // UI Updates
    // ========================

    async function updateCartUI() {
        var cart = await getCart();
        var totalItems = cart.reduce(function (sum, item) {
            return sum + (item.quantity || 1);
        }, 0);

        // Update cart count badges
        var badges = document.querySelectorAll('.cart-quantity');
        badges.forEach(function (badge) {
            badge.textContent = totalItems;
        });
    }

    // ========================
    // Initialize
    // ========================

    function init() {
        // Update cart count on page load
        updateCartUI();

        // Hook into "Add to Cart" buttons (Webflow commerce buttons)
        document.addEventListener('click', function (e) {
            var addBtn = e.target.closest('[data-node-type="commerce-add-to-cart-button"]');
            if (!addBtn) return;

            // Get product info from the page
            var productSlug = window.location.pathname.split('/').pop();
            if (!productSlug) return;

            e.preventDefault();
            e.stopPropagation();

            // Find product by slug, then add to cart
            if (window.MundoElectronica && window.MundoElectronica.store) {
                window.MundoElectronica.store.fetchProduct(productSlug).then(function (result) {
                    if (result.data) {
                        addToCart(result.data.id, 1).then(function () {
                            // Show success feedback
                            var successMsg = addBtn.closest('form');
                            if (successMsg) {
                                var done = successMsg.querySelector('.w-form-done, .w-commerce-commerceaddtocartsuccessmessage');
                                if (done) done.style.display = 'block';
                                setTimeout(function () {
                                    if (done) done.style.display = 'none';
                                }, 3000);
                            }
                        });
                    }
                });
            }
        });
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ========================
    // Export
    // ========================

    window.MundoElectronica = window.MundoElectronica || {};
    window.MundoElectronica.cart = {
        getCart: getCart,
        addToCart: addToCart,
        removeFromCart: removeFromCart,
        updateCartQty: updateCartQty,
        clearCart: clearCart,
        getSessionId: getSessionId,
    };
})();
