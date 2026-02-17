/**
 * Admin CMS — JavaScript SPA Logic
 * 
 * Handles authentication, dashboard stats, product CRUD,
 * category management, and order viewing.
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════
    //  AUTH — Standalone admin auth
    // ═══════════════════════════════════════════════════════

    let currentUser = null;

    async function checkAuth() {
        try {
            const res = await fetch('/api/admin/me', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                currentUser = data.user;
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    async function login(email, password) {
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Credenciales incorrectas');
            }

            const data = await res.json();
            currentUser = data.user;
            return true;
        } catch (err) {
            throw err;
        }
    }

    async function logout() {
        try {
            await fetch('/api/admin/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch { }
        window.location.reload();
    }

    // ═══════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════

    async function init() {
        const loggedIn = await checkAuth();

        if (loggedIn) {
            document.getElementById('login-page').style.display = 'none';
            document.getElementById('admin-layout').style.display = 'flex';
            document.getElementById('admin-user-email').textContent = currentUser.email;

            // Test admin access
            try {
                const testRes = await fetch('/api/admin/stats', { credentials: 'include' });
                if (testRes.status === 403) {
                    toast('⛔ Tu cuenta no tiene permisos de administrador', 'error');
                    document.getElementById('admin-layout').style.display = 'none';
                    document.getElementById('login-page').style.display = 'flex';
                    document.getElementById('login-error').textContent = 'Tu cuenta no tiene permisos de administrador';
                    document.getElementById('login-error').style.display = 'block';
                    return;
                }
            } catch { }

            loadDashboard();
            loadCategoriesForFilter();
        } else {
            document.getElementById('login-page').style.display = 'flex';
            document.getElementById('admin-layout').style.display = 'none';
        }
    }

    // Login form handler
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');

        try {
            errorEl.style.display = 'none';
            await login(email, password);
            await init(); // Re-initialize after login
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.style.display = 'block';
        }
    });

    // ═══════════════════════════════════════════════════════
    //  NAVIGATION
    // ═══════════════════════════════════════════════════════

    window.showSection = function (section) {
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));

        // Show target section
        const el = document.getElementById(`section-${section}`);
        if (el) el.classList.add('active');
        const nav = document.querySelector(`[data-section="${section}"]`);
        if (nav) nav.classList.add('active');

        // Load data for the section
        switch (section) {
            case 'dashboard': loadDashboard(); break;
            case 'products': loadProducts(1); break;
            case 'categories': loadCategories(); break;
            case 'orders': loadOrders(1); break;
        }

        // Close mobile sidebar
        document.getElementById('admin-sidebar').classList.remove('open');
    };

    window.toggleSidebar = function () {
        document.getElementById('admin-sidebar').classList.toggle('open');
    };

    // ═══════════════════════════════════════════════════════
    //  DASHBOARD
    // ═══════════════════════════════════════════════════════

    async function loadDashboard() {
        try {
            const res = await fetch('/api/admin/stats', { credentials: 'include' });
            const data = await res.json();

            document.getElementById('stats-grid').innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon">📦</div>
                    <div class="stat-value">${data.totalProducts || 0}</div>
                    <div class="stat-label">Productos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💳</div>
                    <div class="stat-value">${data.totalOrders || 0}</div>
                    <div class="stat-label">Pedidos Totales</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📈</div>
                    <div class="stat-value">${data.ordersToday || 0}</div>
                    <div class="stat-label">Pedidos Hoy</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-value">$${(data.totalRevenue || 0).toFixed(2)}</div>
                    <div class="stat-label">Ingresos Totales</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🏷️</div>
                    <div class="stat-value">${data.totalCategories || 0}</div>
                    <div class="stat-label">Categorías</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📧</div>
                    <div class="stat-value">${data.totalSubscribers || 0}</div>
                    <div class="stat-label">Suscriptores</div>
                </div>
            `;

            // Recent orders
            const tbody = document.getElementById('recent-orders-body');
            if (!data.recentOrders || data.recentOrders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>Sin pedidos aún</p></div></td></tr>';
            } else {
                tbody.innerHTML = data.recentOrders.map(o => `
                    <tr>
                        <td>${esc(o.customer_name || '—')}</td>
                        <td>${esc(o.customer_email || '—')}</td>
                        <td style="font-weight:600;">$${(parseFloat(o.amount_total) || 0).toFixed(2)} ${(o.currency || 'USD').toUpperCase()}</td>
                        <td><span class="badge ${o.status === 'completed' ? 'badge-success' : 'badge-warning'}">${o.status}</span></td>
                        <td>${formatDate(o.created_at)}</td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            document.getElementById('stats-grid').innerHTML = `<div class="empty-state"><p>Error al cargar: ${err.message}</p></div>`;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  PRODUCTS
    // ═══════════════════════════════════════════════════════

    let currentProductPage = 1;

    window.loadProducts = async function (page = 1) {
        currentProductPage = page;
        const search = document.getElementById('products-search').value;
        const categoria = document.getElementById('products-category-filter').value;
        const sort = document.getElementById('products-sort').value;

        const params = new URLSearchParams({
            page, limit: 30, sort, order: 'asc',
        });
        if (search) params.set('search', search);
        if (categoria && categoria !== 'all') params.set('categoria', categoria);

        try {
            const res = await fetch(`/api/admin/products?${params}`, { credentials: 'include' });
            const data = await res.json();

            document.getElementById('products-count').textContent =
                `${data.total} productos · Página ${data.page} de ${data.totalPages}`;

            const tbody = document.getElementById('products-table-body');

            if (!data.products || data.products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📦</div><p>No se encontraron productos</p></div></td></tr>';
            } else {
                tbody.innerHTML = data.products.map(p => `
                    <tr>
                        <td>${p.imagen_url
                        ? `<img src="${esc(p.imagen_url)}" class="table-img" onerror="this.style.display='none'" />`
                        : '<span style="color:#ccc;">—</span>'
                    }</td>
                        <td><code style="color:#000;font-size:12px;">${esc(p.codigo)}</code></td>
                        <td class="truncate-300">${esc(p.nombre)}</td>
                        <td style="font-weight:600;">$${(parseFloat(p.precio) || 0).toFixed(2)}</td>
                        <td><span class="badge badge-success">${esc(p.categoria || '—')}</span></td>
                        <td>
                            <button class="btn btn-secondary btn-sm" onclick='editProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'>✏️</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteProduct('${esc(p.codigo)}')">🗑</button>
                        </td>
                    </tr>
                `).join('');
            }

            // Pagination
            renderPagination('products-pagination', data.page, data.totalPages, 'loadProducts');
        } catch (err) {
            toast('Error al cargar productos: ' + err.message, 'error');
        }
    };

    // Debounced search
    let productSearchTimeout;
    window.debounceProductSearch = function () {
        clearTimeout(productSearchTimeout);
        productSearchTimeout = setTimeout(() => loadProducts(1), 300);
    };

    // Product Modal
    window.openProductModal = function (product = null) {
        const modal = document.getElementById('product-modal');
        const title = document.getElementById('product-modal-title');

        if (product) {
            title.textContent = 'Editar Producto';
            document.getElementById('product-edit-codigo').value = product.codigo;
            document.getElementById('product-codigo').value = product.codigo;
            document.getElementById('product-codigo').disabled = true;
            document.getElementById('product-nombre').value = product.nombre || '';
            document.getElementById('product-precio').value = product.precio || '';
            document.getElementById('product-descripcion').value = product.descripcion || '';
            document.getElementById('product-imagen').value = product.imagen_url || '';
            document.getElementById('product-categoria').value = product.categoria || '';
        } else {
            title.textContent = 'Nuevo Producto';
            document.getElementById('product-form').reset();
            document.getElementById('product-edit-codigo').value = '';
            document.getElementById('product-codigo').disabled = false;
        }

        document.getElementById('upload-status').textContent = '';
        modal.classList.add('open');
    };

    window.closeProductModal = function () {
        document.getElementById('product-modal').classList.remove('open');
    };

    window.editProduct = function (product) {
        openProductModal(product);
    };

    window.saveProduct = async function (e) {
        e.preventDefault();

        const editCodigo = document.getElementById('product-edit-codigo').value;
        const isEdit = !!editCodigo;

        const body = {
            codigo: document.getElementById('product-codigo').value.trim(),
            nombre: document.getElementById('product-nombre').value.trim(),
            precio: parseFloat(document.getElementById('product-precio').value),
            descripcion: document.getElementById('product-descripcion').value.trim(),
            imagen_url: document.getElementById('product-imagen').value.trim() || null,
            categoria: document.getElementById('product-categoria').value || null,
        };

        const btn = document.getElementById('product-save-btn');
        btn.disabled = true;
        btn.textContent = '⏳ Guardando...';

        try {
            const url = isEdit ? `/api/admin/products/${editCodigo}` : '/api/admin/products';
            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar');

            toast(`✅ Producto ${isEdit ? 'actualizado' : 'creado'}: ${body.nombre}`);
            closeProductModal();
            loadProducts(currentProductPage);
        } catch (err) {
            toast('❌ ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar Producto';
        }
    };

    window.deleteProduct = async function (codigo) {
        if (!confirm(`¿Eliminar producto ${codigo}? Esta acción no se puede deshacer.`)) return;

        try {
            const res = await fetch(`/api/admin/products/${codigo}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast(`🗑️ Producto ${codigo} eliminado`);
            loadProducts(currentProductPage);
        } catch (err) {
            toast('❌ ' + err.message, 'error');
        }
    };

    // Image upload handler
    window.handleImageUpload = async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('upload-status');
        statusEl.textContent = '⏳ Subiendo imagen...';

        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result.split(',')[1];

                const res = await fetch('/api/admin/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        base64,
                        filename: file.name,
                        contentType: file.type,
                    }),
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                document.getElementById('product-imagen').value = data.url;
                statusEl.textContent = '✅ Imagen subida correctamente';
                statusEl.style.color = '#16a34a';
            };
            reader.readAsDataURL(file);
        } catch (err) {
            statusEl.textContent = '❌ Error: ' + err.message;
            statusEl.style.color = '#dc2626';
        }
    };

    // ═══════════════════════════════════════════════════════
    //  CATEGORIES
    // ═══════════════════════════════════════════════════════

    async function loadCategories() {
        try {
            const res = await fetch('/api/admin/products?limit=1000&sort=categoria', { credentials: 'include' });
            const data = await res.json();

            // Count products per category
            const catCounts = {};
            (data.products || []).forEach(p => {
                const cat = p.categoria || 'Sin categoría';
                catCounts[cat] = (catCounts[cat] || 0) + 1;
            });

            const categories = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
            document.getElementById('categories-count').textContent = `${categories.length} categorías`;

            const grid = document.getElementById('categories-grid');
            if (categories.length === 0) {
                grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🏷️</div><p>Sin categorías</p></div>';
            } else {
                grid.innerHTML = categories.map(([name, count]) => `
                    <div class="category-card">
                        <div>
                            <div class="category-name">${esc(name)}</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span class="category-count">${count}</span>
                            <button class="btn btn-secondary btn-sm" onclick="openCategoryModal('${esc(name)}')">✏️</button>
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {
            toast('Error al cargar categorías: ' + err.message, 'error');
        }
    }

    // Load categories for dropdown filters
    async function loadCategoriesForFilter() {
        try {
            const res = await fetch('/api/categories', { credentials: 'include' });
            const data = await res.json();
            const cats = data.categories || [];

            // Products filter
            const filterSelect = document.getElementById('products-category-filter');
            const productSelect = document.getElementById('product-categoria');

            cats.sort().forEach(cat => {
                filterSelect.innerHTML += `<option value="${esc(cat)}">${esc(cat)}</option>`;
                productSelect.innerHTML += `<option value="${esc(cat)}">${esc(cat)}</option>`;
            });
        } catch { }
    }

    // Category rename modal
    window.openCategoryModal = function (name) {
        document.getElementById('category-old-name').value = name;
        document.getElementById('category-new-name').value = name;
        document.getElementById('category-modal').classList.add('open');
    };

    window.closeCategoryModal = function () {
        document.getElementById('category-modal').classList.remove('open');
    };

    window.renameCategory = async function () {
        const oldName = document.getElementById('category-old-name').value;
        const newName = document.getElementById('category-new-name').value.trim();

        if (!newName || newName === oldName) {
            closeCategoryModal();
            return;
        }

        try {
            const res = await fetch('/api/admin/categories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ oldName, newName }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast(`✅ Categoría renombrada: ${oldName} → ${newName} (${data.updated} productos)`);
            closeCategoryModal();
            loadCategories();
            loadCategoriesForFilter();
        } catch (err) {
            toast('❌ ' + err.message, 'error');
        }
    };

    // ═══════════════════════════════════════════════════════
    //  ORDERS
    // ═══════════════════════════════════════════════════════

    let currentOrderPage = 1;

    window.loadOrders = async function (page = 1) {
        currentOrderPage = page;
        const search = document.getElementById('orders-search').value;
        const status = document.getElementById('orders-status-filter').value;

        const params = new URLSearchParams({ page, limit: 25 });
        if (search) params.set('search', search);
        if (status && status !== 'all') params.set('status', status);

        try {
            const res = await fetch(`/api/admin/orders?${params}`, { credentials: 'include' });
            const data = await res.json();

            document.getElementById('orders-count').textContent =
                `${data.total} pedidos · Página ${data.page} de ${data.totalPages}`;

            const tbody = document.getElementById('orders-table-body');

            if (!data.orders || data.orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">💳</div><p>Sin pedidos</p></div></td></tr>';
            } else {
                tbody.innerHTML = data.orders.map(o => `
                    <tr>
                        <td><code style="font-size:11px;color:#999;">${(o.id || '').substring(0, 8)}...</code></td>
                        <td>${esc(o.customer_name || '—')}</td>
                        <td class="truncate">${esc(o.customer_email || '—')}</td>
                        <td style="font-weight:700;">$${(parseFloat(o.amount_total) || 0).toFixed(2)}</td>
                        <td><span class="badge ${o.status === 'completed' ? 'badge-success' : o.status === 'failed' ? 'badge-error' : 'badge-warning'}">${o.status}</span></td>
                        <td>${formatDate(o.created_at)}</td>
                        <td><button class="btn btn-secondary btn-sm" onclick='viewOrder(${JSON.stringify(o).replace(/'/g, "&#39;")})'>👁️</button></td>
                    </tr>
                `).join('');
            }

            renderPagination('orders-pagination', data.page, data.totalPages, 'loadOrders');
        } catch (err) {
            toast('Error al cargar pedidos: ' + err.message, 'error');
        }
    };

    let orderSearchTimeout;
    window.debounceOrderSearch = function () {
        clearTimeout(orderSearchTimeout);
        orderSearchTimeout = setTimeout(() => loadOrders(1), 300);
    };

    window.viewOrder = function (order) {
        const body = document.getElementById('order-modal-body');

        let itemsHtml = '';
        if (order.line_items && Array.isArray(order.line_items)) {
            itemsHtml = `
                <h4 style="font-size:14px;color:#000;margin:16px 0 8px;">Productos</h4>
                <table style="width:100%;">
                    <thead><tr>
                        <th style="text-align:left;">Producto</th>
                        <th>Cant.</th>
                        <th>Total</th>
                    </tr></thead>
                    <tbody>
                        ${order.line_items.map(item => `
                            <tr>
                                <td>${esc(item.description || item.name || '—')}</td>
                                <td style="text-align:center;">${item.quantity || 1}</td>
                                <td style="text-align:right;">$${((item.amount_total || item.price || 0) / 100).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        let shippingHtml = '';
        if (order.shipping_address) {
            const addr = order.shipping_address;
            shippingHtml = `
                <h4 style="font-size:14px;color:#000;margin:16px 0 8px;">Dirección de Envío</h4>
                <div class="order-field" style="grid-column:1/-1;">
                    <div class="order-field-value">
                        ${esc(addr.name || '')} ${esc(addr.line1 || '')} ${esc(addr.line2 || '')}<br/>
                        ${esc(addr.city || '')} ${esc(addr.state || '')} ${esc(addr.postal_code || '')}<br/>
                        ${esc(addr.country || '')}
                    </div>
                </div>
            `;
        }

        body.innerHTML = `
            <div class="order-detail-grid">
                <div class="order-field">
                    <div class="order-field-label">ID</div>
                    <div class="order-field-value" style="font-size:12px;">${esc(order.id || '—')}</div>
                </div>
                <div class="order-field">
                    <div class="order-field-label">Estado</div>
                    <div class="order-field-value">
                        <span class="badge ${order.status === 'completed' ? 'badge-success' : 'badge-warning'}">${order.status}</span>
                    </div>
                </div>
                <div class="order-field">
                    <div class="order-field-label">Cliente</div>
                    <div class="order-field-value">${esc(order.customer_name || '—')}</div>
                </div>
                <div class="order-field">
                    <div class="order-field-label">Email</div>
                    <div class="order-field-value">${esc(order.customer_email || '—')}</div>
                </div>
                <div class="order-field">
                    <div class="order-field-label">Total</div>
                    <div class="order-field-value" style="font-size:20px;font-weight:800;color:#000;">
                        $${(parseFloat(order.amount_total) || 0).toFixed(2)} ${(order.currency || 'USD').toUpperCase()}
                    </div>
                </div>
                <div class="order-field">
                    <div class="order-field-label">Fecha</div>
                    <div class="order-field-value">${formatDate(order.created_at)}</div>
                </div>
            </div>
            ${itemsHtml}
            ${shippingHtml}
            ${order.stripe_session_id ? `
                <div style="margin-top:16px;">
                    <div class="order-field">
                        <div class="order-field-label">Stripe Session ID</div>
                        <div class="order-field-value" style="font-size:11px;">${esc(order.stripe_session_id)}</div>
                    </div>
                </div>
            ` : ''}
        `;

        document.getElementById('order-modal').classList.add('open');
    };

    window.closeOrderModal = function () {
        document.getElementById('order-modal').classList.remove('open');
    };

    // ═══════════════════════════════════════════════════════
    //  UTILITIES
    // ═══════════════════════════════════════════════════════

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-VE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function toast(message, type = 'success') {
        const existing = document.querySelector('.admin-toast');
        if (existing) existing.remove();

        const el = document.createElement('div');
        el.className = 'admin-toast';
        el.innerHTML = `
            <div class="admin-toast-inner" style="border-left: 3px solid ${type === 'error' ? '#dc2626' : '#16a34a'};">
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }

    function renderPagination(containerId, page, totalPages, fnName) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = `<span>Página ${page} de ${totalPages}</span><div class="pagination-btns">`;

        html += `<button ${page <= 1 ? 'disabled' : ''} onclick="${fnName}(${page - 1})">← Anterior</button>`;

        // Show page numbers (max 7)
        const start = Math.max(1, page - 3);
        const end = Math.min(totalPages, start + 6);

        for (let i = start; i <= end; i++) {
            html += `<button class="${i === page ? 'active' : ''}" onclick="${fnName}(${i})">${i}</button>`;
        }

        html += `<button ${page >= totalPages ? 'disabled' : ''} onclick="${fnName}(${page + 1})">Siguiente →</button>`;
        html += '</div>';

        container.innerHTML = html;
    }

    // ═══════════════════════════════════════════════════════
    //  EXPOSE GLOBALS
    // ═══════════════════════════════════════════════════════

    window.logout = logout;

    // Initialize
    init();

})();
