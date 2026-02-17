/**
 * Product Loader — Professional Filter System for Mundo Electronica
 * Features: sidebar filters, price range slider, category checkboxes,
 * instant search, active filter tags, URL state, mobile drawer
 */
(function () {
    'use strict';

    // ─── Constants ───────────────────────────────────────
    var PRICE_MIN = 0;
    var PRICE_MAX = 4900;

    // ─── State ──────────────────────────────────────────────
    var state = {
        page: 1,
        limit: 24,
        search: '',
        sort: 'nombre',
        order: 'asc',
        categorias: [],      // multi-select categories
        precioMin: PRICE_MIN,
        precioMax: PRICE_MAX,
        totalPages: 1,
        total: 0,
        loading: false,
        allCategories: []     // cached category list with counts
    };

    // ─── DOM References ─────────────────────────────────────
    var productGrid, paginationContainer, searchInput, searchForm,
        sortSelect, resultCount, loadingOverlay,
        activeFiltersBar, activeFilterTags, clearAllBtn,
        filterToggleBtn, filterSidebar, filterOverlay, sidebarCloseBtn,
        filterCountBadge, searchClearBtn,
        priceMinSlider, priceMaxSlider, priceMinInput, priceMaxInput,
        priceSliderRange, categoryList,
        sidebarClearBtn;

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
            var opts = {
                page: state.page,
                limit: state.limit,
                sort: state.sort,
                order: state.order,
                search: state.search || undefined,
            };

            // Multi-category filter
            if (state.categorias.length > 0) {
                opts.categoria = state.categorias.length === 1 ? state.categorias[0] : state.categorias;
            }

            // Price range filter
            if (state.precioMin > PRICE_MIN) {
                opts.precio_min = state.precioMin;
            }
            if (state.precioMax < PRICE_MAX) {
                opts.precio_max = state.precioMax;
            }

            var result = await store.fetchProducts(opts);

            if (result.error) throw result.error;

            state.totalPages = result.totalPages || 1;
            state.total = result.total || 0;
            state.page = result.page || state.page;

            renderProducts(result.data || []);
            renderPagination();
            updateResultCount();
            updateActiveFilters();
            updateURL();
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
                // Fetch counts for each category
                var counts = await fetchCategoryCounts(result.data);
                state.allCategories = counts;
                renderCategoryCheckboxes(counts);
            }
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }

    async function fetchCategoryCounts(categories) {
        var store = window.MundoElectronica && window.MundoElectronica.store;
        if (!store) return categories.map(function (c) { return { name: c, count: 0 }; });

        var counts = [];
        // Fetch count for each category in parallel
        var promises = categories.map(function (cat) {
            return store.fetchProducts({ categoria: cat, limit: 1, page: 1 })
                .then(function (r) { return { name: cat, count: r.total || 0 }; })
                .catch(function () { return { name: cat, count: 0 }; });
        });

        counts = await Promise.all(promises);
        // Sort by count descending
        counts.sort(function (a, b) { return b.count - a.count; });
        return counts;
    }

    // ─── Render Product Cards ───────────────────────────────
    function renderProducts(products) {
        if (!productGrid) return;

        if (products.length === 0) {
            productGrid.innerHTML =
                '<div style="grid-column:1/-1;text-align:center;padding:80px 20px;">' +
                '<div style="font-size:48px;margin-bottom:16px;">🔍</div>' +
                '<p style="font-size:20px;font-weight:600;color:#333;margin-bottom:8px;">No se encontraron productos</p>' +
                '<p style="font-size:14px;color:#888;margin-bottom:20px;">Intenta con otra búsqueda o ajusta los filtros</p>' +
                '<button onclick="window.productLoader.clearAll()" ' +
                'style="padding:10px 24px;background:#1a1a1a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Limpiar filtros</button>' +
                '</div>';
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
        var name = escapeHtml(sanitizeName(product.nombre));
        var desc = escapeHtml(truncate(sanitizeName(product.descripcion || ''), 120));
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
            'onclick="window.productLoader.toggleCategory(\'' + escapeAttr(product.categoria || 'General') + '\')">' +
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

    // ─── Render Category Checkboxes ─────────────────────────
    function renderCategoryCheckboxes(categories) {
        if (!categoryList) return;

        var html = '';
        categories.forEach(function (cat) {
            var checked = state.categorias.indexOf(cat.name) !== -1;
            html += '<label class="filter-checkbox-item">' +
                '<input type="checkbox" value="' + escapeAttr(cat.name) + '" ' +
                (checked ? 'checked ' : '') +
                'onchange="window.productLoader.toggleCategory(\'' + escapeAttr(cat.name) + '\')" />' +
                '<span class="filter-checkbox-label">' + escapeHtml(cat.name) + '</span>' +
                '<span class="filter-checkbox-count">' + cat.count + '</span>' +
                '</label>';
        });
        categoryList.innerHTML = html;
    }

    // ─── Price Range Slider ─────────────────────────────────
    function initPriceSlider() {
        if (!priceMinSlider || !priceMaxSlider) return;

        function updateSliderRange() {
            var min = parseInt(priceMinSlider.value);
            var max = parseInt(priceMaxSlider.value);
            var percentMin = ((min - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
            var percentMax = ((max - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;

            if (priceSliderRange) {
                priceSliderRange.style.left = percentMin + '%';
                priceSliderRange.style.width = (percentMax - percentMin) + '%';
            }
        }

        var debouncedPriceChange = debounce(function () {
            var min = parseInt(priceMinSlider.value);
            var max = parseInt(priceMaxSlider.value);
            state.precioMin = min;
            state.precioMax = max;
            state.page = 1;
            fetchProducts();
        }, 500);

        priceMinSlider.addEventListener('input', function () {
            var min = parseInt(this.value);
            var max = parseInt(priceMaxSlider.value);
            if (min > max) this.value = max;
            if (priceMinInput) priceMinInput.value = this.value;
            updateSliderRange();
            debouncedPriceChange();
        });

        priceMaxSlider.addEventListener('input', function () {
            var max = parseInt(this.value);
            var min = parseInt(priceMinSlider.value);
            if (max < min) this.value = min;
            if (priceMaxInput) priceMaxInput.value = this.value;
            updateSliderRange();
            debouncedPriceChange();
        });

        // Manual input fields
        if (priceMinInput) {
            priceMinInput.addEventListener('change', function () {
                var val = Math.max(PRICE_MIN, Math.min(parseInt(this.value) || 0, parseInt(priceMaxSlider.value)));
                this.value = val;
                priceMinSlider.value = val;
                updateSliderRange();
                state.precioMin = val;
                state.page = 1;
                fetchProducts();
            });
        }

        if (priceMaxInput) {
            priceMaxInput.addEventListener('change', function () {
                var val = Math.min(PRICE_MAX, Math.max(parseInt(this.value) || PRICE_MAX, parseInt(priceMinSlider.value)));
                this.value = val;
                priceMaxSlider.value = val;
                updateSliderRange();
                state.precioMax = val;
                state.page = 1;
                fetchProducts();
            });
        }

        updateSliderRange();
    }

    // ─── Active Filter Tags ─────────────────────────────────
    function updateActiveFilters() {
        if (!activeFiltersBar || !activeFilterTags) return;

        var tags = [];

        // Category tags
        state.categorias.forEach(function (cat) {
            tags.push({
                label: cat,
                type: 'category',
                value: cat
            });
        });

        // Price range tag
        if (state.precioMin > PRICE_MIN || state.precioMax < PRICE_MAX) {
            tags.push({
                label: '$' + state.precioMin + ' — $' + state.precioMax,
                type: 'price',
                value: ''
            });
        }

        // Search tag
        if (state.search) {
            tags.push({
                label: '"' + state.search + '"',
                type: 'search',
                value: state.search
            });
        }

        if (tags.length === 0) {
            activeFiltersBar.style.display = 'none';
            updateFilterBadge(0);
            return;
        }

        activeFiltersBar.style.display = 'flex';
        updateFilterBadge(tags.length);

        var html = '';
        tags.forEach(function (tag) {
            html += '<span class="filter-tag">' +
                escapeHtml(tag.label) +
                '<button class="filter-tag-remove" ' +
                'onclick="window.productLoader.removeFilter(\'' + tag.type + '\', \'' + escapeAttr(tag.value) + '\')" ' +
                'aria-label="Eliminar filtro">&times;</button>' +
                '</span>';
        });
        activeFilterTags.innerHTML = html;
    }

    function updateFilterBadge(count) {
        if (!filterCountBadge) return;
        if (count > 0) {
            filterCountBadge.textContent = count;
            filterCountBadge.style.display = 'inline-flex';
        } else {
            filterCountBadge.style.display = 'none';
        }
    }

    // ─── Mobile Drawer ──────────────────────────────────────
    function openSidebar() {
        if (filterSidebar) filterSidebar.classList.add('open');
        if (filterOverlay) filterOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        if (filterSidebar) filterSidebar.classList.remove('open');
        if (filterOverlay) filterOverlay.classList.remove('visible');
        document.body.style.overflow = '';
    }

    // ─── Section Toggles ────────────────────────────────────
    function initSectionToggles() {
        document.querySelectorAll('.filter-section-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var targetId = this.getAttribute('data-target');
                var target = document.getElementById(targetId);
                var expanded = this.getAttribute('aria-expanded') === 'true';

                if (expanded) {
                    target.classList.add('collapsed');
                    this.setAttribute('aria-expanded', 'false');
                } else {
                    target.classList.remove('collapsed');
                    this.setAttribute('aria-expanded', 'true');
                }
            });
        });
    }

    // ─── URL State ──────────────────────────────────────────
    function readURLState() {
        var params = new URLSearchParams(window.location.search);
        if (params.get('search')) state.search = params.get('search');
        if (params.get('sort')) state.sort = params.get('sort');
        if (params.get('order')) state.order = params.get('order');
        if (params.get('page')) state.page = parseInt(params.get('page')) || 1;
        if (params.get('cats')) state.categorias = params.get('cats').split(',');
        if (params.get('pmin')) state.precioMin = parseInt(params.get('pmin')) || PRICE_MIN;
        if (params.get('pmax')) state.precioMax = parseInt(params.get('pmax')) || PRICE_MAX;
    }

    function updateURL() {
        var params = new URLSearchParams();
        if (state.search) params.set('search', state.search);
        if (state.sort !== 'nombre') params.set('sort', state.sort);
        if (state.order !== 'asc') params.set('order', state.order);
        if (state.page > 1) params.set('page', state.page);
        if (state.categorias.length > 0) params.set('cats', state.categorias.join(','));
        if (state.precioMin > PRICE_MIN) params.set('pmin', state.precioMin);
        if (state.precioMax < PRICE_MAX) params.set('pmax', state.precioMax);

        var url = window.location.pathname;
        var qs = params.toString();
        if (qs) url += '?' + qs;

        history.replaceState(null, '', url);
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

    function sanitizeName(str) {
        if (!str) return 'Producto';
        str = str.replace(/"{2,}/g, '"');
        str = str.replace(/^"+|"+$/g, '');
        return str.trim();
    }

    // ─── Sync UI with state ─────────────────────────────────
    function syncUIWithState() {
        // Sync search input
        if (searchInput && state.search) {
            searchInput.value = state.search;
            if (searchClearBtn) searchClearBtn.style.display = 'block';
        }

        // Sync sort select
        if (sortSelect) {
            sortSelect.value = state.sort + '-' + state.order;
        }

        // Sync price sliders
        if (priceMinSlider) priceMinSlider.value = state.precioMin;
        if (priceMaxSlider) priceMaxSlider.value = state.precioMax;
        if (priceMinInput) priceMinInput.value = state.precioMin;
        if (priceMaxInput) priceMaxInput.value = state.precioMax;
    }

    // ─── Public API ─────────────────────────────────────────
    window.productLoader = {
        goToPage: function (page) {
            if (page < 1 || page > state.totalPages || page === state.page) return;
            state.page = page;
            fetchProducts();
            if (productGrid) productGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },

        toggleCategory: function (cat) {
            var idx = state.categorias.indexOf(cat);
            if (idx === -1) {
                state.categorias.push(cat);
            } else {
                state.categorias.splice(idx, 1);
            }
            state.page = 1;
            // Update checkboxes in sidebar
            if (categoryList) {
                categoryList.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
                    cb.checked = state.categorias.indexOf(cb.value) !== -1;
                });
            }
            fetchProducts();
        },

        removeFilter: function (type, value) {
            if (type === 'category') {
                var idx = state.categorias.indexOf(value);
                if (idx !== -1) state.categorias.splice(idx, 1);
                // Uncheck in sidebar
                if (categoryList) {
                    categoryList.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
                        cb.checked = state.categorias.indexOf(cb.value) !== -1;
                    });
                }
            } else if (type === 'price') {
                state.precioMin = PRICE_MIN;
                state.precioMax = PRICE_MAX;
                if (priceMinSlider) priceMinSlider.value = PRICE_MIN;
                if (priceMaxSlider) priceMaxSlider.value = PRICE_MAX;
                if (priceMinInput) priceMinInput.value = PRICE_MIN;
                if (priceMaxInput) priceMaxInput.value = PRICE_MAX;
                // Re-render slider range
                initPriceSlider();
            } else if (type === 'search') {
                state.search = '';
                if (searchInput) searchInput.value = '';
                if (searchClearBtn) searchClearBtn.style.display = 'none';
            }
            state.page = 1;
            fetchProducts();
        },

        clearAll: function () {
            state.categorias = [];
            state.precioMin = PRICE_MIN;
            state.precioMax = PRICE_MAX;
            state.search = '';
            state.page = 1;

            // Reset UI
            if (searchInput) searchInput.value = '';
            if (searchClearBtn) searchClearBtn.style.display = 'none';
            if (priceMinSlider) priceMinSlider.value = PRICE_MIN;
            if (priceMaxSlider) priceMaxSlider.value = PRICE_MAX;
            if (priceMinInput) priceMinInput.value = PRICE_MIN;
            if (priceMaxInput) priceMaxInput.value = PRICE_MAX;
            if (categoryList) {
                categoryList.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
                    cb.checked = false;
                });
            }
            initPriceSlider();
            fetchProducts();
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
            if (searchClearBtn) searchClearBtn.style.display = query ? 'block' : 'none';
            fetchProducts();
        },

        retry: function () {
            fetchProducts();
        }
    };

    // ─── Init ───────────────────────────────────────────────
    function init() {
        // Core
        productGrid = document.getElementById('product-grid');
        paginationContainer = document.getElementById('pagination');
        searchInput = document.getElementById('product-search');
        searchForm = document.getElementById('product-search-form');
        sortSelect = document.getElementById('product-sort');
        resultCount = document.getElementById('result-count');
        loadingOverlay = document.getElementById('loading-overlay');

        // Filter system
        activeFiltersBar = document.getElementById('active-filters');
        activeFilterTags = document.getElementById('active-filter-tags');
        clearAllBtn = document.getElementById('clear-all-filters');
        filterToggleBtn = document.getElementById('filter-toggle-btn');
        filterSidebar = document.getElementById('filter-sidebar');
        filterOverlay = document.getElementById('filter-overlay');
        sidebarCloseBtn = document.getElementById('sidebar-close-btn');
        filterCountBadge = document.getElementById('filter-count-badge');
        searchClearBtn = document.getElementById('search-clear-btn');
        sidebarClearBtn = document.getElementById('sidebar-clear-filters');

        // Price slider
        priceMinSlider = document.getElementById('price-min-slider');
        priceMaxSlider = document.getElementById('price-max-slider');
        priceMinInput = document.getElementById('price-min-input');
        priceMaxInput = document.getElementById('price-max-input');
        priceSliderRange = document.getElementById('price-slider-range');

        // Category list
        categoryList = document.getElementById('filter-category-list');

        if (!productGrid) {
            console.warn('[ProductLoader] #product-grid not found');
            return;
        }

        // Read URL state
        readURLState();
        syncUIWithState();

        // Instant search (debounced)
        if (searchInput) {
            var debouncedSearch = debounce(function (val) {
                window.productLoader.search(val);
            }, 300);

            searchInput.addEventListener('input', function (e) {
                debouncedSearch(e.target.value.trim());
            });
        }

        // Search form submit
        if (searchForm) {
            searchForm.addEventListener('submit', function (e) {
                e.preventDefault();
                window.productLoader.search(searchInput ? searchInput.value.trim() : '');
            });
        }

        // Search clear button
        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', function () {
                if (searchInput) searchInput.value = '';
                searchClearBtn.style.display = 'none';
                window.productLoader.search('');
            });
        }

        // Sort
        if (sortSelect) {
            sortSelect.addEventListener('change', function (e) {
                var parts = e.target.value.split('-');
                window.productLoader.sort(parts[0], parts[1]);
            });
        }

        // Clear all filters
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', function () {
                window.productLoader.clearAll();
            });
        }

        if (sidebarClearBtn) {
            sidebarClearBtn.addEventListener('click', function () {
                window.productLoader.clearAll();
            });
        }

        // Mobile drawer toggle
        if (filterToggleBtn) {
            filterToggleBtn.addEventListener('click', openSidebar);
        }
        if (sidebarCloseBtn) {
            sidebarCloseBtn.addEventListener('click', closeSidebar);
        }
        if (filterOverlay) {
            filterOverlay.addEventListener('click', closeSidebar);
        }

        // Section toggles
        initSectionToggles();

        // Price slider
        initPriceSlider();

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
