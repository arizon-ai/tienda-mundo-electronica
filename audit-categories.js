/**
 * Category Audit — outputs JSON for easy parsing
 */
const SUPABASE_URL = 'https://bd.clients.arizonai.cloud';
const SUPABASE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MDc0MTg0MCwiZXhwIjo0OTI2NDE1NDQwLCJyb2xlIjoiYW5vbiJ9.G9y4jfrnmnceD9qmaXFSH0Q6Zj14pbZZF40F5YffaOE';
const fs = require('fs');

async function main() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/productos?select=nombre,categoria,descripcion&cliente=eq.mundo-electronica&order=categoria.asc,nombre.asc&limit=2000`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const products = await res.json();

    const cats = {};
    for (const p of products) {
        const c = p.categoria || '(none)';
        if (!cats[c]) cats[c] = [];
        cats[c].push({ n: p.nombre, d: (p.descripcion || '').substring(0, 80).replace(/[\n\r]/g, ' ') });
    }

    let output = '';
    for (const c of Object.keys(cats).sort()) {
        output += `\n=== ${c} (${cats[c].length}) ===\n`;
        for (const p of cats[c]) {
            output += `  ${p.n} | ${p.d}\n`;
        }
    }

    fs.writeFileSync('audit-output.txt', output, 'utf8');
    console.log(`Done: ${products.length} products in ${Object.keys(cats).length} categories. Output saved to audit-output.txt`);
}

main().catch(console.error);
