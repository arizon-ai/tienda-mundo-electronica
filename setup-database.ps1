$supabaseUrl = 'https://bd.clients.arizonai.cloud'
$serviceKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MDc0MTg0MCwiZXhwIjo0OTI2NDE1NDQwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.clcX2fjUJyO5bvThFqnlnoGrt84BC_iayNhqi_zPox4'

$headers = @{
    'apikey'        = $serviceKey
    'Authorization' = "Bearer $serviceKey"
    'Content-Type'  = 'application/json'
    'Prefer'        = 'return=minimal'
}

# ========================================
# STEP 1: Create tables via SQL
# ========================================
Write-Host "=== STEP 1: Creating database tables ===" -ForegroundColor Cyan

$sql = @"
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    short_description TEXT,
    image_url VARCHAR(500),
    image_srcset TEXT,
    category_id UUID REFERENCES categories(id),
    in_stock BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    features JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    address JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    shipping_address JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cart Items table (session-based)
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Messages table
CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_items(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
"@

try {
    $body = @{ query = $sql } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/exec_sql" -Headers $headers -Method Post -Body $body
    Write-Host "Tables created via RPC!" -ForegroundColor Green
}
catch {
    Write-Host "RPC not available, trying direct SQL endpoint..." -ForegroundColor Yellow
    
    # Try the SQL endpoint (Supabase pg-meta)
    try {
        $sqlHeaders = @{
            'apikey'        = $serviceKey
            'Authorization' = "Bearer $serviceKey"
            'Content-Type'  = 'application/json'
        }
        $body = @{ query = $sql } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$supabaseUrl/pg/query" -Headers $sqlHeaders -Method Post -Body $body
        Write-Host "Tables created via pg/query!" -ForegroundColor Green
    }
    catch {
        Write-Host "Trying /rest/v1/sql endpoint..." -ForegroundColor Yellow
        try {
            $response = Invoke-RestMethod -Uri "$supabaseUrl/sql" -Headers $sqlHeaders -Method Post -Body $body
            Write-Host "Tables created via /sql!" -ForegroundColor Green
        }
        catch {
            Write-Host "Could not find SQL execution endpoint. Error: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
            Write-Host "=== MANUAL SQL REQUIRED ===" -ForegroundColor Yellow
            Write-Host "Please run the SQL below in your Supabase SQL Editor:" -ForegroundColor Yellow
            Write-Host "URL: $supabaseUrl (Dashboard -> SQL Editor)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host $sql
            Write-Host ""
            Write-Host "After running the SQL, re-run this script to seed data." -ForegroundColor Yellow
        }
    }
}

# ========================================
# STEP 2: Check if tables exist
# ========================================
Write-Host ""
Write-Host "=== STEP 2: Verifying tables ===" -ForegroundColor Cyan

$tables = @('categories', 'products', 'customers', 'orders', 'order_items', 'cart_items', 'contact_messages')

foreach ($table in $tables) {
    try {
        $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/$table`?select=count" -Headers @{
            'apikey'        = $serviceKey
            'Authorization' = "Bearer $serviceKey"
            'Prefer'        = 'count=exact'
        } -Method Head
        Write-Host "  OK: $table exists" -ForegroundColor Green
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 404) {
            Write-Host "  MISSING: $table (run SQL manually first)" -ForegroundColor Red
        }
        else {
            Write-Host "  CHECK: $table - status $status" -ForegroundColor Yellow
        }
    }
}

# ========================================
# STEP 3: Seed categories
# ========================================
Write-Host ""
Write-Host "=== STEP 3: Seeding categories ===" -ForegroundColor Cyan

$categories = @(
    @{ name = 'Technology'; slug = 'technology'; description = 'Smart devices, cameras, and cutting-edge tech for your connected lifestyle.'; image_url = 'images/category-technology.webp' },
    @{ name = 'Gear'; slug = 'gear'; description = 'Premium audio gear, headphones, and wearable tech for everyday use.'; image_url = 'images/category-gear.webp' },
    @{ name = 'Accessory'; slug = 'accessory'; description = 'Essential accessories, bags, and lifestyle items for tech enthusiasts.'; image_url = 'images/category-accessories.webp' }
)

$catHeaders = @{
    'apikey'        = $serviceKey
    'Authorization' = "Bearer $serviceKey"
    'Content-Type'  = 'application/json'
    'Prefer'        = 'resolution=merge-duplicates,return=representation'
}

try {
    $catJson = $categories | ConvertTo-Json -Depth 3
    $catResponse = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/categories" -Headers $catHeaders -Method Post -Body $catJson
    Write-Host "  Seeded $($catResponse.Count) categories" -ForegroundColor Green
    
    # Build category lookup
    $catLookup = @{}
    foreach ($cat in $catResponse) {
        $catLookup[$cat.slug] = $cat.id
    }
}
catch {
    Write-Host "  Error seeding categories: $($_.Exception.Message)" -ForegroundColor Red
    # Try to get existing categories
    try {
        $existingCats = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/categories?select=id,slug" -Headers @{
            'apikey'        = $serviceKey
            'Authorization' = "Bearer $serviceKey"
        } -Method Get
        $catLookup = @{}
        foreach ($cat in $existingCats) {
            $catLookup[$cat.slug] = $cat.id
        }
        Write-Host "  Using existing categories ($($existingCats.Count) found)" -ForegroundColor Yellow
    }
    catch {
        Write-Host "  Cannot access categories table" -ForegroundColor Red
        exit 1
    }
}

Write-Host "  Category IDs:"
foreach ($key in $catLookup.Keys) {
    Write-Host "    $key = $($catLookup[$key])"
}

# ========================================
# STEP 4: Seed products
# ========================================
Write-Host ""
Write-Host "=== STEP 4: Seeding products ===" -ForegroundColor Cyan

$products = @(
    @{
        name              = 'Smart Glass'
        slug              = 'modern-table-watch'
        price             = 79.99
        description       = 'Experience the future with our Smart Glass. Featuring augmented reality overlays, voice control, and an ultra-lightweight titanium frame. Built-in displays and an all-day battery life make it the ultimate tech wearable.'
        short_description = 'Augmented reality smart glass with voice control, ultra-lightweight titanium frame, and all-day battery.'
        image_url         = 'images/smart-20glass.webp'
        category_id       = $catLookup['technology']
        featured          = $true
        in_stock          = $true
    },
    @{
        name              = 'Over-Ear Headphones'
        slug              = 'over-ear-headphones'
        price             = 79.99
        description       = 'Immerse yourself in rich, detailed sound with our Over-Ear Headphones. Featuring plush memory foam ear cushions, active noise cancellation, and a 36-hour battery life for uninterrupted listening pleasure.'
        short_description = 'Premium over-ear headphones with active noise cancellation, memory foam cushions, and 36-hour battery.'
        image_url         = 'images/headphones.webp'
        category_id       = $catLookup['gear']
        featured          = $true
        in_stock          = $true
    },
    @{
        name              = 'Portable Bluetooth Speaker'
        slug              = 'portable-bluetooth-speaker'
        price             = 29.00
        description       = 'Enjoy powerful sound anywhere with this portable Bluetooth speaker featuring deep bass, long battery life, and a sleek, water-resistant design for adventure.'
        short_description = 'Compact Bluetooth speaker with deep bass, water-resistant design, and long battery life.'
        image_url         = 'images/bluetooth-20speaker.webp'
        category_id       = $catLookup['technology']
        featured          = $true
        in_stock          = $true
    },
    @{
        name              = 'Shockproof Camera Bag'
        slug              = 'shockproof-camera-bag'
        price             = 200.00
        description       = 'Protect your gear with this shockproof camera bag, durable, lightweight, and designed for comfort, organization, and secure travel anywhere you go.'
        short_description = 'Durable shockproof camera bag designed for secure travel and gear protection.'
        image_url         = 'images/camera-20bag.webp'
        category_id       = $catLookup['accessory']
        featured          = $false
        in_stock          = $true
    },
    @{
        name              = 'Wireless Security Camera'
        slug              = 'wireless-security-camera'
        price             = 99.00
        description       = 'Keep your home safe with our Wireless Security Camera. Features 4K ultra-HD video, night vision, two-way audio, and smart motion detection with instant phone alerts.'
        short_description = '4K wireless security camera with night vision, two-way audio and smart alerts.'
        image_url         = 'images/security-20camera.webp'
        category_id       = $catLookup['technology']
        featured          = $false
        in_stock          = $true
    },
    @{
        name              = 'Wireless Earbuds'
        slug              = 'wireless-earbuds'
        price             = 49.99
        description       = 'Experience high-fidelity audio with our sleek wireless earbuds. Featuring noise cancellation, touch controls, and all-day battery life, they are perfect for work and play.'
        short_description = 'High-fidelity wireless earbuds with noise cancellation and touch controls.'
        image_url         = 'images/earbuds.webp'
        category_id       = $catLookup['gear']
        featured          = $true
        in_stock          = $true
    },
    @{
        name              = 'Sports Digital Watch'
        slug              = 'sports-digital-watch'
        price             = 129.99
        description       = 'Track your fitness goals with our Sports Digital Watch. Features heart rate monitoring, GPS tracking, water resistance up to 50 meters, and a vibrant AMOLED display.'
        short_description = 'Sports digital watch with GPS, heart rate monitor, and 50m water resistance.'
        image_url         = 'images/sports-20watch.webp'
        category_id       = $catLookup['technology']
        featured          = $false
        in_stock          = $true
    },
    @{
        name              = 'Smart Table Clock'
        slug              = 'smart-table-clock'
        price             = 129.99
        description       = 'Upgrade your desk with the Smart Table Clock. Features a sleek LED display, wireless charging pad, ambient light sensor, and voice assistant integration.'
        short_description = 'Smart LED table clock with wireless charging and voice assistant integration.'
        image_url         = 'images/table-20clock.webp'
        category_id       = $catLookup['gear']
        featured          = $false
        in_stock          = $true
    },
    @{
        name              = 'Wooden Desk Lamp'
        slug              = 'wooden-desk-lamp'
        price             = 29.00
        description       = 'Illuminate your workspace with this elegant Wooden Desk Lamp. Features adjustable brightness, warm-to-cool color temperature, and a sustainable natural wood base.'
        short_description = 'Elegant wooden desk lamp with adjustable brightness and color temperature.'
        image_url         = 'images/desk-20lamp.webp'
        category_id       = $catLookup['accessory']
        featured          = $false
        in_stock          = $true
    }
)

$prodHeaders = @{
    'apikey'        = $serviceKey
    'Authorization' = "Bearer $serviceKey"
    'Content-Type'  = 'application/json'
    'Prefer'        = 'resolution=merge-duplicates,return=representation'
}

try {
    $prodJson = $products | ConvertTo-Json -Depth 3
    $prodResponse = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/products" -Headers $prodHeaders -Method Post -Body $prodJson
    Write-Host "  Seeded $($prodResponse.Count) products" -ForegroundColor Green
    foreach ($p in $prodResponse) {
        Write-Host "    $($p.name) - `$$($p.price)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "  Error seeding products: $($_.Exception.Message)" -ForegroundColor Red
    
    # Check if products already exist
    try {
        $existing = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/products?select=name,price" -Headers @{
            'apikey'        = $serviceKey
            'Authorization' = "Bearer $serviceKey"
        } -Method Get
        Write-Host "  Products already exist ($($existing.Count) found):" -ForegroundColor Yellow
        foreach ($p in $existing) {
            Write-Host "    $($p.name) - `$$($p.price)" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "  Cannot access products table - please create tables first" -ForegroundColor Red
    }
}

# ========================================
# STEP 5: Enable RLS
# ========================================
Write-Host ""
Write-Host "=== STEP 5: Row Level Security ===" -ForegroundColor Cyan
Write-Host "  RLS policies require SQL Editor. Please run the following in your dashboard:" -ForegroundColor Yellow

$rlsSQL = @"

-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Public read for products and categories
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);

-- Cart: anyone with session can manage their cart
CREATE POLICY "Public insert cart" ON cart_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read cart" ON cart_items FOR SELECT USING (true);
CREATE POLICY "Public update cart" ON cart_items FOR UPDATE USING (true);
CREATE POLICY "Public delete cart" ON cart_items FOR DELETE USING (true);

-- Contact messages: public insert
CREATE POLICY "Public insert contact" ON contact_messages FOR INSERT WITH CHECK (true);

-- Orders: public insert (for checkout)
CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert order_items" ON order_items FOR INSERT WITH CHECK (true);

-- Customers: public insert (for registration)
CREATE POLICY "Public insert customers" ON customers FOR INSERT WITH CHECK (true);

"@

Write-Host $rlsSQL -ForegroundColor DarkGray

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Tables created and data seeded successfully!" -ForegroundColor Green
Write-Host "Next: Run the RLS SQL above in your Supabase dashboard." -ForegroundColor Yellow
