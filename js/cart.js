/**
 * Cart Manager + Stripe Checkout + Cart Drawer
 * Mundo Electronica
 *
 * - localStorage cart (works without login)
 * - Custom cart drawer sidebar (replaces dead Webflow Commerce cart)
 * - Checkout → /create-checkout-session → Stripe Checkout Sessions
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════
    //  CART STATE (localStorage)
    // ═══════════════════════════════════════════════════════

    const CART_KEY = 'sellifyx_cart';

    function getCart() {
        try {
            return JSON.parse(localStorage.getItem(CART_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        updateCartUI();
        renderCartDrawerItems();
    }

    function addToCart(item, qty) {
        qty = qty || 1;
        const cart = getCart();
        const existing = cart.find(i =>
            (item.codigo && i.codigo === item.codigo) ||
            (!item.codigo && i.name === item.name)
        );
        if (existing) {
            existing.quantity += qty;
        } else {
            cart.push({ ...item, quantity: qty });
        }
        saveCart(cart);
        showNotification('\u2713 ' + item.name + ' agregado al carrito');
    }

    function removeFromCartByIndex(index) {
        const cart = getCart();
        cart.splice(index, 1);
        saveCart(cart);
    }

    function updateQuantity(index, delta) {
        const cart = getCart();
        if (!cart[index]) return;
        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        saveCart(cart);
    }

    function clearCart() {
        localStorage.removeItem(CART_KEY);
        updateCartUI();
        renderCartDrawerItems();
    }

    // ═══════════════════════════════════════════════════════
    //  NOTIFICATION TOAST
    // ═══════════════════════════════════════════════════════

    function showNotification(message) {
        const existing = document.querySelector('.stripe-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'stripe-notification';
        notification.innerHTML =
            '<div style="' +
            'position:fixed;bottom:24px;right:24px;background:#0a0a0a;color:#fff;' +
            'padding:16px 24px;border-radius:12px;font-family:Inter,sans-serif;font-size:14px;' +
            'font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:10001;' +
            'animation:cartSlideIn 0.3s ease-out;display:flex;align-items:center;gap:12px;' +
            'border:1px solid rgba(255,255,255,0.1);">' +
            '<span>' + escapeHtml(message) + '</span>' +
            '<a href="#" onclick="event.preventDefault();window.StripeCheckout.openCart();" ' +
            'style="color:#635bff;text-decoration:none;font-weight:600;white-space:nowrap;">' +
            'Ver Carrito \u2192</a></div>';
        document.body.appendChild(notification);
        setTimeout(function () { notification.remove(); }, 3500);
    }

    // ═══════════════════════════════════════════════════════
    //  CART DRAWER (replaces Webflow Commerce sidebar)
    // ═══════════════════════════════════════════════════════

    let drawerEl = null;
    let overlayEl = null;

    function createCartDrawer() {
        overlayEl = document.createElement('div');
        overlayEl.className = 'cart-drawer-overlay';
        overlayEl.addEventListener('click', closeCart);
        document.body.appendChild(overlayEl);

        drawerEl = document.createElement('div');
        drawerEl.className = 'cart-drawer';
        drawerEl.innerHTML =
            '<div class="cart-drawer-header">' +
            '<h3>\uD83D\uDED2 Tu Carrito</h3>' +
            '<button class="cart-drawer-close" onclick="window.StripeCheckout.closeCart()">\u2715</button>' +
            '</div>' +
            '<div class="cart-drawer-items" id="cart-drawer-items"></div>' +
            '<div class="cart-drawer-footer" id="cart-drawer-footer">' +
            '<div class="cart-drawer-total"><span>Total:</span>' +
            '<span id="cart-drawer-total-amount">$0.00 USD</span></div>' +
            '<button class="cart-drawer-checkout-btn" onclick="window.StripeCheckout.checkout()">' +
            '\uD83D\uDCB3 Proceder al Pago</button>' +
            '<div class="cart-drawer-powered">\uD83D\uDD12 Pago seguro con Stripe</div>' +
            '</div>';
        document.body.appendChild(drawerEl);
    }

    function openCart() {
        if (!drawerEl) createCartDrawer();
        renderCartDrawerItems();
        drawerEl.classList.add('open');
        overlayEl.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeCart() {
        if (drawerEl) drawerEl.classList.remove('open');
        if (overlayEl) overlayEl.classList.remove('open');
        document.body.style.overflow = '';
    }

    function renderCartDrawerItems() {
        const container = document.getElementById('cart-drawer-items');
        const footer = document.getElementById('cart-drawer-footer');
        const totalEl = document.getElementById('cart-drawer-total-amount');
        if (!container) return;

        const cart = getCart();

        if (cart.length === 0) {
            container.innerHTML =
                '<div class="cart-drawer-empty">' +
                '<div style="font-size:48px;margin-bottom:12px;">\uD83D\uDED2</div>' +
                '<p>Tu carrito est\u00e1 vac\u00edo</p>' +
                '<p style="font-size:13px;color:#888;margin-top:4px;">Agrega productos desde la tienda</p>' +
                '</div>';
            if (footer) footer.style.display = 'none';
            return;
        }

        if (footer) footer.style.display = 'block';

        let total = 0;
        const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="#f0f0f0"/><text x="40" y="40" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#999">📦</text></svg>'
        );

        let html = '';
        cart.forEach(function (item, index) {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            total += itemTotal;
            const imgSrc = escapeAttr(item.image || '') || PLACEHOLDER;

            html +=
                '<div class="cart-drawer-item">' +
                '<img src="' + imgSrc + '" alt="" class="cart-drawer-item-img" ' +
                'onerror="this.src=\'' + PLACEHOLDER + '\'" />' +
                '<div class="cart-drawer-item-info">' +
                '<div class="cart-drawer-item-name">' + escapeHtml(item.name) + '</div>' +
                '<div class="cart-drawer-item-price">$' + (item.price || 0).toFixed(2) + ' USD</div>' +
                '<div class="cart-drawer-item-qty">' +
                '<button class="qty-btn" onclick="window.StripeCheckout.updateQty(' + index + ',-1)">\u2212</button>' +
                '<span>' + (item.quantity || 1) + '</span>' +
                '<button class="qty-btn" onclick="window.StripeCheckout.updateQty(' + index + ',1)">+</button>' +
                '</div></div>' +
                '<button class="cart-drawer-item-remove" onclick="window.StripeCheckout.removeItem(' + index + ')">\uD83D\uDDD1</button>' +
                '</div>';
        });
        container.innerHTML = html;

        if (totalEl) totalEl.textContent = '$' + total.toFixed(2) + ' USD';
    }

    // ═══════════════════════════════════════════════════════
    //  CHECKOUT → Stripe Checkout Sessions
    // ═══════════════════════════════════════════════════════

    async function checkout() {
        const cart = getCart();
        if (cart.length === 0) {
            showNotification('\u26A0\uFE0F El carrito est\u00e1 vac\u00edo');
            return;
        }

        const btn = document.querySelector('.cart-drawer-checkout-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '\u23F3 Redirigiendo a Stripe...';
        }

        try {
            const response = await fetch('/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cart }),
            });

            const data = await response.json();

            if (data.url) {
                // Cart is cleared on the success page after payment confirmation
                closeCart();
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Error al crear sesi\u00f3n de pago');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            showNotification('\u274C Error: ' + error.message);
            if (btn) {
                btn.disabled = false;
                btn.textContent = '\uD83D\uDCB3 Proceder al Pago';
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    //  "BUY NOW" — single product → checkout
    // ═══════════════════════════════════════════════════════

    async function buyNow(item) {
        try {
            const response = await fetch('/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: [{ ...item, quantity: 1 }] }),
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Error al crear sesi\u00f3n de pago');
            }
        } catch (error) {
            console.error('Buy now error:', error);
            showNotification('\u274C Error: ' + error.message);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  UI UPDATES
    // ═══════════════════════════════════════════════════════

    function updateCartUI() {
        const cart = getCart();
        const totalItems = cart.reduce(function (sum, item) { return sum + (item.quantity || 1); }, 0);

        // Update all cart count badges (Webflow + custom)
        const countElements = document.querySelectorAll('.cart-quantity, .w-commerce-commercecartopenlinkcount');
        countElements.forEach(function (el) {
            el.textContent = totalItems;
        });
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function escapeAttr(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ═══════════════════════════════════════════════════════
    //  INJECT STYLES
    // ═══════════════════════════════════════════════════════

    function injectStyles() {
        if (document.getElementById('cart-drawer-styles')) return;
        const style = document.createElement('style');
        style.id = 'cart-drawer-styles';
        style.textContent =
            '@keyframes cartSlideIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}' +
            '.cart-drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;opacity:0;visibility:hidden;transition:opacity .3s ease,visibility .3s ease;backdrop-filter:blur(2px)}' +
            '.cart-drawer-overlay.open{opacity:1;visibility:visible}' +
            '.cart-drawer{position:fixed;top:0;right:0;width:420px;max-width:90vw;height:100vh;background:#fff;z-index:9999;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .35s cubic-bezier(.16,1,.3,1);box-shadow:-8px 0 40px rgba(0,0,0,.15)}' +
            '.cart-drawer.open{transform:translateX(0)}' +
            '.cart-drawer-header{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #eee;flex-shrink:0}' +
            '.cart-drawer-header h3{margin:0;font-size:18px;font-weight:700;font-family:Inter,sans-serif;color:#1a1a1a}' +
            '.cart-drawer-close{background:none;border:none;font-size:20px;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background .15s;color:#666}' +
            '.cart-drawer-close:hover{background:#f0f0f0}' +
            '.cart-drawer-items{flex:1;overflow-y:auto;padding:16px 24px}' +
            '.cart-drawer-empty{text-align:center;padding:60px 20px;color:#666;font-family:Inter,sans-serif}' +
            '.cart-drawer-empty p{margin:0;font-size:16px;font-weight:500}' +
            '.cart-drawer-item{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #f0f0f0;align-items:flex-start}' +
            '.cart-drawer-item:last-child{border-bottom:none}' +
            '.cart-drawer-item-img{width:72px;height:72px;object-fit:cover;border-radius:10px;background:#f8f8f8;flex-shrink:0}' +
            '.cart-drawer-item-info{flex:1;min-width:0}' +
            '.cart-drawer-item-name{font-size:14px;font-weight:600;color:#1a1a1a;font-family:Inter,sans-serif;line-height:1.3;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
            '.cart-drawer-item-price{font-size:14px;font-weight:700;color:#635bff;font-family:Inter,sans-serif;margin-bottom:8px}' +
            '.cart-drawer-item-qty{display:flex;align-items:center;gap:10px}' +
            '.cart-drawer-item-qty span{font-size:14px;font-weight:600;min-width:20px;text-align:center;font-family:Inter,sans-serif}' +
            '.qty-btn{background:#f0f0f0;border:none;width:28px;height:28px;border-radius:6px;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;color:#333}' +
            '.qty-btn:hover{background:#e0e0e0}' +
            '.cart-drawer-item-remove{background:none;border:none;font-size:16px;cursor:pointer;opacity:.5;transition:opacity .15s;padding:4px;flex-shrink:0}' +
            '.cart-drawer-item-remove:hover{opacity:1}' +
            '.cart-drawer-footer{border-top:1px solid #eee;padding:20px 24px;flex-shrink:0;background:#fafafa}' +
            '.cart-drawer-total{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font-family:Inter,sans-serif}' +
            '.cart-drawer-total span:first-child{font-size:16px;font-weight:500;color:#666}' +
            '.cart-drawer-total span:last-child{font-size:22px;font-weight:800;color:#1a1a1a}' +
            '.cart-drawer-checkout-btn{width:100%;background:linear-gradient(135deg,#635bff 0%,#7c3aed 100%);color:#fff;border:none;padding:16px 24px;border-radius:10px;font-family:Inter,sans-serif;font-size:16px;font-weight:700;cursor:pointer;transition:all .2s ease;letter-spacing:.3px}' +
            '.cart-drawer-checkout-btn:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(99,91,255,.4)}' +
            '.cart-drawer-checkout-btn:disabled{opacity:.7;cursor:wait;transform:none}' +
            '.cart-drawer-powered{text-align:center;font-family:Inter,sans-serif;font-size:12px;color:#888;margin-top:12px}' +
            '.add-to-cart-btn{width:100%;background:linear-gradient(135deg,#1a1a1a 0%,#333 100%);color:#fff;border:none;padding:10px 16px;border-radius:8px;font-family:Inter,sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s ease;margin-top:10px;letter-spacing:.3px}' +
            '.add-to-cart-btn:hover{background:linear-gradient(135deg,#635bff 0%,#7c3aed 100%);transform:translateY(-1px);box-shadow:0 4px 16px rgba(99,91,255,.3)}' +
            '.stripe-buy-now-btn,.stripe-add-to-cart-btn{background:linear-gradient(135deg,#635bff 0%,#7c3aed 100%);color:#fff;border:none;padding:14px 28px;border-radius:8px;font-family:Inter,sans-serif;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s ease;display:inline-flex;align-items:center;gap:8px}' +
            '.stripe-buy-now-btn:hover,.stripe-add-to-cart-btn:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(99,91,255,.4)}' +
            '.stripe-buy-now-btn:disabled,.stripe-add-to-cart-btn:disabled{opacity:.7;cursor:wait;transform:none}' +
            '.stripe-powered{display:inline-flex;align-items:center;gap:6px;font-family:Inter,sans-serif;font-size:12px;color:#888;margin-top:8px}';
        document.head.appendChild(style);
    }

    // ═══════════════════════════════════════════════════════
    //  INTERCEPT EXISTING WEBFLOW ELEMENTS
    // ═══════════════════════════════════════════════════════

    function init() {
        injectStyles();

        // Intercept the Webflow cart open link → open our custom drawer instead
        document.addEventListener('click', function (e) {
            const cartLink = e.target.closest('[data-node-type="commerce-cart-open-link"], .cart-button-wrap');
            if (cartLink) {
                e.preventDefault();
                e.stopPropagation();
                openCart();
            }
        });

        // Hide the Webflow cart container (dead HTML)
        const wfCartWrapper = document.querySelector('[data-node-type="commerce-cart-container-wrapper"]');
        if (wfCartWrapper) wfCartWrapper.style.display = 'none';

        // Check if we're on a product detail page
        const isProductPage = window.location.pathname.includes('product-detail') ||
            window.location.pathname.startsWith('/product/');

        if (isProductPage) {
            initProductPage();
        }

        // Intercept any remaining Webflow checkout button
        const checkoutBtn = document.querySelector('[data-node-type="cart-checkout-button"]');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                checkout();
            });
        }

        // Update cart UI on load
        updateCartUI();
    }

    function initProductPage() {
        // The product-detail page has its own inline script that handles the
        // add-to-cart button click via window.StripeCheckout.addToCart().
        // We just add the "Buy Now" button here.

        // Wait for the product to be loaded (the inline script sets the button listener)
        // We observe when the product content becomes visible
        var checkInterval = setInterval(function () {
            var addToCartBtn = document.getElementById('add-to-cart-btn');
            var priceEl = document.getElementById('product-price');
            if (!addToCartBtn || !priceEl) return;

            // Check if product is loaded (price is not the default)
            var priceText = priceEl.textContent || '';
            if (priceText === '$ 0.00 USD' || priceText === 'Cargando...') return;

            clearInterval(checkInterval);

            // Add "Buy Now" button if not already added
            if (document.querySelector('.stripe-buy-now-btn')) return;

            var buyNowBtn = document.createElement('button');
            buyNowBtn.className = 'stripe-buy-now-btn';
            buyNowBtn.style.cssText = 'width:100%;margin-top:8px;';
            buyNowBtn.textContent = '\u26A1 Comprar Ahora';
            buyNowBtn.addEventListener('click', function (e) {
                e.preventDefault();
                var product = extractProductFromPage();
                buyNow(product);
            });
            addToCartBtn.parentElement.appendChild(buyNowBtn);

            var badge = document.createElement('div');
            badge.className = 'stripe-powered';
            badge.innerHTML = '\uD83D\uDD12 Pago seguro con Stripe';
            addToCartBtn.parentElement.appendChild(badge);
        }, 200);

        // Stop checking after 15 seconds
        setTimeout(function () { clearInterval(checkInterval); }, 15000);
    }

    function extractProductFromPage() {
        var nameEl = document.getElementById('product-title');
        var priceEl = document.getElementById('product-price');
        var imgEl = document.getElementById('product-image');

        var price = 0;
        if (priceEl) {
            var match = priceEl.textContent.trim().match(/[\d,.]+/);
            if (match) price = parseFloat(match[0].replace(',', ''));
        }

        var params = new URLSearchParams(window.location.search);
        var codigo = params.get('codigo') || '';

        return {
            name: nameEl ? nameEl.textContent.trim() : 'Product',
            price: price,
            image: imgEl ? imgEl.src : null,
            codigo: codigo,
        };
    }

    // ═══════════════════════════════════════════════════════
    //  EXPOSE GLOBAL API
    // ═══════════════════════════════════════════════════════

    window.StripeCheckout = {
        addToCart: addToCart,
        checkout: checkout,
        buyNow: buyNow,
        getCart: getCart,
        clearCart: clearCart,
        openCart: openCart,
        closeCart: closeCart,
        removeItem: removeFromCartByIndex,
        updateQty: updateQuantity,
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
