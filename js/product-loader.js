/**
 * Product Loader — Dynamic product catalog for Mundo Electronica
 * Uses MundoElectronica.store (Supabase client-side) to render products
 */
(function () {
    'use strict';

    // ─── State ──────────────────────────────────────────────
    var state = {
        page: 1,
        limit: 24,
        search: '',
        sort: 'nombre',
        order: 'asc',
        categoria: 'all',
        totalPages: 1,
        total: 0,
        loading: false
    };

    // ─── DOM References ─────────────────────────────────────
    var productGrid, paginationContainer, searchInput, searchForm,
        sortSelect, categoryContainer, resultCount, loadingOverlay;

    // ─── Placeholder image ──────────────────────────────────
    var PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">' +
        '<rect width="400" height="400" fill="#f0f0f0"/>' +
        '<text x="200" y="200" text-anchor="middle" dominant-baseline="central" font-family="Inter,sans-serif" font-size="16" fill="#999">Sin imagen</text>' +
        '</svg>'
    );

    // ─── Fetch Products ─────────────────────────────────────
    async function fetchProducts() {
        if (state.loading) return;
        var store = window.MundoElectronica && window.MundoElectronica.store;
        if (!store) {
            console.error('[ProductLoader] MundoElectronica.store not available');
            return;
        }

        state.loading = true;
        showLoading(true);

        try {
            var result = await store.fetchProducts({
                page: state.page,
                limit: state.limit,
                sort: state.sort,
                order: state.order,
                search: state.search || undefined,
                categoria: state.categoria !== 'all' ? state.categoria : undefined
            });

            if (result.error) throw result.error;

            state.totalPages = result.totalPages || 1;
            state.total = result.total || 0;
            state.page = result.page || state.page;

            renderProducts(result.data || []);
            renderPagination();
            updateResultCount();
        } catch (err) {
            console.error('Error loading products:', err);
            if (productGrid) {
                productGrid.innerHTML =
                    '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;">' +
                    '<p style="font-size:18px;color:#666;">Error al cargar productos</p>' +
                    '<button onclick="window.productLoader.retry()" ' +
                    'style="margin-top:12px;padding:10px 24px;background:#1a1a1a;color:#fff;border:none;border-radius:8px;cursor:pointer;">' +
                    'Reintentar</button></div>';
            }
        } finally {
            state.loading = false;
            showLoading(false);
        }
    }

    // ─── Fetch Categories ───────────────────────────────────
    async function fetchCategories() {
        var store = window.MundoElectronica && window.MundoElectronica.store;
        if (!store) return;

        try {
            var result = await store.fetchCategories();
            if (!result.error && result.data) {
                renderCategories(result.data);
            }
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }

    // ─── Render Product Cards ───────────────────────────────
    function renderProducts(products) {
        if (!productGrid) return;

        if (products.length === 0) {
            productGrid.innerHTML =
                '<div style="grid-column:1/-1;text-align:center;padding:80px 20px;">' +
                '<div style="font-size:48px;margin-bottom:16px;">🔍</div>' +
                '<p style="font-size:20px;font-weight:600;color:#333;margin-bottom:8px;">No se encontraron productos</p>' +
                '<p style="font-size:14px;color:#888;">Intenta con otra búsqueda o categoría</p></div>';
            return;
        }

        var html = '';
        products.forEach(function (product) {
            html += createProductCard(product);
        });
        productGrid.innerHTML = html;
    }

    function createProductCard(product) {
        var price = typeof product.precio === 'number'
            ? '$ ' + product.precio.toFixed(2) + ' USD'
            : '$ ' + product.precio + ' USD';
        var imgSrc = product.imagen_url || PLACEHOLDER_IMG;
        var name = escapeHtml(product.nombre || 'Producto');
        var desc = escapeHtml(truncate(product.descripcion || '', 120));
        var detailUrl = '/product-detail?codigo=' + encodeURIComponent(product.codigo);
        var category = escapeHtml(product.categoria || 'General');

        return '<div class="best-seller-collectioin-item w-dyn-item" role="listitem">' +
            '<div class="best-seller-card-box product-card-dynamic">' +
            '<div class="best-seller-image-box">' +
            '<a href="' + detailUrl + '" class="product-image-link w-inline-block">' +
            '<img loading="lazy" src="' + imgSrc + '" alt="' + name + '" ' +
            'class="best-seller-image" onerror="this.src=\'' + PLACEHOLDER_IMG + '\'" />' +
            '</a>' +
            '<a href="javascript:void(0)" class="category-box w-inline-block" ' +
            'style="background-color:rgb(255,255,255);" ' +
            'onclick="window.productLoader.filterCategory(\'' + escapeAttr(product.categoria || 'General') + '\')">' +
            '<p style="color:rgb(91,91,91)" class="paragraph-regular">' + category + '</p>' +
            '</a>' +
            '</div>' +
            '<div class="best-seller-text-warp">' +
            '<div class="best-seller-typography-wrap">' +
            '<p class="price-text">' + price + '</p>' +
            '<a href="' + detailUrl + '" class="best-seller-product-name w-inline-block">' +
            '<h3 class="h5">' + name + '</h3>' +
            '</a>' +
            '</div>' +
            '<p class="paragraph-regular best-seller">' + desc + '</p>' +
            '</div>' +
            '</div>' +
            '</div>';
    }

    // ─── Render Categories ──────────────────────────────────
    function renderCategories(categories) {
        if (!categoryContainer) return;

        var html = createCategoryBtn('Todos', 'all', state.categoria === 'all');
        categories.forEach(function (cat) {
            html += createCategoryBtn(cat, cat, state.categoria === cat);
        });
        categoryContainer.innerHTML = html;
    }

    function createCategoryBtn(label, value, active) {
        return '<button class="category-filter-btn' + (active ? ' active' : '') + '" ' +
            'data-category="' + escapeAttr(value) + '" ' +
            'onclick="window.productLoader.filterCategory(\'' + escapeAttr(value) + '\')">' +
            escapeHtml(label) + '</button>';
    }

    // ─── Render Pagination ──────────────────────────────────
    function renderPagination() {
        if (!paginationContainer) return;

        if (state.totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        var html = '';

        // Previous
        html += '<button class="pagination-btn' + (state.page <= 1 ? ' disabled' : '') + '" ' +
            (state.page <= 1 ? 'disabled ' : '') +
            'onclick="window.productLoader.goToPage(' + (state.page - 1) + ')">← Anterior</button>';

        // Page numbers
        var pages = getPageNumbers(state.page, state.totalPages);
        pages.forEach(function (p) {
            if (p === '...') {
                html += '<span class="pagination-dots">…</span>';
            } else {
                html += '<button class="pagination-btn' + (p === state.page ? ' active' : '') + '" ' +
                    'onclick="window.productLoader.goToPage(' + p + ')">' + p + '</button>';
            }
        });

        // Next
        html += '<button class="pagination-btn' + (state.page >= state.totalPages ? ' disabled' : '') + '" ' +
            (state.page >= state.totalPages ? 'disabled ' : '') +
            'onclick="window.productLoader.goToPage(' + (state.page + 1) + ')">Siguiente →</button>';

        paginationContainer.innerHTML = html;
    }

    function getPageNumbers(current, total) {
        if (total <= 7) {
            var arr = [];
            for (var i = 1; i <= total; i++) arr.push(i);
            return arr;
        }
        var pages = [1];
        if (current > 3) pages.push('...');
        for (var j = Math.max(2, current - 1); j <= Math.min(total - 1, current + 1); j++) {
            pages.push(j);
        }
        if (current < total - 2) pages.push('...');
        pages.push(total);
        return pages;
    }

    // ─── Update Result Count ────────────────────────────────
    function updateResultCount() {
        if (!resultCount) return;
        var start = (state.page - 1) * state.limit + 1;
        var end = Math.min(state.page * state.limit, state.total);
        resultCount.textContent = state.total > 0
            ? 'Mostrando ' + start + '-' + end + ' de ' + state.total + ' productos'
            : 'No hay productos';
    }

    // ─── Loading Overlay ────────────────────────────────────
    function showLoading(show) {
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
        if (productGrid && show) {
            productGrid.style.opacity = '0.4';
            productGrid.style.pointerEvents = 'none';
        } else if (productGrid) {
            productGrid.style.opacity = '1';
            productGrid.style.pointerEvents = '';
        }
    }

    // ─── Debounce ───────────────────────────────────────────
    function debounce(fn, ms) {
        var timer;
        return function () {
            var args = arguments;
            var self = this;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(self, args); }, ms);
        };
    }

    // ─── Helpers ────────────────────────────────────────────
    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function escapeAttr(str) {
        return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    function truncate(str, max) {
        return str.length > max ? str.slice(0, max) + '…' : str;
    }

    // ─── Public API ─────────────────────────────────────────
    window.productLoader = {
        goToPage: function (page) {
            if (page < 1 || page > state.totalPages || page === state.page) return;
            state.page = page;
            fetchProducts();
            if (productGrid) productGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },

        filterCategory: function (cat) {
            state.categoria = cat;
            state.page = 1;
            fetchProducts();
            document.querySelectorAll('.category-filter-btn').forEach(function (btn) {
                btn.classList.toggle('active', btn.getAttribute('data-category') === cat);
            });
        },

        sort: function (field, order) {
            state.sort = field;
            state.order = order || 'asc';
            state.page = 1;
            fetchProducts();
        },

        search: function (query) {
            state.search = query;
            state.page = 1;
            fetchProducts();
        },

        retry: function () {
            fetchProducts();
        }
    };

    // ─── Init ───────────────────────────────────────────────
    function init() {
        productGrid = document.getElementById('product-grid');
        paginationContainer = document.getElementById('pagination');
        searchInput = document.getElementById('product-search');
        searchForm = document.getElementById('product-search-form');
        sortSelect = document.getElementById('product-sort');
        categoryContainer = document.getElementById('category-filters');
        resultCount = document.getElementById('result-count');
        loadingOverlay = document.getElementById('loading-overlay');

        if (!productGrid) {
            console.warn('[ProductLoader] #product-grid not found');
            return;
        }

        // Search handler
        if (searchInput) {
            var debouncedSearch = debounce(function (val) {
                window.productLoader.search(val);
            }, 400);

            searchInput.addEventListener('input', function (e) {
                debouncedSearch(e.target.value.trim());
            });
        }

        if (searchForm) {
            searchForm.addEventListener('submit', function (e) {
                e.preventDefault();
                window.productLoader.search(searchInput ? searchInput.value.trim() : '');
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', function (e) {
                var parts = e.target.value.split('-');
                window.productLoader.sort(parts[0], parts[1]);
            });
        }

        // Load data
        fetchCategories();
        fetchProducts();
    }

    // ─── Start on DOM ready ─────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
