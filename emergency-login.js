(function () {
  'use strict';

  // Core 2.0 login bridge. Keep the signed auth token available to same-origin
  // production pages that may open in a separate tab/window.
  function protectLoginInput(event) {
    var target = event.target;
    if (target && (target.id === 'loginEmail' || target.id === 'loginPassword')) event.stopImmediatePropagation();
  }
  ['beforeinput', 'input', 'change', 'keydown', 'keyup'].forEach(function (type) {
    document.addEventListener(type, protectLoginInput, true);
  });

  function setStatus(message, isError) {
    var hint = document.getElementById('loginHint');
    if (!hint) return;
    hint.textContent = message;
    hint.style.color = isError ? '#b91c1c' : '#166534';
    hint.style.fontWeight = '700';
  }

  async function emergencyLogin(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    var form = document.getElementById('loginForm');
    var emailInput = document.getElementById('loginEmail');
    var passwordInput = document.getElementById('loginPassword');
    var button = form && form.querySelector('button[type="submit"]');
    var email = (emailInput && emailInput.value || '').trim();
    var password = passwordInput && passwordInput.value || '';

    if (!email || !password) { setStatus('اكتب البريد الإلكتروني وكلمة المرور', true); return; }
    if (button) { button.disabled = true; button.textContent = 'جاري التحقق...'; }
    setStatus('جاري التحقق من الحساب...', false);

    try {
      var response = await fetch('/api/auth-login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: email, password: password})
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.user || !data.token) { setStatus('البريد أو كلمة المرور غير صحيحة', true); return; }

      var user = { id:data.user.id, name:data.user.name, email:data.user.email, role:data.user.role };
      var userJson = JSON.stringify(user);
      sessionStorage.setItem('jms_current_user', userJson);
      sessionStorage.setItem('jms_auth_token', data.token);

      // Production is a separate same-origin page and may open in a new tab/PWA context.
      // Persist the signed token so production/mixing pages can authenticate correctly.
      localStorage.setItem('jms_current_user', userJson);
      localStorage.setItem('jms_auth_token', data.token);
      localStorage.setItem('jms_auth_token_saved_at', String(Date.now()));

      window.currentUser = user;
      setStatus('تم الدخول بنجاح', false);
      location.replace('/?login-session=' + Date.now());
    } catch (error) {
      setStatus('تعذر الاتصال بخدمة الدخول. حاول مرة أخرى.', true);
    } finally {
      if (button) { button.disabled = false; button.textContent = 'دخول النظام'; }
      if(passwordInput) passwordInput.value='';
    }
  }

  function install() {
    var form = document.getElementById('loginForm');
    if (!form || form.dataset.emergencyLogin === '1') return;
    form.dataset.emergencyLogin = '1';
    form.addEventListener('submit', emergencyLogin, true);
    setStatus('خدمة الدخول جاهزة', false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();