/**
 * Store API — Mundo Electrónica
 * Functions for products, categories, contact, and orders via Supabase.
 */
(function () {
    'use strict';

    var sb = null;

    function getClient() {
        if (!sb) {
            if (!window.MundoElectronica || !window.MundoElectronica.supabase) {
                console.error('[StoreAPI] Supabase client not initialized.');
                return null;
            }
            sb = window.MundoElectronica.supabase;
        }
        return sb;
    }

    // ========================
    // Products (from 'productos' table)
    // ========================

    async function fetchProducts(options) {
        var client = getClient();
        if (!client) return { data: null, error: 'No client', count: 0 };

        options = options || {};
        var page = options.page || 1;
        var limit = options.limit || 24;
        var offset = (page - 1) * limit;

        var query = client
            .from('productos')
            .select('codigo, nombre, precio, imagen_url, descripcion, categoria', { count: 'exact' })
            .eq('cliente', 'mundo-electronica');

        // Category filter
        if (options.categoria && options.categoria !== 'all') {
            query = query.eq('categoria', options.categoria);
        }

        // Search filter
        if (options.search) {
            query = query.ilike('nombre', '%' + options.search + '%');
        }

        // Sorting
        var sortField = options.sort || 'nombre';
        var ascending = options.order !== 'desc';
        query = query.order(sortField, { ascending: ascending });

        // Pagination
        query = query.range(offset, offset + limit - 1);

        var result = await query;
        var total = result.count || 0;

        return {
            data: result.data,
            error: result.error,
            total: total,
            page: page,
            limit: limit,
            totalPages: Math.ceil(total / limit)
        };
    }

    async function fetchProduct(codigo) {
        var client = getClient();
        if (!client) return { data: null, error: 'No client' };

        var result = await client
            .from('productos')
            .select('*')
            .eq('cliente', 'mundo-electronica')
            .eq('codigo', codigo)
            .single();

        return result;
    }

    // ========================
    // Categories (from 'productos' distinct categoria)
    // ========================

    async function fetchCategories() {
        var client = getClient();
        if (!client) return { data: null, error: 'No client' };

        var result = await client
            .from('productos')
            .select('categoria')
            .eq('cliente', 'mundo-electronica')
            .not('categoria', 'is', null);

        if (result.error) return result;

        // Extract unique categories
        var seen = {};
        var categories = [];
        (result.data || []).forEach(function (row) {
            if (row.categoria && !seen[row.categoria]) {
                seen[row.categoria] = true;
                categories.push(row.categoria);
            }
        });
        categories.sort();

        return { data: categories, error: null };
    }

    // ========================
    // Contact Messages
    // ========================

    async function submitContact(data) {
        var client = getClient();
        if (!client) return { data: null, error: 'No client' };

        var result = await client.from('contact_messages').insert({
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            message: data.message,
        });

        return result;
    }

    // ========================
    // Orders
    // ========================

    async function createCustomer(customerData) {
        var client = getClient();
        if (!client) return { data: null, error: 'No client' };

        var result = await client
            .from('customers')
            .insert({
                email: customerData.email,
                full_name: customerData.fullName,
                phone: customerData.phone || null,
                address: customerData.address || {},
            })
            .select()
            .single();

        return result;
    }

    async function submitOrder(customer, cartItems) {
        var client = getClient();
        if (!client) return { data: null, error: 'No client' };

        // 1. Create or find customer
        var custResult = await createCustomer(customer);
        if (custResult.error) return custResult;

        // 2. Calculate total
        var total = cartItems.reduce(function (sum, item) {
            return sum + item.price * item.quantity;
        }, 0);

        // 3. Create order
        var orderResult = await client
            .from('orders')
            .insert({
                customer_id: custResult.data.id,
                total: total,
                shipping_address: customer.address || {},
                notes: customer.notes || '',
            })
            .select()
            .single();

        if (orderResult.error) return orderResult;

        // 4. Create order items
        var orderItems = cartItems.map(function (item) {
            return {
                order_id: orderResult.data.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.price,
            };
        });

        var itemsResult = await client.from('order_items').insert(orderItems);
        if (itemsResult.error) return itemsResult;

        return { data: orderResult.data, error: null };
    }

    // ========================
    // Export
    // ========================

    window.MundoElectronica = window.MundoElectronica || {};
    window.MundoElectronica.store = {
        fetchProducts: fetchProducts,
        fetchProduct: fetchProduct,
        fetchCategories: fetchCategories,
        submitContact: submitContact,
        submitOrder: submitOrder,
    };
})();
