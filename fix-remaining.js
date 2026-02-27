/**
 * Fix Base products — they have literal quote chars in their names
 */
const SUPABASE_URL = 'https://bd.clients.arizonai.cloud';
const SUPABASE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MDc0MTg0MCwiZXhwIjo0OTI2NDE1NDQwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.clcX2fjUJyO5bvThFqnlnoGrt84BC_iayNhqi_zPox4';

async function main() {
    // Use ilike with wildcard to find Base products regardless of quotes
    const url = `${SUPABASE_URL}/rest/v1/productos?cliente=eq.mundo-electronica&categoria=eq.Smartphones&nombre=ilike.*Base*KG*`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ categoria: 'Smart TV & Pantallas' })
    });
    const data = await res.json();
    console.log(`Updated ${data.length} Base products to Smart TV & Pantallas:`);
    for (const p of data) console.log(`  - ${p.nombre}`);

    // Final count verification
    const countRes = await fetch(`${SUPABASE_URL}/rest/v1/productos?select=categoria&cliente=eq.mundo-electronica&limit=2000`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const all = await countRes.json();
    const counts = {};
    for (const p of all) { const c = p.categoria || '(none)'; counts[c] = (counts[c] || 0) + 1; }
    console.log('\nFinal category counts:');
    for (const c of Object.keys(counts).sort()) console.log(`  ${c}: ${counts[c]}`);
}

main().catch(console.error);
