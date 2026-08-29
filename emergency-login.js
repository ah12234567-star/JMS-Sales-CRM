(function () {
  'use strict';

  // Core 2.0 secure login bridge. Auth tokens live in sessionStorage only.
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

  function clearLegacyPersistentTokens(){
    try{
      localStorage.removeItem('jms_auth_token');
      localStorage.removeItem('jms_auth_token_saved_at');
    }catch(_){ }
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
      sessionStorage.setItem('jms_current_user', JSON.stringify(user));
      sessionStorage.setItem('jms_auth_token', data.token);
      // Keep only non-secret display identity persistent for legacy UI compatibility.
      localStorage.setItem('jms_current_user', JSON.stringify(user));
      clearLegacyPersistentTokens();
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
    clearLegacyPersistentTokens();
    var form = document.getElementById('loginForm');
    if (!form || form.dataset.emergencyLogin === '1') return;
    form.dataset.emergencyLogin = '1';
    form.addEventListener('submit', emergencyLogin, true);
    setStatus('خدمة الدخول الآمن جاهزة', false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();