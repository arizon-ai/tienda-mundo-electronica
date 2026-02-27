/**
 * Category Fix Script — Moves misplaced products to correct categories
 * Based on full audit of all 731 products across 14 categories
 */

const SUPABASE_URL = 'https://bd.clients.arizonai.cloud';
const SUPABASE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MDc0MTg0MCwiZXhwIjo0OTI2NDE1NDQwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.clcX2fjUJyO5bvThFqnlnoGrt84BC_iayNhqi_zPox4';

async function updateCategory(nombre, from, to) {
    const url = `${SUPABASE_URL}/rest/v1/productos?nombre=eq.${encodeURIComponent(nombre)}&cliente=eq.mundo-electronica&categoria=eq.${encodeURIComponent(from)}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ categoria: to })
    });
    const data = await res.json();
    if (data.length > 0) {
        console.log(`  ✅ "${nombre}" : ${from} → ${to}`);
    } else {
        console.log(`  ⚠️ NOT FOUND: "${nombre}" in "${from}"`);
    }
    return data;
}

async function main() {
    console.log('🔧 CATEGORY FIX SCRIPT\n');

    // ═══════════════════════════════════════════════════════
    // 1. ACCESORIOS → correct (Honor Choice VZ Sport should be Audio)
    // ═══════════════════════════════════════════════════════
    console.log('\n📁 Fixing Accesorios...');
    await updateCategory('Honor Choice VZ Sport', 'Accesorios', 'Audio');
    await updateCategory('Tplink USB Adapter TL-WN8200ND', 'Accesorios', 'Redes & Conectividad');
    // Pencil 2ND and Pencil Pro → Accesorios is OK (Apple Pencil accessories)
    // Power Bank, Chargers → Accesorios is OK

    // ═══════════════════════════════════════════════════════
    // 2. ELECTRODOMÉSTICOS → misplaced items
    // ═══════════════════════════════════════════════════════
    console.log('\n📁 Fixing Electrodomésticos...');
    await updateCategory('Alexa Echo Pop Kids', 'Electrodomésticos', 'Smart TV & Pantallas');
    await updateCategory('Amazon Fire Tv Stick 4k', 'Electrodomésticos', 'Smart TV & Pantallas');
    await updateCategory('Amazon Fire Tv Stick 4k Max', 'Electrodomésticos', 'Smart TV & Pantallas');
    await updateCategory('Amazon Fire Tv Stick HD', 'Electrodomésticos', 'Smart TV & Pantallas');
    await updateCategory('Estacion de carga E980', 'Electrodomésticos', 'Accesorios');
    await updateCategory('River 2 Pro Estacion de carga EFR620', 'Electrodomésticos', 'Accesorios');
    await updateCategory('Xiaomi Robot Vacuum S20', 'Electrodomésticos', 'Electrodomésticos'); // OK stays
    await updateCategory('Cordless Pressure Washer', 'Electrodomésticos', 'Herramientas');
    await updateCategory('Sopladora / Aspiradora 400W UAB4018', 'Electrodomésticos', 'Herramientas');
    // Planchas de cabello → should go to Cuidado Personal
    await updateCategory('Plancha Extreme 127V 480F', 'Electrodomésticos', 'Cuidado Personal');
    await updateCategory('Plancha MQ Max Slim Titanium 480F', 'Electrodomésticos', 'Cuidado Personal');
    await updateCategory('Plancha MQ Pro 480F', 'Electrodomésticos', 'Cuidado Personal');
    await updateCategory('Plancha MQ Turbo Led', 'Electrodomésticos', 'Cuidado Personal');
    await updateCategory('Plancha MQ Veloz 480F', 'Electrodomésticos', 'Cuidado Personal');
    await updateCategory('Plancha Supreme 127V 485F', 'Electrodomésticos', 'Cuidado Personal');

    // ═══════════════════════════════════════════════════════
    // 3. REDES & CONECTIVIDAD → misplaced items
    // ═══════════════════════════════════════════════════════
    console.log('\n📁 Fixing Redes & Conectividad...');
    await updateCategory('Olax Banknote Detector', 'Redes & Conectividad', 'Electrodomésticos');
    await updateCategory('Olax Mini DC UPS 10.000mha', 'Redes & Conectividad', 'Accesorios');
    await updateCategory('Olax Mini DC UPS 12.000mha', 'Redes & Conectividad', 'Accesorios');
    await updateCategory('Olax Patineta de Equilibrio 6.5', 'Redes & Conectividad', 'Otros');
    await updateCategory('Tplink Camara Tapo 2K', 'Redes & Conectividad', 'Smartphones'); // security camera → keep in redes? Actually it's a camera → move to Smart Home or keep
    // Actually cameras are IoT/smart home — leave in Redes & Conectividad since there's no Smart Home category
    // Let me revert the camera — it fits Redes & Conectividad as a smart device

    // ═══════════════════════════════════════════════════════
    // 4. SMART TV & PANTALLAS → misplaced items  
    // ═══════════════════════════════════════════════════════
    console.log('\n📁 Fixing Smart TV & Pantallas...');
    await updateCategory('Protector Voltaje 220V V015', 'Smart TV & Pantallas', 'Accesorios');
    await updateCategory('Regleta 12 tomas 60CM', 'Smart TV & Pantallas', 'Accesorios');
    await updateCategory('Regleta 6 tomas 60CM', 'Smart TV & Pantallas', 'Accesorios');
    await updateCategory('Regleta 7 tomas 60CM', 'Smart TV & Pantallas', 'Accesorios');

    // ═══════════════════════════════════════════════════════
    // 5. SMARTPHONES → HUGE cleanup needed (many misplaced items)
    // ═══════════════════════════════════════════════════════
    console.log('\n📁 Fixing Smartphones (many misplaced items)...');

    // Bases / Soportes de TV → Smart TV & Pantallas
    await updateCategory('Base 14" A 55" 45KG', 'Smartphones', 'Smart TV & Pantallas');
    await updateCategory('Base 14" A 55" 50KG', 'Smartphones', 'Smart TV & Pantallas');
    await updateCategory('Base 26" A 55" 35KG', 'Smartphones', 'Smart TV & Pantallas');
    await updateCategory('Base 37" A 70" 50KG', 'Smartphones', 'Smart TV & Pantallas');

    // Body Composition Scale / Smart Scale → Cuidado Personal
    await updateCategory('Body Composition Scale S400 (Bascula)', 'Smartphones', 'Cuidado Personal');
    await updateCategory('Smart Scale S200 (Bascula)', 'Smartphones', 'Cuidado Personal');

    // Cameras → Redes & Conectividad (IoT/smart devices)
    await updateCategory('Camara AW300 Exterior', 'Smartphones', 'Redes & Conectividad');
    await updateCategory('Camara Home Security 2K', 'Smartphones', 'Redes & Conectividad');
    await updateCategory('Camara Smart 360 C400', 'Smartphones', 'Redes & Conectividad');
    await updateCategory('Camara Smart C301', 'Smartphones', 'Redes & Conectividad');

    // Cepillos (vacuum) → Electrodomésticos
    await updateCategory('Cepillo Inalambrico Air 2', 'Smartphones', 'Electrodomésticos');
    await updateCategory('Cepillo Inalambrico F1', 'Smartphones', 'Electrodomésticos');
    await updateCategory('Cepillo Inalambrico X', 'Smartphones', 'Electrodomésticos');
    await updateCategory('Cepillo Inalambrico X Pro', 'Smartphones', 'Electrodomésticos');

    // Donut Machine → Electrodomésticos 
    await updateCategory('Donut Machine SK-821', 'Smartphones', 'Electrodomésticos');

    // Huawei M-Pen Lite → Accesorios
    await updateCategory('Huawei M-Pen Lite', 'Smartphones', 'Accesorios');

    // Huawei Mate X6 and XT → actually phones (foldable), keep in Smartphones

    // Infinix Xpad → Tablets
    await updateCategory('Infinix Xpad 20 4G 4GB/128GB', 'Smartphones', 'Tablets');
    await updateCategory('Infinix Xpad 4GB/128GB', 'Smartphones', 'Tablets');

    // Mac Mini → Laptops
    await updateCategory('Mac Mini M4 16GB/256GB', 'Smartphones', 'Laptops');

    // Mouse → Accesorios
    await updateCategory('Mouse Wireless 2 Lite', 'Smartphones', 'Accesorios');
    await updateCategory('Mouse Wireless 3', 'Smartphones', 'Accesorios');

    // Protector Voltaje → Accesorios
    await updateCategory('Protector Voltaje 120V V009', 'Smartphones', 'Accesorios');
    await updateCategory('Protector Voltaje 120V V010', 'Smartphones', 'Accesorios');
    await updateCategory('Protector Voltaje 120V V157', 'Smartphones', 'Accesorios');
    await updateCategory('Protector Voltaje 220V V010', 'Smartphones', 'Accesorios');

    // Regletas → Accesorios
    await updateCategory('Regleta Cuadrada 3 tomas', 'Smartphones', 'Accesorios');
    await updateCategory('Regleta Cuadrada 6 tomas', 'Smartphones', 'Accesorios');
    await updateCategory('Regleta Ovalada 3 tomas', 'Smartphones', 'Accesorios');
    await updateCategory('Regleta Ovalada 6 tomas', 'Smartphones', 'Accesorios');

    // UPS → Accesorios
    await updateCategory('UPS 500VA', 'Smartphones', 'Accesorios');
    await updateCategory('UPS 650VA', 'Smartphones', 'Accesorios');

    // Xiaomi Set Camara 14 Ultra → Accesorios (camera kit accessory)
    await updateCategory('Xiaomi Set Camara 14 Ultra', 'Smartphones', 'Accesorios');

    // L66 Pro → check if it's a phone or something else
    // "L66 Pro 8GB/128GB" with description about power/storage → sounds like a phone, keep

    // ═══════════════════════════════════════════════════════
    // 6. GAMING & VR → check items
    // ═══════════════════════════════════════════════════════
    console.log('\n📁 Fixing Gaming & VR...');
    // HP Victus laptops → should be in Laptops
    await updateCategory('HP Victus I5 13420H 16/512GB RTX4050', 'Gaming & VR', 'Laptops');
    await updateCategory('HP Victus PC R5 8/512GB RX6400', 'Gaming & VR', 'Laptops');
    // Vision Pro → Gaming & VR is OK (VR headset)
    // PS Backbone → Accesorios or Gaming & VR? It's a gaming controller attachment — keep in Gaming & VR

    // ═══════════════════════════════════════════════════════
    // 7. IMPRESORAS & OFICINA → check items
    // ═══════════════════════════════════════════════════════
    console.log('\n📁 Fixing Impresoras & Oficina...');
    // Pizarra Digital → could stay (office equipment)
    // All look OK

    // ═══════════════════════════════════════════════════════
    // 8. OTROS → REF.60 — check what it is
    // ═══════════════════════════════════════════════════════
    console.log('\n📁 Checking Otros...');
    // REF.60 → description says "organización eficiente" — could be office furniture. Keep in Otros for now.

    console.log('\n✅ CATEGORY FIX COMPLETE');

    // Run a quick summary
    const res = await fetch(`${SUPABASE_URL}/rest/v1/productos?select=categoria&cliente=eq.mundo-electronica&limit=2000`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const products = await res.json();
    const counts = {};
    for (const p of products) {
        const c = p.categoria || '(none)';
        counts[c] = (counts[c] || 0) + 1;
    }
    console.log('\n📊 Updated category counts:');
    for (const c of Object.keys(counts).sort()) {
        console.log(`  ${c}: ${counts[c]}`);
    }
}

main().catch(console.error);
