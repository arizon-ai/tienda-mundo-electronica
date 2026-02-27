/**
 * Fix product names with excessive quotes (CSV double-escaping of inch marks)
 * For example: "TCL 43"""" Qled Google TV" → "TCL 43\" Qled Google TV"
 */
const SUPABASE_URL = 'https://bd.clients.arizonai.cloud';
const SUPABASE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MDc0MTg0MCwiZXhwIjo0OTI2NDE1NDQwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.clcX2fjUJyO5bvThFqnlnoGrt84BC_iayNhqi_zPox4';

async function main() {
    // Fetch all products with quotes in names
    const findUrl = `${SUPABASE_URL}/rest/v1/productos?select=id,nombre&cliente=eq.mundo-electronica&nombre=like.*%22*&limit=100`;
    const findRes = await fetch(findUrl, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const products = await findRes.json();

    console.log(`Found ${products.length} products with quotes in names\n`);

    let fixed = 0;
    for (const p of products) {
        // Remove all " characters from the name
        // The pattern is: name is wrapped in " and inches are """" instead of "
        let cleanName = p.nombre;

        // Remove leading/trailing quotes if the entire name is wrapped
        if (cleanName.startsWith('"') && cleanName.endsWith('"')) {
            cleanName = cleanName.slice(1, -1);
        }

        // Replace sequence of 4+ quotes with a single inch mark
        cleanName = cleanName.replace(/"{4,}/g, '"');
        // Replace sequence of 2+ quotes with a single inch mark
        cleanName = cleanName.replace(/"{2,}/g, '"');

        if (cleanName !== p.nombre) {
            console.log(`  BEFORE: ${JSON.stringify(p.nombre)}`);
            console.log(`  AFTER:  ${JSON.stringify(cleanName)}\n`);

            // Update in database
            const updateUrl = `${SUPABASE_URL}/rest/v1/productos?id=eq.${p.id}`;
            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ nombre: cleanName })
            });
            const result = await updateRes.json();
            if (result.length > 0) {
                console.log(`  ✅ Updated: ${result[0].nombre}\n`);
                fixed++;
            } else {
                console.log(`  ⚠️ Failed to update ID ${p.id}\n`);
            }
        }
    }

    console.log(`\nDone! Fixed ${fixed} product names.`);
}

main().catch(console.error);
