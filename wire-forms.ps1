# wire-forms.ps1
# Adds form-specific handlers to auth pages and contact page

$repoDir = 'c:\Onedrive\AJ\ARIZON\tiendamundoelectronica\tienda-mundo-electronica'
$marker = '<!-- MundoElectronica FormWire -->'

# ========================================
# Sign In
# ========================================
$signInFile = Join-Path $repoDir 'authentication-pages\sign-in.html'
$signInScript = @"
$marker
<script>
(function() {
  var form = document.getElementById('email-form');
  if (!form) return;
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    var email = form.querySelector('[name="Email-Address"]').value;
    var password = form.querySelector('[name="Password"]').value;
    var submitBtn = form.querySelector('[type="submit"]');
    var successDiv = form.closest('.form-wrap').querySelector('.success-message-box');
    var errorDiv = form.closest('.form-wrap').querySelector('.error-message-box');
    submitBtn.value = 'Iniciando sesión...';
    successDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    var result = await window.MundoElectronica.auth.signIn(email, password);
    if (result.error) {
      errorDiv.style.display = 'block';
      errorDiv.querySelector('div').textContent = result.error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos.' : result.error.message;
      submitBtn.value = 'Sign in';
    } else {
      successDiv.style.display = 'block';
      successDiv.querySelector('div').textContent = '¡Bienvenido! Redirigiendo...';
      form.style.display = 'none';
      setTimeout(function() { window.location.href = '/'; }, 1500);
    }
  });
})();
</script>
"@

# ========================================
# Sign Up
# ========================================
$signUpFile = Join-Path $repoDir 'authentication-pages\sign-up.html'
$signUpScript = @"
$marker
<script>
(function() {
  var form = document.getElementById('email-form');
  if (!form) return;
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    var name = form.querySelector('[name="Name"]').value;
    var email = form.querySelector('[name="Email-Address"]').value;
    var password = form.querySelector('[name="Password"]').value;
    var submitBtn = form.querySelector('[type="submit"]');
    var successDiv = form.closest('.form-wrap').querySelector('.success-message-box');
    var errorDiv = form.closest('.form-wrap').querySelector('.error-message-box');
    submitBtn.value = 'Creando cuenta...';
    successDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    if (password.length < 6) {
      errorDiv.style.display = 'block';
      errorDiv.querySelector('div').textContent = 'La contraseña debe tener al menos 6 caracteres.';
      submitBtn.value = 'Sign Up';
      return;
    }
    var result = await window.MundoElectronica.auth.signUp(email, password, name);
    if (result.error) {
      errorDiv.style.display = 'block';
      errorDiv.querySelector('div').textContent = result.error.message;
      submitBtn.value = 'Sign Up';
    } else {
      successDiv.style.display = 'block';
      successDiv.querySelector('div').textContent = '¡Cuenta creada exitosamente! Redirigiendo...';
      form.style.display = 'none';
      setTimeout(function() { window.location.href = '/'; }, 2000);
    }
  });
})();
</script>
"@

# ========================================
# Forgot Password
# ========================================
$forgotFile = Join-Path $repoDir 'authentication-pages\forgot-password.html'
$forgotScript = @"
$marker
<script>
(function() {
  var form = document.getElementById('email-form');
  if (!form) return;
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    var email = form.querySelector('[name="Email-Address"]');
    if (!email) email = form.querySelector('[type="email"]');
    if (!email) return;
    var submitBtn = form.querySelector('[type="submit"]');
    var successDiv = form.closest('.form-wrap').querySelector('.success-message-box');
    var errorDiv = form.closest('.form-wrap').querySelector('.error-message-box');
    submitBtn.value = 'Enviando...';
    successDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    var result = await window.MundoElectronica.auth.resetPassword(email.value);
    if (result.error) {
      errorDiv.style.display = 'block';
      errorDiv.querySelector('div').textContent = result.error.message;
      submitBtn.value = 'Reset Password';
    } else {
      successDiv.style.display = 'block';
      successDiv.querySelector('div').textContent = 'Si tienes una cuenta, recibirás un email con instrucciones.';
      form.style.display = 'none';
    }
  });
})();
</script>
"@

# ========================================
# Contact Page
# ========================================
$contactFile = Join-Path $repoDir 'contact.html'
$contactScript = @"
$marker
<script>
(function() {
  // Find the contact form (it has Name, Email, Phone, Message fields)
  var forms = document.querySelectorAll('form');
  var contactForm = null;
  forms.forEach(function(f) {
    if (f.querySelector('[name="Message"]') || f.querySelector('[name="message"]') ||
        f.querySelector('textarea')) {
      contactForm = f;
    }
  });
  if (!contactForm) return;
  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    var nameEl = contactForm.querySelector('[name="Name"], [name="name"]');
    var emailEl = contactForm.querySelector('[name="Email"], [name="email"], [type="email"]');
    var phoneEl = contactForm.querySelector('[name="Phone"], [name="phone"], [type="tel"]');
    var msgEl = contactForm.querySelector('[name="Message"], [name="message"], textarea');
    var submitBtn = contactForm.querySelector('[type="submit"]');
    var successDiv = contactForm.closest('.w-form, .form-wrap')?.querySelector('.w-form-done, .success-message-box');
    var errorDiv = contactForm.closest('.w-form, .form-wrap')?.querySelector('.w-form-fail, .error-message-box');
    if (!nameEl || !emailEl || !msgEl) return;
    submitBtn.value = 'Enviando...';
    if (successDiv) successDiv.style.display = 'none';
    if (errorDiv) errorDiv.style.display = 'none';
    var result = await window.MundoElectronica.store.submitContact({
      name: nameEl.value,
      email: emailEl.value,
      phone: phoneEl ? phoneEl.value : '',
      message: msgEl.value,
    });
    if (result.error) {
      if (errorDiv) {
        errorDiv.style.display = 'block';
        var errMsg = errorDiv.querySelector('div');
        if (errMsg) errMsg.textContent = 'Error al enviar. Inténtalo de nuevo.';
      }
      submitBtn.value = 'Send Message';
    } else {
      if (successDiv) {
        successDiv.style.display = 'block';
        var succMsg = successDiv.querySelector('div');
        if (succMsg) succMsg.textContent = '¡Mensaje enviado! Te responderemos pronto.';
      }
      contactForm.style.display = 'none';
    }
  });
})();
</script>
"@

# ========================================
# Apply to files
# ========================================
$files = @(
    @{ Path = $signInFile; Script = $signInScript; Name = 'sign-in.html' },
    @{ Path = $signUpFile; Script = $signUpScript; Name = 'sign-up.html' },
    @{ Path = $forgotFile; Script = $forgotScript; Name = 'forgot-password.html' },
    @{ Path = $contactFile; Script = $contactScript; Name = 'contact.html' }
)

foreach ($entry in $files) {
    $content = [System.IO.File]::ReadAllText($entry.Path)

    if ($content.Contains($marker)) {
        Write-Host "SKIP: $($entry.Name) (already wired)" -ForegroundColor Yellow
        continue
    }

    if ($content.Contains('</body>')) {
        $content = $content.Replace('</body>', "$($entry.Script)`n</body>")
        [System.IO.File]::WriteAllText($entry.Path, $content)
        Write-Host "OK: $($entry.Name) - form handler injected" -ForegroundColor Green
    }
    else {
        Write-Host "WARN: $($entry.Name) - no </body>" -ForegroundColor Red
    }
}

Write-Host "`nDone! Auth + contact forms wired to Supabase." -ForegroundColor Cyan
