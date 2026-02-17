import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.js';
import { supabase } from './supabase.js';

// ═══════════════════════════════════════════════════════
//  SELLIFYX STORE SERVER
//  Stripe Checkout + Supabase + Better Auth
// ═══════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

// ─── Better Auth handler (MUST be before express.json()) ─────
app.all('/api/auth/*', toNodeHandler(auth));

// ─── Webhook endpoint (must be before express.json()) ────────
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('⚠️  Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            console.log('✅ Payment successful!');
            console.log('   Session ID:', session.id);
            console.log('   Customer Email:', session.customer_details?.email);
            console.log('   Amount Total:', (session.amount_total / 100).toFixed(2), session.currency?.toUpperCase());

            // Save order to Supabase
            try {
                const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
                const { error } = await supabase.from('stripe_orders').insert({
                    user_id: session.metadata?.user_id !== 'guest' ? session.metadata?.user_id : null,
                    stripe_session_id: session.id,
                    stripe_payment_intent: session.payment_intent,
                    customer_email: session.customer_details?.email,
                    customer_name: session.customer_details?.name,
                    amount_total: session.amount_total / 100,
                    currency: session.currency,
                    status: 'completed',
                    shipping_address: session.shipping_details?.address || null,
                    line_items: lineItems.data,
                    metadata: session.metadata || {},
                });
                if (error) {
                    console.error('❌ Error saving order to Supabase:', error.message);
                } else {
                    console.log('   💾 Order saved to Supabase');
                }
            } catch (err) {
                console.error('❌ Error processing order:', err.message);
            }
            break;
        }

        case 'checkout.session.async_payment_succeeded':
            console.log('✅ Async payment succeeded:', event.data.object.id);
            break;

        case 'checkout.session.async_payment_failed':
            console.error('❌ Async payment failed:', event.data.object.id);
            break;

        default:
            console.log(`ℹ️  Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({
    origin: SITE_URL,
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// ─── Serve static files ──────────────────────────────────────
app.use(express.static(path.join(__dirname), {
    extensions: ['html'],
}));

// ═══════════════════════════════════════════════════════
//  AUTH HELPER — get current user from request
// ═══════════════════════════════════════════════════════

async function getCurrentUser(req) {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });
        return session?.user || null;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════
//  PRODUCTS API — from Supabase 'productos' table
// ═══════════════════════════════════════════════════════

// Get all products (with pagination, search, category filter & sorting)
app.get('/api/products', async (req, res) => {
    try {
        const { page = 1, limit = 24, search, sort = 'nombre', order = 'asc', categoria } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const validSorts = ['nombre', 'precio', 'created_at'];
        const sortField = validSorts.includes(sort) ? sort : 'nombre';

        let query = supabase
            .from('productos')
            .select('codigo, nombre, precio, imagen_url, descripcion, categoria', { count: 'exact' })
            .eq('cliente', 'mundo-electronica');

        if (search) {
            query = query.ilike('nombre', `%${search}%`);
        }

        if (categoria && categoria !== 'all') {
            query = query.eq('categoria', categoria);
        }

        query = query.order(sortField, { ascending: order !== 'desc' })
            .range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({
            products: data,
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get available categories
app.get('/api/categories', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('productos')
            .select('categoria')
            .eq('cliente', 'mundo-electronica')
            .not('categoria', 'is', null);

        if (error) throw error;

        const categories = [...new Set(data.map(p => p.categoria).filter(Boolean))];
        res.json({ categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single product by codigo
app.get('/api/products/:codigo', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('productos')
            .select('*')
            .eq('cliente', 'mundo-electronica')
            .eq('codigo', req.params.codigo)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Product not found' });

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════
//  CART API — persistent cart for logged-in users
// ═══════════════════════════════════════════════════════

// Get cart items
app.get('/api/cart', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { data, error } = await supabase
            .from('cart_items')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ items: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sync cart (replace all items)
app.post('/api/cart/sync', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { items } = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: 'Items must be an array' });

        // Delete existing cart
        await supabase.from('cart_items').delete().eq('user_id', user.id);

        // Insert new items
        if (items.length > 0) {
            const cartItems = items.map(item => ({
                user_id: user.id,
                product_codigo: item.codigo || item.name,
                product_name: item.name,
                product_price: item.price,
                product_image: item.image,
                quantity: item.quantity || 1,
            }));

            const { error } = await supabase.from('cart_items').insert(cartItems);
            if (error) throw error;
        }

        res.json({ success: true, count: items.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add single item to cart
app.post('/api/cart/add', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { codigo, name, price, image, quantity = 1 } = req.body;

        const { data, error } = await supabase
            .from('cart_items')
            .upsert({
                user_id: user.id,
                product_codigo: codigo || name,
                product_name: name,
                product_price: price,
                product_image: image,
                quantity,
            }, { onConflict: 'user_id,product_codigo' })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, item: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove item from cart
app.delete('/api/cart/:codigo', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', user.id)
            .eq('product_codigo', req.params.codigo);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════
//  WISHLIST API
// ═══════════════════════════════════════════════════════

app.get('/api/wishlist', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { data, error } = await supabase
            .from('wishlists')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ items: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/wishlist', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { codigo, name, image } = req.body;

        const { data, error } = await supabase
            .from('wishlists')
            .upsert({
                user_id: user.id,
                product_codigo: codigo,
                product_name: name,
                product_image: image,
            }, { onConflict: 'user_id,product_codigo' })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, item: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/wishlist/:codigo', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { error } = await supabase
            .from('wishlists')
            .delete()
            .eq('user_id', user.id)
            .eq('product_codigo', req.params.codigo);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════
//  NEWSLETTER API
// ═══════════════════════════════════════════════════════

app.post('/api/newsletter', async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const { data, error } = await supabase
            .from('newsletter_subscribers')
            .upsert({
                email: email.toLowerCase().trim(),
                name: name || null,
                source: 'website',
            }, { onConflict: 'email' })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, subscriber: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════
//  ANALYTICS API
// ═══════════════════════════════════════════════════════

app.post('/api/analytics', async (req, res) => {
    try {
        const user = await getCurrentUser(req);
        const { event_type, event_data } = req.body;

        if (!event_type) return res.status(400).json({ error: 'event_type is required' });

        const { error } = await supabase.from('analytics_events').insert({
            user_id: user?.id || null,
            event_type,
            event_data: event_data || {},
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
        });

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════
//  ORDERS API — order history for logged-in users
// ═══════════════════════════════════════════════════════

app.get('/api/orders', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { data, error } = await supabase
            .from('stripe_orders')
            .select('*')
            .eq('customer_email', user.email)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ orders: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════
//  USER SESSION API
// ═══════════════════════════════════════════════════════

app.get('/api/me', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ user });
});

// ═══════════════════════════════════════════════════════
//  STRIPE CHECKOUT (existing)
// ═══════════════════════════════════════════════════════

app.post('/create-checkout-session', async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No items provided' });
        }

        const line_items = items.map(item => {
            if (!item.name || !item.price || !item.quantity) {
                throw new Error('Each item must have name, price, and quantity');
            }

            return {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name,
                        ...(item.image && { images: [item.image] }),
                        ...(item.description && { description: item.description }),
                    },
                    unit_amount: Math.round(item.price * 100),
                },
                quantity: item.quantity,
            };
        });

        // Get current user if logged in
        const user = await getCurrentUser(req);

        const session = await stripe.checkout.sessions.create({
            line_items,
            mode: 'payment',
            success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${SITE_URL}/store`,
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'MX', 'VE', 'CO', 'EC', 'PE', 'CL', 'AR', 'BR'],
            },
            customer_creation: 'always',
            payment_intent_data: {
                statement_descriptor: 'MUNDO ELECTRONICA',
            },
            metadata: {
                user_id: user?.id || 'guest',
            },
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/session-status', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(req.query.session_id, {
            expand: ['line_items'],
        });

        res.json({
            status: session.payment_status,
            customer_email: session.customer_details?.email,
            customer_name: session.customer_details?.name,
            amount_total: session.amount_total,
            currency: session.currency,
            line_items: session.line_items?.data,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════
//  ADMIN CMS API — standalone auth (bypasses Better Auth pg)
// ═══════════════════════════════════════════════════════

// Admin emails whitelist
const ADMIN_EMAILS = [
    'admin@tiendamundoelectronica.com',
    'gerencia@arizon.ai',
];

// In-memory admin sessions (lightweight — restarts clear sessions)
const adminSessions = new Map();

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function verifyPassword(stored, input) {
    const [salt, hash] = stored.split(':');
    return new Promise((resolve, reject) => {
        crypto.scrypt(input, salt, 64, (err, derived) => {
            if (err) return reject(err);
            resolve(derived.toString('hex') === hash);
        });
    });
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, derived) => {
            if (err) return reject(err);
            resolve(`${salt}:${derived.toString('hex')}`);
        });
    });
}

