# inject-supabase-js.ps1
# Injects Supabase CDN + custom JS scripts into all HTML files

$repoDir = 'c:\Onedrive\AJ\ARIZON\tiendamundoelectronica\tienda-mundo-electronica'
$htmlFiles = Get-ChildItem -Path $repoDir -Recurse -Filter '*.html'

$supabaseCDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
$marker = '<!-- MundoElectronica Supabase -->'

$injected = 0
$skipped = 0

foreach ($file in $htmlFiles) {
    $content = [System.IO.File]::ReadAllText($file.FullName)

    # Skip if already injected
    if ($content.Contains($marker)) {
        Write-Host "SKIP: $($file.Name) (already injected)" -ForegroundColor Yellow
        $skipped++
        continue
    }

    # Determine relative path prefix
    $relDir = $file.DirectoryName.Replace($repoDir, '').TrimStart('\')
    $isSubDir = $relDir -ne ''
    $prefix = if ($isSubDir) { '../' } else { '' }

    # Build script block
    $scripts = @"
$marker
$supabaseCDN
<script src="${prefix}js/supabase-config.js"></script>
<script src="${prefix}js/store-api.js"></script>
<script src="${prefix}js/cart.js"></script>
"@

    # Insert before </body>
    if ($content.Contains('</body>')) {
        $content = $content.Replace('</body>', "$scripts`n</body>")
        [System.IO.File]::WriteAllText($file.FullName, $content)
        Write-Host "OK: $($file.Name) -> ${prefix}js/*.js" -ForegroundColor Green
        $injected++
    }
    else {
        Write-Host "WARN: $($file.Name) - no </body> found" -ForegroundColor Red
    }
}

Write-Host "`nDone: $injected injected, $skipped skipped" -ForegroundColor Cyan
