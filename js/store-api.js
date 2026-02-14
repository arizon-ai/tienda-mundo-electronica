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
    // Products
    // ========================

    async function fetchProducts(options) {
        var client = getClient();
        if (!client) return { data: null, error: 'No client' };

        options = options || {};
        var query = client
            .from('products')
            .select('*, categories(name, slug)')
            .eq('in_stock', true)
            .order('featured', { ascending: false })
            .order('created_at', { ascending: false });

        if (options.category) {
            query = query.eq('categories.slug', options.category);
        }
        if (options.featured) {
            query = query.eq('featured', true);
        }
        if (options.limit) {
            query = query.limit(options.limit);
        }

        var result = await query;
        return result;
    }

    async function fetchProduct(slug) {
        var client = getClient();
        if (!client) return { data: null, error: 'No client' };

        var result = await client
            .from('products')
            .select('*, categories(name, slug)')
            .eq('slug', slug)
            .single();

        return result;
    }

    // ========================
    // Categories
    // ========================

    async function fetchCategories() {
        var client = getClient();
        if (!client) return { data: null, error: 'No client' };

        var result = await client.from('categories').select('*').order('name');
        return result;
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