// ─── Admin Login ─────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña requeridos' });
        }

        if (!ADMIN_EMAILS.includes(email)) {
            return res.status(403).json({ error: 'Este email no tiene acceso de administrador' });
        }

        // Find user in Supabase
        const { data: user, error: userError } = await supabase
            .from('user')
            .select('id, name, email')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        // Find account with password
        const { data: account, error: accError } = await supabase
            .from('account')
            .select('password')
            .eq('userId', user.id)
            .eq('providerId', 'credential')
            .single();

        if (accError || !account || !account.password) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        // Verify password
        const valid = await verifyPassword(account.password, password);
        if (!valid) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        // Create session
        const token = generateToken();
        adminSessions.set(token, {
            userId: user.id,
            email: user.email,
            name: user.name,
            createdAt: Date.now(),
        });

        // Set cookie (7 days)
        res.cookie('admin_session', token, {
            httpOnly: true,
            secure: SITE_URL.startsWith('https'),
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        res.json({ user: { email: user.email, name: user.name } });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Admin Logout ────────────────────────────────────────────
app.post('/api/admin/logout', (req, res) => {
    const token = req.cookies?.admin_session;
    if (token) adminSessions.delete(token);
    res.clearCookie('admin_session', { path: '/' });
    res.json({ success: true });
});

// ─── Admin Session Check ─────────────────────────────────────
app.get('/api/admin/me', (req, res) => {
    const token = req.cookies?.admin_session;
    if (!token) return res.status(401).json({ error: 'No autenticado' });

    const session = adminSessions.get(token);
    if (!session) return res.status(401).json({ error: 'Sesión expirada' });

    // Check if session is older than 7 days
    if (Date.now() - session.createdAt > 7 * 24 * 60 * 60 * 1000) {
        adminSessions.delete(token);
        return res.status(401).json({ error: 'Sesión expirada' });
    }

    res.json({ user: { email: session.email, name: session.name } });
});

// ─── Middleware ───────────────────────────────────────────────
function requireAdmin(req, res, next) {
    const token = req.cookies?.admin_session;
    if (!token) return res.status(401).json({ error: 'No autenticado' });

    const session = adminSessions.get(token);
    if (!session) return res.status(401).json({ error: 'Sesión expirada' });

    if (Date.now() - session.createdAt > 7 * 24 * 60 * 60 * 1000) {
        adminSessions.delete(token);
        return res.status(401).json({ error: 'Sesión expirada' });
    }

    req.adminUser = session;
    next();
}


// ─── Dashboard Stats ─────────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        // Total products
        const { count: totalProducts } = await supabase
            .from('productos')
            .select('*', { count: 'exact', head: true })
            .eq('cliente', 'mundo-electronica');

        // Total orders
        const { count: totalOrders } = await supabase
            .from('stripe_orders')
            .select('*', { count: 'exact', head: true });

        // Orders today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: ordersToday } = await supabase
            .from('stripe_orders')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());

        // Total revenue
        const { data: revenueData } = await supabase
            .from('stripe_orders')
            .select('amount_total')
            .eq('status', 'completed');

        const totalRevenue = (revenueData || []).reduce((sum, o) => sum + (parseFloat(o.amount_total) || 0), 0);

        // Categories count
        const { data: catData } = await supabase
            .from('productos')
            .select('categoria')
            .eq('cliente', 'mundo-electronica')
            .not('categoria', 'is', null);
        const totalCategories = [...new Set((catData || []).map(p => p.categoria).filter(Boolean))].length;

        // Newsletter subscribers
        const { count: totalSubscribers } = await supabase
            .from('newsletter_subscribers')
            .select('*', { count: 'exact', head: true })
            .eq('active', true);

        // Recent orders (last 5)
        const { data: recentOrders } = await supabase
            .from('stripe_orders')
            .select('id, customer_email, customer_name, amount_total, currency, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        res.json({
            totalProducts,
            totalOrders,
            ordersToday,
            totalRevenue,
            totalCategories,
            totalSubscribers,
            recentOrders: recentOrders || [],
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Products CRUD ───────────────────────────────────────────

// List all products (admin — includes all columns)
app.get('/api/admin/products', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, search, categoria, sort = 'codigo', order = 'asc' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('productos')
            .select('*', { count: 'exact' })
            .eq('cliente', 'mundo-electronica');

        if (search) {
            query = query.or(`nombre.ilike.%${search}%,codigo.ilike.%${search}%,descripcion.ilike.%${search}%`);
        }
        if (categoria && categoria !== 'all') {
            query = query.eq('categoria', categoria);
        }

        const validSorts = ['codigo', 'nombre', 'precio', 'categoria', 'created_at'];
        const sortField = validSorts.includes(sort) ? sort : 'codigo';
        query = query.order(sortField, { ascending: order !== 'desc' })
            .range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({
            products: data,
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create product
app.post('/api/admin/products', requireAdmin, async (req, res) => {
    try {
        const { codigo, nombre, precio, descripcion, imagen_url, categoria } = req.body;

        if (!codigo || !nombre || precio === undefined) {
            return res.status(400).json({ error: 'Campos requeridos: codigo, nombre, precio' });
        }

        // Check if codigo already exists
        const { data: existing } = await supabase
            .from('productos')
            .select('codigo')
            .eq('cliente', 'mundo-electronica')
            .eq('codigo', codigo)
            .single();

        if (existing) {
            return res.status(409).json({ error: `El código ${codigo} ya existe` });
        }

        const { data, error } = await supabase
            .from('productos')
            .insert({
                cliente: 'mundo-electronica',
                codigo,
                nombre,
                precio: parseFloat(precio),
                descripcion: descripcion || null,
                imagen_url: imagen_url || null,
                categoria: categoria || null,
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ product: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update product
app.put('/api/admin/products/:codigo', requireAdmin, async (req, res) => {
    try {
        const { nombre, precio, descripcion, imagen_url, categoria } = req.body;

        const updates = {};
        if (nombre !== undefined) updates.nombre = nombre;
        if (precio !== undefined) updates.precio = parseFloat(precio);
        if (descripcion !== undefined) updates.descripcion = descripcion;
        if (imagen_url !== undefined) updates.imagen_url = imagen_url;
        if (categoria !== undefined) updates.categoria = categoria;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        const { data, error } = await supabase
            .from('productos')
            .update(updates)
            .eq('cliente', 'mundo-electronica')
            .eq('codigo', req.params.codigo)
            .select()
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Producto no encontrado' });

        res.json({ product: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete product
app.delete('/api/admin/products/:codigo', requireAdmin, async (req, res) => {
    try {
        const { error } = await supabase
            .from('productos')
            .delete()
            .eq('cliente', 'mundo-electronica')
            .eq('codigo', req.params.codigo);

        if (error) throw error;
        res.json({ success: true, message: `Producto ${req.params.codigo} eliminado` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Orders (admin) ──────────────────────────────────────────

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 25, status, search } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('stripe_orders')
            .select('*', { count: 'exact' });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        if (search) {
            query = query.or(`customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`);
        }

        query = query.order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({
            orders: data,
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Categories management ───────────────────────────────────

// Rename category (bulk update all products in that category)
app.put('/api/admin/categories', requireAdmin, async (req, res) => {
    try {
        const { oldName, newName } = req.body;
        if (!oldName || !newName) {
            return res.status(400).json({ error: 'Se requieren oldName y newName' });
        }

        const { data, error } = await supabase
            .from('productos')
            .update({ categoria: newName })
            .eq('cliente', 'mundo-electronica')
            .eq('categoria', oldName)
            .select('codigo');

        if (error) throw error;
        res.json({ success: true, updated: (data || []).length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Image upload ────────────────────────────────────────────

// Multer-free upload using base64 (for simplicity)
app.post('/api/admin/upload', requireAdmin, async (req, res) => {
    try {
        const { base64, filename, contentType } = req.body;

        if (!base64 || !filename) {
            return res.status(400).json({ error: 'Se requieren base64 y filename' });
        }

        const buffer = Buffer.from(base64, 'base64');
        const path = `product-images/${Date.now()}-${filename}`;

        const { data, error } = await supabase.storage
            .from('products')
            .upload(path, buffer, {
                contentType: contentType || 'image/jpeg',
                upsert: false,
            });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('products')
            .getPublicUrl(path);

        res.json({ url: urlData.publicUrl, path });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════════════

app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('  🛒 Sellifyx Store Server');
    console.log(`  🌐 ${SITE_URL}`);
    console.log(`  💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ Connected' : '❌ Missing STRIPE_SECRET_KEY'}`);
    console.log(`  🗄️  Supabase: ${process.env.SUPABASE_URL ? '✅ ' + process.env.SUPABASE_URL : '❌ Missing SUPABASE_URL'}`);
    console.log(`  🔐 Better Auth: ${process.env.BETTER_AUTH_SECRET ? '✅ Enabled' : '❌ Missing BETTER_AUTH_SECRET'}`);
    console.log(`  📦 Products API: GET /api/products`);
    console.log(`  🔑 Auth Check: GET /api/auth/ok`);
    console.log(`  🛠️  Admin CMS: GET /admin`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
});
