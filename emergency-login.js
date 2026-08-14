(function () {
  'use strict';

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

    if (!email || !password) {
      setStatus('اكتب البريد الإلكتروني وكلمة المرور', true);
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'جاري التحقق...';
    }
    setStatus('جاري التحقق من الحساب...', false);

    try {
      var response = await fetch('/api/auth-login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: email, password: password})
      });
      var data = await response.json().catch(function () { return {}; });

      if (!response.ok || !data.user) {
        setStatus('البريد أو كلمة المرور غير صحيحة', true);
        return;
      }

      var user = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role
      };
      sessionStorage.setItem('jms_current_user', JSON.stringify(user));
      if (data.token) sessionStorage.setItem('jms_auth_token', data.token);
      window.currentUser = user;
      setStatus('تم الدخول بنجاح', false);

      // Reload so app.js initializes its private currentUser state from sessionStorage.
      // Calling showApp directly here uses the old in-memory null user and immediately logs out.
      location.replace('/?login-session=' + Date.now());
    } catch (error) {
      setStatus('تعذر الاتصال بخدمة الدخول. حاول مرة أخرى.', true);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'دخول النظام';
      }
    }
  }

  function install() {
    var form = document.getElementById('loginForm');
    if (!form || form.dataset.emergencyLogin === '1') return;
    form.dataset.emergencyLogin = '1';
    form.addEventListener('submit', emergencyLogin, true);
    setStatus('خدمة الدخول جاهزة', false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();