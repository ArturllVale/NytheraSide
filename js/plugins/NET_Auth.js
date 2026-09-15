/*:
 * @target MZ
 * @plugindesc Interface Visual de Login, Registro, Criação e Seleção de Heróis
 * @author Antigravity & Arthur Vale
 *
 * @param apiHost
 * @text URL da API
 * @desc Endereço base do servidor Fastify
 * @default http://localhost:3000
 *
 * @help
 * Este plugin substitui a tela de título padrão do RPG Maker por um ecossistema
 * completo de Autenticação, Criação de Personagens e Seleção de Heróis:
 * 
 * Recursos:
 * - Modal moderno de Login e Registro com comunicação em tempo real
 * - Criação de Herói em 3 Etapas:
 *     1. Escolha de Classe (com ícones e descrição da vocação)
 *     2. Escolha de Aparência (Canvas com brilho e botão de rotação 4-direcional)
 *     3. Nome do Herói e Confirmação
 * - Tela de Seleção de Heróis com 4 slots, painel de detalhes, botão de entrar e exclusão
 * - Design System exclusivo do NytheraSide (Dark Glassmorphism com acentos dourados)
 * - Isolamento de teclado para evitar conflitos com comandos do jogo
 */

window.NET = window.NET || {};

(function() {
  'use strict';

  var pluginParams = PluginManager.parameters('NET_Auth') || {};
  var API_HOST = pluginParams.apiHost || 'http://localhost:3000';
  NET.apiHost = API_HOST;

  // Desabilitar save/load padrão local (o servidor gerencia o progresso)
  DataManager.isAnySavefileExists = function() { return false; };
  DataManager.loadGame = function() { return Promise.reject(new Error("Local save/load disabled")); };
  DataManager.saveGame = function() { return Promise.resolve(false); };
  
  // Desabilitar autosave nativo do RPG Maker MZ para evitar conflitos
  Scene_Base.prototype.isAutosaveEnabled = function() { return false; };
  Scene_Base.prototype.executeAutosave = function() {};
  
  Window_MenuCommand.prototype.isSaveEnabled = function() {
    return false;
  };

  // Oculta a janela de comandos padrão da Scene_Title para manter a tela limpa
  Scene_Title.prototype.createCommandWindow = function() {
    const rect = this.commandWindowRect();
    this._commandWindow = new Window_TitleCommand(rect);
    this._commandWindow.setHandler('newGame',  this.commandNewGame.bind(this));
    this._commandWindow.setHandler('continue', this.commandContinue.bind(this));
    this._commandWindow.setHandler('options',  this.commandOptions.bind(this));
  };

  // Gancho na inicialização da Scene_Title
  var _Scene_Title_start = Scene_Title.prototype.start;
  Scene_Title.prototype.start = function() {
    _Scene_Title_start.call(this);
    this.createAuthOverlay();
  };

  // Destrói overlay se a cena for terminada
  var _Scene_Title_terminate = Scene_Title.prototype.terminate;
  Scene_Title.prototype.terminate = function() {
    _Scene_Title_terminate.call(this);
    NET.AuthUI.destroy();
  };

  Scene_Title.prototype.createAuthOverlay = function() {
    NET.AuthUI.init(this);
  };

  // Helper para injetar todos os estilos compartilhados do NytheraSide
  function injectNytheraGlobalStyles() {
    if (document.getElementById('nythera-theme-styles')) return;

    var style = document.createElement('style');
    style.id = 'nythera-theme-styles';
    style.innerHTML = `
      @keyframes nytheraFadeIn {
        from { opacity: 0; transform: scale(0.98); }
        to { opacity: 1; transform: scale(1); }
      }

      @keyframes nytheraSpin {
        to { transform: rotate(360deg); }
      }

      /* Base Containers */
      .nythera-fullscreen-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        pointer-events: auto;
        background: radial-gradient(circle at center, rgba(10, 15, 25, 0.7) 0%, rgba(5, 8, 15, 0.95) 100%);
        color: #f3f4f6;
        user-select: none;
        box-sizing: border-box;
        animation: nytheraFadeIn 0.25s ease-out;
      }

      /* Titles & Typography */
      .nythera-main-title {
        font-size: 26px;
        font-weight: 700;
        letter-spacing: 2.5px;
        text-transform: uppercase;
        color: #f7d27e;
        text-shadow: 0 2px 12px rgba(247, 210, 126, 0.45);
        margin: 0 0 6px 0;
        text-align: center;
      }

      .nythera-subtitle-text {
        font-size: 13px;
        color: #94a3b8;
        letter-spacing: 0.6px;
        margin: 0 0 24px 0;
        text-align: center;
      }

      /* Inputs */
      .nythera-input {
        width: 100%;
        padding: 12px 14px;
        background: rgba(8, 12, 22, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        color: #f8fafc;
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
        transition: all 0.2s ease;
      }

      .nythera-input:focus {
        border-color: #f7d27e;
        box-shadow: 0 0 0 2px rgba(247, 210, 126, 0.25);
        background: rgba(12, 17, 30, 0.92);
      }

      /* Primary Gradient Buttons */
      .nythera-btn-primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 24px;
        background: linear-gradient(135deg, #d4a03e 0%, #f7d27e 100%);
        border: none;
        border-radius: 6px;
        color: #121824;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 14px rgba(212, 160, 62, 0.35);
      }

      .nythera-btn-primary:hover:not(:disabled) {
        background: linear-gradient(135deg, #e5b04c 0%, #ffdf8f 100%);
        box-shadow: 0 6px 20px rgba(247, 210, 126, 0.5);
        transform: translateY(-1px);
      }

      .nythera-btn-primary:active:not(:disabled) {
        transform: translateY(0);
      }

      .nythera-btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        filter: grayscale(40%);
      }

      /* Secondary Outline Buttons */
      .nythera-btn-secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 22px;
        background: transparent;
        border: 1px solid rgba(229, 184, 92, 0.4);
        border-radius: 6px;
        color: #cbd5e1;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .nythera-btn-secondary:hover {
        border-color: #f7d27e;
        color: #f8fafc;
        background: rgba(229, 184, 92, 0.1);
        transform: translateY(-1px);
      }

      /* Danger Buttons */
      .nythera-btn-danger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 9px 18px;
        background: transparent;
        border: 1px solid rgba(239, 68, 68, 0.45);
        border-radius: 6px;
        color: #fca5a5;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .nythera-btn-danger:hover {
        background: rgba(239, 68, 68, 0.15);
        border-color: #ef4444;
        color: #fee2e2;
      }

      /* Rotation Button ↻ */
      .nythera-rot-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 30px;
        height: 30px;
        line-height: 28px;
        text-align: center;
        background: rgba(16, 22, 36, 0.85);
        border: 1px solid rgba(229, 184, 92, 0.5);
        border-radius: 50%;
        color: #f7d27e;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        z-index: 10;
      }

      .nythera-rot-btn:hover {
        background: rgba(247, 210, 126, 0.25);
        color: #ffffff;
        border-color: #f7d27e;
        transform: rotate(35deg) scale(1.08);
      }

      /* Interactive Cards */
      .nythera-card {
        background: rgba(16, 22, 36, 0.9);
        border: 1px solid rgba(229, 184, 92, 0.25);
        border-radius: 8px;
        transition: all 0.2s ease;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      }

      .nythera-card:hover {
        border-color: #f7d27e;
        background: rgba(229, 184, 92, 0.12);
        box-shadow: 0 10px 28px rgba(247, 210, 126, 0.25);
        transform: translateY(-3px);
      }

      /* Alert Messages */
      .nythera-alert {
        padding: 10px 14px;
        border-radius: 6px;
        font-size: 13px;
        margin-bottom: 16px;
        display: none;
        line-height: 1.4;
        animation: nytheraFadeIn 0.2s ease;
      }

      .nythera-alert.error {
        display: block;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }

      .nythera-alert.success {
        display: block;
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: #86efac;
      }

      .nythera-alert.info {
        display: block;
        background: rgba(56, 189, 248, 0.15);
        border: 1px solid rgba(56, 189, 248, 0.4);
        color: #7dd3fc;
      }

      /* Spinner */
      .nythera-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(18, 24, 36, 0.3);
        border-radius: 50%;
        border-top-color: #121824;
        animation: nytheraSpin 0.7s linear infinite;
        vertical-align: middle;
        margin-right: 8px;
      }
    `;
    document.head.appendChild(style);
  }

  // -------------------------------------------------------------------------
  // Renderizador de Sprite no Canvas com Aura Dourada e Sombra
  // -------------------------------------------------------------------------
  NET.drawHeroCanvas = function(canvas, characterName, characterIndex, dir) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const charName = characterName || 'Actor1';
    const charIdx = (characterIndex !== undefined && characterIndex !== null) ? Number(characterIndex) : 0;
    const direction = (dir !== undefined && dir !== null) ? Number(dir) : 0; // 0: Down, 1: Left, 2: Right, 3: Up

    const img = new Image();
    img.src = `img/characters/${charName}.png`;

    const render = function() {
      ctx.clearRect(0, 0, w, h);

      // 1. Aura Radial Dourada (identidade visual do NytheraSide)
      const cx = w / 2;
      const cy = h * 0.62;
      const auraGrd = ctx.createRadialGradient(cx, cy, 6, cx, cy, w * 0.45);
      auraGrd.addColorStop(0, 'rgba(247, 210, 126, 0.38)');
      auraGrd.addColorStop(0.45, 'rgba(212, 160, 62, 0.12)');
      auraGrd.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrd;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4, w * 0.42, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Sombra Elíptica sob os pés
      const shadowGrd = ctx.createRadialGradient(cx, cy + 22, 2, cx, cy + 22, 28);
      shadowGrd.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
      shadowGrd.addColorStop(0.7, 'rgba(0, 0, 0, 0.35)');
      shadowGrd.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGrd;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 22, 28, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. Recorte e renderização do Sprite MZ
      if (img.complete && img.naturalWidth > 0) {
        // Folhas padrão do RPG Maker MZ: 4 colunas x 2 linhas de personagens (8 heróis por folha)
        // Cada herói possui 3 frames de caminhada x 4 direções
        const charsPerRow = 4;
        const charW = img.naturalWidth / (charsPerRow * 3);
        const charH = img.naturalHeight / (2 * 4);

        const col = charIdx % charsPerRow;
        const row = Math.floor(charIdx / charsPerRow);

        // Frame central de repouso = coluna 1 (índice 1 de 0, 1, 2)
        const frameX = (col * 3 + 1) * charW;
        const frameY = (row * 4 + direction) * charH;

        ctx.imageSmoothingEnabled = false;
        const maxDrawSize = Math.min(w * 0.85, h * 0.75);
        const scale = Math.min(maxDrawSize / charW, maxDrawSize / charH);
        const dw = charW * scale;
        const dh = charH * scale;

        ctx.drawImage(img, frameX, frameY, charW, charH, (w - dw) / 2, cy + 18 - dh, dw, dh);
      } else {
        // Silhueta decorativa de carregamento
        ctx.fillStyle = 'rgba(247, 210, 126, 0.2)';
        ctx.fillRect(w / 2 - 18, h / 2 - 25, 36, 50);
      }
    };

    img.onload = render;
    if (img.complete) render();
  };


  // -------------------------------------------------------------------------
  // Módulo AuthUI: Modal de Login e Registro
  // -------------------------------------------------------------------------
  NET.AuthUI = {
    _container: null,
    _scene: null,
    _currentTab: 'login',
    _pendingMessage: null,

    init: function(scene) {
      this._scene = scene;
      this.destroy();
      injectNytheraGlobalStyles();
      this.buildDOM();
      this.bindEvents();
      this.loadSavedPreferences();
      if (this._pendingMessage) {
        this.showMessage(this._pendingMessage.type, this._pendingMessage.text);
        this._pendingMessage = null;
      }
      if (window.Input && Input.clear) Input.clear();
    },

    destroy: function() {
      if (this._container && this._container.parentNode) {
        this._container.parentNode.removeChild(this._container);
      }
      this._container = null;
    },

    buildDOM: function() {
      var wrapper = document.createElement('div');
      wrapper.id = 'nythera-auth-wrapper';
      wrapper.className = 'nythera-fullscreen-overlay';

      wrapper.innerHTML = `
        <div id="nythera-auth-modal" style="
          width: 440px;
          max-width: 92vw;
          background: rgba(16, 22, 36, 0.94);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(229, 184, 92, 0.35);
          border-radius: 12px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(229, 184, 92, 0.15);
          color: #f3f4f6;
          padding: 28px 32px 24px;
          box-sizing: border-box;
        ">
          <div style="text-align: center; margin-bottom: 22px;">
            <h1 class="nythera-main-title">Nythera Online</h1>
            <p class="nythera-subtitle-text" style="margin-bottom: 0;">Identifique-se para entrar nas Crônicas</p>
          </div>

          <div style="display: flex; border-bottom: 1px solid rgba(255, 255, 255, 0.12); margin-bottom: 20px;">
            <button id="nythera-tab-login" class="nythera-tab-btn active" type="button" style="
              flex: 1; padding: 10px 0; background: transparent; border: none; color: #f7d27e; font-size: 14px; font-weight: 600; cursor: pointer; border-bottom: 2px solid #f7d27e;
            ">Entrar</button>
            <button id="nythera-tab-register" class="nythera-tab-btn" type="button" style="
              flex: 1; padding: 10px 0; background: transparent; border: none; color: #94a3b8; font-size: 14px; font-weight: 600; cursor: pointer;
            ">Criar Conta</button>
          </div>

          <div id="nythera-alert-box" class="nythera-alert"></div>

          <!-- FORMULÁRIO DE LOGIN -->
          <form id="nythera-login-form" autocomplete="on">
            <div style="margin-bottom: 15px;">
              <label style="display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; text-transform: uppercase;">E-mail</label>
              <input id="nythera-login-email" class="nythera-input" type="email" placeholder="seu@email.com" required autocomplete="email">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; text-transform: uppercase;">Senha</label>
              <input id="nythera-login-password" class="nythera-input" type="password" placeholder="••••••••" required autocomplete="current-password">
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #94a3b8; margin-bottom: 18px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input id="nythera-remember-me" type="checkbox" checked style="margin-right: 8px; cursor: pointer; accent-color: #f7d27e;">
                Lembrar minha conta
              </label>
            </div>
            <button id="nythera-btn-submit-login" class="nythera-btn-primary" type="submit" style="width: 100%;">
              Entrar no Reino
            </button>
            <button id="nythera-btn-goto-reg" class="nythera-btn-secondary" type="button" style="width: 100%; margin-top: 10px; font-weight: 700; color: #f7d27e;">
              ✨ Ainda não tem conta? Criar Conta
            </button>
            <button id="nythera-btn-offline" class="nythera-btn-secondary" type="button" style="width: 100%; margin-top: 10px; border-style: dashed; font-size: 12px;">
              ⚔️ Modo Offline / Teste Local
            </button>
          </form>

          <!-- FORMULÁRIO DE REGISTRO -->
          <form id="nythera-register-form" style="display: none;" autocomplete="off">
            <div style="margin-bottom: 15px;">
              <label style="display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; text-transform: uppercase;">E-mail</label>
              <input id="nythera-reg-email" class="nythera-input" type="email" placeholder="seu@email.com" required>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; text-transform: uppercase;">Senha</label>
              <input id="nythera-reg-password" class="nythera-input" type="password" placeholder="Mínimo 8 caracteres" minlength="8" required>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; text-transform: uppercase;">Repetir Senha</label>
              <input id="nythera-reg-password-confirm" class="nythera-input" type="password" placeholder="Confirme a senha" minlength="8" required>
            </div>
            <button id="nythera-btn-submit-reg" class="nythera-btn-primary" type="submit" style="width: 100%;">
              Criar Conta
            </button>
          </form>
        </div>
      `;

      document.body.appendChild(wrapper);
      this._container = wrapper;
    },

    bindEvents: function() {
      var self = this;
      var tabLogin = document.getElementById('nythera-tab-login');
      var tabRegister = document.getElementById('nythera-tab-register');
      var formLogin = document.getElementById('nythera-login-form');
      var formRegister = document.getElementById('nythera-register-form');
      var btnOffline = document.getElementById('nythera-btn-offline');
      var btnGotoReg = document.getElementById('nythera-btn-goto-reg');

      tabLogin.addEventListener('click', function() { self.switchTab('login'); });
      tabRegister.addEventListener('click', function() { self.switchTab('register'); });
      if (btnGotoReg) {
        btnGotoReg.addEventListener('click', function() { self.switchTab('register'); });
      }

      btnOffline.addEventListener('click', function() {
        self.showMessage('info', 'Iniciando jogo em modo offline...');
        setTimeout(function() {
          self.finishAndStartGame();
        }, 300);
      });

      formLogin.addEventListener('submit', function(e) {
        e.preventDefault();
        self.handleLogin();
      });

      formRegister.addEventListener('submit', function(e) {
        e.preventDefault();
        self.handleRegister();
      });

      // Isolamento de teclado
      var inputs = this._container.querySelectorAll('input');
      inputs.forEach(function(input) {
        input.addEventListener('keydown', function(e) { e.stopPropagation(); });
        input.addEventListener('keyup', function(e) { e.stopPropagation(); });
        input.addEventListener('keypress', function(e) { e.stopPropagation(); });
      });
    },

    switchTab: function(tabName) {
      this._currentTab = tabName;
      this.clearMessage();

      var tabLogin = document.getElementById('nythera-tab-login');
      var tabRegister = document.getElementById('nythera-tab-register');
      var formLogin = document.getElementById('nythera-login-form');
      var formRegister = document.getElementById('nythera-register-form');

      if (tabName === 'login') {
        if (tabLogin) {
          tabLogin.style.color = '#f7d27e';
          tabLogin.style.borderBottom = '2px solid #f7d27e';
        }
        if (tabRegister) {
          tabRegister.style.color = '#94a3b8';
          tabRegister.style.borderBottom = 'none';
        }
        if (formLogin) formLogin.style.display = 'block';
        if (formRegister) formRegister.style.display = 'none';
        var loginEmail = document.getElementById('nythera-login-email');
        if (loginEmail) loginEmail.focus();
      } else {
        if (tabRegister) {
          tabRegister.style.color = '#f7d27e';
          tabRegister.style.borderBottom = '2px solid #f7d27e';
        }
        if (tabLogin) {
          tabLogin.style.color = '#94a3b8';
          tabLogin.style.borderBottom = 'none';
        }
        if (formLogin) formLogin.style.display = 'none';
        if (formRegister) formRegister.style.display = 'block';
        var regEmail = document.getElementById('nythera-reg-email');
        if (regEmail) regEmail.focus();
      }
    },

    showMessage: function(type, text) {
      var box = document.getElementById('nythera-alert-box');
      if (!box) return;
      box.className = 'nythera-alert ' + type;
      box.textContent = text;
    },

    clearMessage: function() {
      var box = document.getElementById('nythera-alert-box');
      if (!box) return;
      box.className = 'nythera-alert';
      box.textContent = '';
      box.style.display = 'none';
    },

    setLoading: function(btnId, isLoading, defaultText) {
      var btn = document.getElementById(btnId);
      if (!btn) return;
      if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = '<span class="nythera-spinner"></span> Conectando...';
      } else {
        btn.disabled = false;
        btn.innerHTML = defaultText;
      }
    },

    loadSavedPreferences: function() {
      try {
        var savedEmail = localStorage.getItem('nythera_saved_email');
        if (savedEmail) {
          var emailInput = document.getElementById('nythera-login-email');
          if (emailInput) {
            emailInput.value = savedEmail;
            var passInput = document.getElementById('nythera-login-password');
            if (passInput) passInput.focus();
          }
        }
      } catch (e) {
        console.warn('[NET_Auth] Storage indisponível:', e);
      }
    },

    savePreferences: function(email, token) {
      try {
        var remember = document.getElementById('nythera-remember-me');
        if (remember && remember.checked) {
          localStorage.setItem('nythera_saved_email', email);
          if (token) localStorage.setItem('nythera_auth_token', token);
        } else {
          localStorage.removeItem('nythera_auth_token');
        }
      } catch (e) {
        console.warn('[NET_Auth] Falha ao salvar preferências:', e);
      }
    },

    handleLogin: function() {
      var self = this;
      var email = document.getElementById('nythera-login-email').value.trim();
      var password = document.getElementById('nythera-login-password').value;

      if (!email || !password) {
        this.showMessage('error', 'Por favor, preencha o e-mail e a senha.');
        return;
      }

      this.clearMessage();
      this.setLoading('nythera-btn-submit-login', true, 'Entrar no Reino');

      fetch(API_HOST + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      })
      .then(function(res) {
        return res.json().then(function(json) {
          return { status: res.status, data: json };
        });
      })
      .then(function(result) {
        if (result.status === 200 && result.data.success) {
          var token = result.data.data.token;
          self.savePreferences(email, token);
          self.showMessage('info', 'Autenticado! Carregando heróis...');

          fetch(API_HOST + '/characters', {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token }
          })
          .then(function(cRes) { return cRes.json(); })
          .then(function(cJson) {
            var chars = (cJson && cJson.data) || [];
            window.$nytheraCharacters = chars;
            if (window.NET && NET.setUserInfo) {
              NET.setUserInfo(result.data.data.user, cJson);
            }
            self.destroy();
            if (chars.length > 0) {
              SceneManager.goto(Scene_NytheraCharSelect);
            } else {
              SceneManager.goto(Scene_NytheraCharCreate);
            }
          })
          .catch(function(err) {
            console.warn('[NET_Auth] Erro ao carregar personagens:', err);
            self.destroy();
            SceneManager.goto(Scene_NytheraCharCreate);
          });
        } else {
          self.setLoading('nythera-btn-submit-login', false, 'Entrar no Reino');
          var errorMsg = (result.data && result.data.error) || 'E-mail ou senha incorretos.';
          if (errorMsg === 'Invalid credentials' || errorMsg.indexOf('não encontrado') !== -1 || errorMsg.indexOf('não cadastrado') !== -1) {
            errorMsg = 'Usuário não cadastrado. Se ainda não possui uma conta, crie agora:';
            self.showMessage('error', errorMsg);
            var alertBox = document.getElementById('nythera-alert-box');
            if (alertBox) {
              var qBtn = document.createElement('button');
              qBtn.type = 'button';
              qBtn.innerText = 'CRIAR CONTA COM ESTE E-MAIL';
              Object.assign(qBtn.style, {
                display: 'block',
                margin: '10px auto 0',
                padding: '7px 16px',
                background: '#f7d27e',
                color: '#121824',
                border: 'none',
                borderRadius: '5px',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
              });
              qBtn.onclick = function() {
                self.switchTab('register');
                var regEmail = document.getElementById('nythera-reg-email');
                var regPass = document.getElementById('nythera-reg-password');
                var regPassConf = document.getElementById('nythera-reg-password-confirm');
                if (regEmail) regEmail.value = email;
                if (regPass) regPass.value = password;
                if (regPassConf) regPassConf.value = password;
              };
              alertBox.appendChild(qBtn);
            }
          } else {
            self.showMessage('error', errorMsg);
          }
        }
      })
      .catch(function(err) {
        self.setLoading('nythera-btn-submit-login', false, 'Entrar no Reino');
        console.error('[NET_Auth] Erro ao conectar:', err);
        self.showMessage('error', 'Não foi possível conectar ao servidor (' + API_HOST + '). Verifique se o backend está ativo.');
      });
    },

    handleRegister: function() {
      var self = this;
      var email = document.getElementById('nythera-reg-email').value.trim();
      var password = document.getElementById('nythera-reg-password').value;
      var confirmPassword = document.getElementById('nythera-reg-password-confirm').value;

      if (!email || !password || !confirmPassword) {
        this.showMessage('error', 'Por favor, preencha todos os campos.');
        return;
      }

      if (password.length < 8) {
        this.showMessage('error', 'A senha deve conter no mínimo 8 caracteres.');
        return;
      }

      if (password !== confirmPassword) {
        this.showMessage('error', 'As senhas digitadas não coincidem.');
        return;
      }

      this.clearMessage();
      this.setLoading('nythera-btn-submit-reg', true, 'Criar Conta');

      fetch(API_HOST + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      })
      .then(function(res) {
        return res.json().then(function(json) {
          return { status: res.status, data: json };
        });
      })
      .then(function(result) {
        if (result.status === 201 && result.data.success) {
          self.showMessage('info', 'Conta criada! Realizando login inicial...');
          return fetch(API_HOST + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
          })
          .then(function(res) { return res.json(); })
          .then(function(loginRes) {
            if (loginRes.success) {
              var token = loginRes.data.token;
              self.savePreferences(email, token);
              window.$nytheraCharacters = [];
              if (window.NET && NET.setUserInfo) {
                NET.setUserInfo(loginRes.data.user);
              }
              self.destroy();
              SceneManager.goto(Scene_NytheraCharCreate);
            } else {
              throw new Error('Falha ao autenticar após o registro.');
            }
          });
        } else {
          var errorMsg = (result.data && result.data.error) || 'Erro ao registrar usuário.';
          if (result.status === 409) errorMsg = 'Este e-mail já está cadastrado.';
          throw new Error(errorMsg);
        }
      })
      .catch(function(err) {
        self.setLoading('nythera-btn-submit-reg', false, 'Criar Conta');
        console.error('[NET_Auth] Erro no registro:', err);
        self.showMessage('error', err.message || 'Falha ao comunicar com o servidor.');
      });
    },

    finishAndStartGame: function(characterData) {
      this.destroy();
      DataManager.setupNewGame();
      var char = characterData || (window.NET && NET.Client && NET.Client.character);
      if (char && char.mapId) {
        $gamePlayer.reserveTransfer(char.mapId, char.x, char.y, char.direction || 2, 0);
        $gamePlayer.setTransparent(false);
      }
      SceneManager.goto(Scene_Map);
    }
  };


  // -------------------------------------------------------------------------
  // Scene_NytheraCharCreate: Criação de Personagem em 3 Etapas
  // 1. Escolha de Classe -> 2. Escolha de Herói (com ↻) -> 3. Nome do Herói
  // -------------------------------------------------------------------------
  function Scene_NytheraCharCreate() {
    this.initialize.apply(this, arguments);
  }
  Scene_NytheraCharCreate.prototype = Object.create(Scene_Base.prototype);
  Scene_NytheraCharCreate.prototype.constructor = Scene_NytheraCharCreate;

  Scene_NytheraCharCreate.prototype.initialize = function() {
    Scene_Base.prototype.initialize.call(this);
    this._mzData = null;
    this._selectedClass = null;
    this._selectedActor = null;
    this._overlay = null;
    this._stopKeyProp = function(e) { e.stopPropagation(); };
  };

  Scene_NytheraCharCreate.prototype.create = function() {
    Scene_Base.prototype.create.call(this);
    this.createBackground();
  };

  Scene_NytheraCharCreate.prototype.createBackground = function() {
    this._bgSprite = new Sprite();
    this._bgSprite.bitmap = new Bitmap(Graphics.width, Graphics.height);
    this._bgSprite.bitmap.fillAll('#070b14');
    this.addChild(this._bgSprite);
  };

  Scene_NytheraCharCreate.prototype.start = function() {
    Scene_Base.prototype.start.call(this);
    injectNytheraGlobalStyles();
    this._buildOverlay();
    this._loadMzData();
  };

  Scene_NytheraCharCreate.prototype._buildOverlay = function() {
    this._overlay = document.createElement('div');
    this._overlay.id = 'nythera-charcreate-overlay';
    this._overlay.className = 'nythera-fullscreen-overlay';
    this._overlay.innerHTML = '<div style="color:#f7d27e; font-size:18px;"><span class="nythera-spinner" style="border-top-color:#f7d27e;"></span> Conectando aos registros do reino...</div>';
    document.body.appendChild(this._overlay);
  };

  Scene_NytheraCharCreate.prototype._loadMzData = function() {
    var self = this;
    fetch(API_HOST + '/game/mzdata')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        self._mzData = data;
        self._showClassSelect();
      })
      .catch(function(err) {
        console.error('[CharCreate] Erro ao buscar mzdata:', err);
        if (self._overlay) {
          self._overlay.innerHTML = `
            <div style="text-align:center; max-width:400px;">
              <h2 style="color:#fca5a5; margin-bottom:12px;">Falha ao carregar dados</h2>
              <p style="color:#94a3b8; font-size:14px; margin-bottom:20px;">Não foi possível obter as classes do servidor.</p>
              <button class="nythera-btn-secondary" onclick="SceneManager.goto(Scene_Title)">Voltar ao Menu</button>
            </div>
          `;
        }
      });
  };

  Scene_NytheraCharCreate.prototype._clearOverlay = function() {
    if (this._overlay) {
      this._overlay.innerHTML = '';
    }
  };

  // ── Etapa 1: Seleção de Classe ───────────────────────────────────────────
  Scene_NytheraCharCreate.prototype._showClassSelect = function() {
    var self = this;
    this._clearOverlay();
    var classes = (this._mzData && this._mzData.classes) || [];

    var headerBox = document.createElement('div');
    headerBox.innerHTML = `
      <h1 class="nythera-main-title">Escolha Sua Classe</h1>
      <p class="nythera-subtitle-text">Selecione a vocação que guiará o caminho de suas lendas</p>
    `;
    this._overlay.appendChild(headerBox);

    var grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '20px',
      justifyContent: 'center',
      maxWidth: '960px',
      padding: '0 20px',
      boxSizing: 'border-box'
    });

    // Mapeamento de ícones temáticos para as vocações
    var iconMap = {
      'Swordsman': '⚔️', 'Espadachim': '⚔️',
      'Sorcerer': '🔮', 'Mago': '🔮',
      'Priest': '✨', 'Sacerdote': '✨',
      'Knight': '🛡️', 'Cavaleiro': '🛡️',
      'Martial Artist': '🥋', 'Artista Marcial': '🥋',
      'Magic Swordsman': '🗡️', 'Espadachim Mágico': '🗡️',
      'Hunter': '🏹', 'Arqueiro': '🏹',
      'Bandit': '👤', 'Arruaceiro': '👤'
    };

    classes.forEach(function(cls) {
      var card = document.createElement('div');
      card.className = 'nythera-card';
      Object.assign(card.style, {
        width: '160px',
        padding: '24px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        boxSizing: 'border-box'
      });

      var icon = iconMap[cls.name] || '⚔️';
      card.innerHTML = `
        <div style="font-size: 38px; margin-bottom: 12px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));">${icon}</div>
        <div style="font-size: 16px; font-weight: 700; color: #f7d27e; letter-spacing: 0.5px;">${cls.name}</div>
      `;

      card.onclick = function() {
        self._selectedClass = cls;
        self._showHeroSelect();
      };

      grid.appendChild(card);
    });

    this._overlay.appendChild(grid);

    var backBtn = document.createElement('button');
    backBtn.className = 'nythera-btn-secondary';
    backBtn.style.marginTop = '28px';
    backBtn.innerText = '← Voltar';
    backBtn.onclick = function() {
      if (window.$nytheraCharacters && window.$nytheraCharacters.length > 0) {
        self.terminate();
        SceneManager.goto(Scene_NytheraCharSelect);
      } else {
        self.terminate();
        SceneManager.goto(Scene_Title);
      }
    };
    this._overlay.appendChild(backBtn);
  };

  // ── Etapa 2: Seleção de Herói / Aparência ─────────────────────────────────
  Scene_NytheraCharCreate.prototype._showHeroSelect = function() {
    var self = this;
    this._clearOverlay();
    var allActors = (this._mzData && this._mzData.actors) || [];
    var actors = allActors.filter(function(a) {
      return a.classId === self._selectedClass.id;
    });

    var headerBox = document.createElement('div');
    headerBox.innerHTML = `
      <h1 class="nythera-main-title">${self._selectedClass.name}</h1>
      <p class="nythera-subtitle-text">Escolha a aparência que representará seu herói</p>
    `;
    this._overlay.appendChild(headerBox);

    var grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '24px',
      justifyContent: 'center',
      maxWidth: '960px',
      padding: '0 20px',
      boxSizing: 'border-box'
    });

    if (actors.length === 0) {
      var emptyMsg = document.createElement('div');
      emptyMsg.style.color = '#94a3b8';
      emptyMsg.style.fontSize = '14px';
      emptyMsg.innerText = 'Nenhum herói disponível para esta classe ainda.';
      grid.appendChild(emptyMsg);
    }

    actors.forEach(function(actor, idx) {
      actor._viewDir = actor._viewDir || 0; // 0=Baixo, 1=Esquerda, 2=Direita, 3=Cima

      var card = document.createElement('div');
      card.className = 'nythera-card';
      Object.assign(card.style, {
        width: '170px',
        padding: '20px 14px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        position: 'relative',
        boxSizing: 'border-box'
      });

      // Canvas com Sprite
      var canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 128;
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto 12px';
      canvas.style.imageRendering = 'pixelated';
      card.appendChild(canvas);

      NET.drawHeroCanvas(canvas, actor.characterName, actor.characterIndex, actor._viewDir);

      // Botão de Rotação ↻
      var rotBtn = document.createElement('button');
      rotBtn.className = 'nythera-rot-btn';
      rotBtn.type = 'button';
      rotBtn.innerText = '↻';
      rotBtn.title = 'Girar personagem';
      rotBtn.onclick = function(e) {
        e.stopPropagation();
        var order = [0, 2, 3, 1]; // Baixo -> Direita -> Cima -> Esquerda
        var currIdx = order.indexOf(actor._viewDir || 0);
        actor._viewDir = order[(currIdx + 1) % 4];
        NET.drawHeroCanvas(canvas, actor.characterName, actor.characterIndex, actor._viewDir);
      };
      card.appendChild(rotBtn);

      var visualLabel = document.createElement('div');
      visualLabel.innerText = 'Visual ' + (idx + 1);
      Object.assign(visualLabel.style, {
        fontSize: '14px',
        fontWeight: '600',
        color: '#cbd5e1',
        marginTop: '6px'
      });
      card.appendChild(visualLabel);

      if (actor.profile) {
        var profileLabel = document.createElement('div');
        profileLabel.innerText = actor.profile;
        Object.assign(profileLabel.style, {
          fontSize: '11px',
          color: '#94a3b8',
          marginTop: '6px',
          lineHeight: '1.3'
        });
        card.appendChild(profileLabel);
      }

      card.onclick = function() {
        self._selectedActor = actor;
        self._showNameInput();
      };

      grid.appendChild(card);
    });

    this._overlay.appendChild(grid);

    var backBtn = document.createElement('button');
    backBtn.className = 'nythera-btn-secondary';
    backBtn.style.marginTop = '28px';
    backBtn.innerText = '← Voltar às Classes';
    backBtn.onclick = function() {
      self._showClassSelect();
    };
    this._overlay.appendChild(backBtn);
  };

  // ── Etapa 3: Nome do Herói e Envio ───────────────────────────────────────
  Scene_NytheraCharCreate.prototype._showNameInput = function() {
    var self = this;
    this._clearOverlay();
    var actor = this._selectedActor;
    actor._viewDir = actor._viewDir || 0;

    var headerBox = document.createElement('div');
    headerBox.innerHTML = `
      <h1 class="nythera-main-title">Batismo do Herói</h1>
      <p class="nythera-subtitle-text">Dê um nome ao seu campeão para ingressar em Nythera</p>
    `;
    this._overlay.appendChild(headerBox);

    var modal = document.createElement('div');
    Object.assign(modal.style, {
      width: '420px',
      maxWidth: '92vw',
      background: 'rgba(16, 22, 36, 0.94)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(229, 184, 92, 0.35)',
      borderRadius: '12px',
      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(229, 184, 92, 0.15)',
      padding: '24px 28px',
      boxSizing: 'border-box',
      textAlign: 'center'
    });

    // Preview Canvas com Rotação
    var canvasWrap = document.createElement('div');
    Object.assign(canvasWrap.style, {
      position: 'relative',
      margin: '0 auto 16px',
      width: '128px',
      height: '160px'
    });

    var canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 160;
    canvas.style.display = 'block';
    canvas.style.imageRendering = 'pixelated';
    canvasWrap.appendChild(canvas);
    NET.drawHeroCanvas(canvas, actor.characterName, actor.characterIndex, actor._viewDir);

    var rotBtn = document.createElement('button');
    rotBtn.className = 'nythera-rot-btn';
    rotBtn.type = 'button';
    rotBtn.innerText = '↻';
    rotBtn.title = 'Girar personagem';
    rotBtn.onclick = function(e) {
      e.stopPropagation();
      var order = [0, 2, 3, 1];
      var currIdx = order.indexOf(actor._viewDir || 0);
      actor._viewDir = order[(currIdx + 1) % 4];
      NET.drawHeroCanvas(canvas, actor.characterName, actor.characterIndex, actor._viewDir);
    };
    canvasWrap.appendChild(rotBtn);
    modal.appendChild(canvasWrap);

    var classBadge = document.createElement('div');
    classBadge.innerText = `Classe: ${self._selectedClass.name}`;
    Object.assign(classBadge.style, {
      fontSize: '14px',
      color: '#f7d27e',
      marginBottom: '16px',
      fontWeight: '600'
    });
    modal.appendChild(classBadge);

    var nameInput = document.createElement('input');
    nameInput.className = 'nythera-input';
    nameInput.type = 'text';
    nameInput.placeholder = 'Digite o nome do seu personagem...';
    nameInput.maxLength = 20;
    nameInput.style.textAlign = 'center';
    nameInput.style.fontSize = '16px';
    nameInput.style.fontWeight = '600';
    nameInput.style.marginBottom = '8px';
    nameInput.addEventListener('keydown', this._stopKeyProp);
    nameInput.addEventListener('keyup', this._stopKeyProp);
    nameInput.addEventListener('keypress', this._stopKeyProp);
    modal.appendChild(nameInput);
    setTimeout(function() { if (nameInput) nameInput.focus(); }, 100);

    var alertBox = document.createElement('div');
    alertBox.className = 'nythera-alert';
    modal.appendChild(alertBox);

    var createBtn = document.createElement('button');
    createBtn.className = 'nythera-btn-primary';
    createBtn.style.width = '100%';
    createBtn.style.marginTop = '10px';
    createBtn.innerText = 'CRIAR HERÓI';
    modal.appendChild(createBtn);

    createBtn.onclick = function() {
      var charName = nameInput.value.trim();
      if (!charName || charName.length < 2) {
        alertBox.className = 'nythera-alert error';
        alertBox.innerText = 'O nome deve conter ao menos 2 caracteres.';
        return;
      }
      if (charName.length > 20) {
        alertBox.className = 'nythera-alert error';
        alertBox.innerText = 'O nome deve ter no máximo 20 caracteres.';
        return;
      }

      alertBox.className = 'nythera-alert';
      alertBox.innerText = '';
      createBtn.disabled = true;
      createBtn.innerHTML = '<span class="nythera-spinner"></span> Forjando herói...';

      var token = localStorage.getItem('nythera_auth_token');
      fetch(API_HOST + '/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          actorTemplateId: actor.id,
          name: charName
        })
      })
      .then(function(res) {
        return res.json().then(function(json) {
          return { status: res.status, data: json };
        });
      })
      .then(function(result) {
        if (result.status === 201 && result.data.success) {
          self.terminate();
          SceneManager.goto(Scene_NytheraCharSelect);
        } else {
          createBtn.disabled = false;
          createBtn.innerText = 'CRIAR HERÓI';
          alertBox.className = 'nythera-alert error';
          alertBox.innerText = (result.data && result.data.error) || 'Erro ao criar herói.';
        }
      })
      .catch(function(err) {
        createBtn.disabled = false;
        createBtn.innerText = 'CRIAR HERÓI';
        alertBox.className = 'nythera-alert error';
        alertBox.innerText = 'Falha ao conectar ao servidor.';
      });
    };

    nameInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') createBtn.click();
    });

    var backBtn = document.createElement('button');
    backBtn.className = 'nythera-btn-secondary';
    backBtn.style.width = '100%';
    backBtn.style.marginTop = '10px';
    backBtn.innerText = '← Voltar às Aparências';
    backBtn.onclick = function() {
      self._showHeroSelect();
    };
    modal.appendChild(backBtn);

    this._overlay.appendChild(modal);
  };

  Scene_NytheraCharCreate.prototype.terminate = function() {
    Scene_Base.prototype.terminate.call(this);
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
    }
    this._overlay = null;
  };


  // -------------------------------------------------------------------------
  // Scene_NytheraCharSelect: Grade de 4 Slots + Painel de Detalhes
  // -------------------------------------------------------------------------
  function Scene_NytheraCharSelect() {
    this.initialize.apply(this, arguments);
  }
  Scene_NytheraCharSelect.prototype = Object.create(Scene_Base.prototype);
  Scene_NytheraCharSelect.prototype.constructor = Scene_NytheraCharSelect;

  Scene_NytheraCharSelect.prototype.initialize = function() {
    Scene_Base.prototype.initialize.call(this);
    this._characters = [];
    this._mzData = null;
    this._selectedCharId = null;
    this._overlay = null;
    this._detailsPanel = null;
  };

  Scene_NytheraCharSelect.prototype.create = function() {
    Scene_Base.prototype.create.call(this);
    this.createBackground();
  };

  Scene_NytheraCharSelect.prototype.createBackground = function() {
    this._bgSprite = new Sprite();
    this._bgSprite.bitmap = new Bitmap(Graphics.width, Graphics.height);
    this._bgSprite.bitmap.fillAll('#070b14');
    this.addChild(this._bgSprite);
  };

  Scene_NytheraCharSelect.prototype.start = function() {
    Scene_Base.prototype.start.call(this);
    injectNytheraGlobalStyles();
    this._buildOverlay();
    this._loadData();
  };

  Scene_NytheraCharSelect.prototype._buildOverlay = function() {
    this._overlay = document.createElement('div');
    this._overlay.id = 'nythera-charselect-overlay';
    this._overlay.className = 'nythera-fullscreen-overlay';
    this._overlay.innerHTML = '<div style="color:#f7d27e; font-size:18px;"><span class="nythera-spinner" style="border-top-color:#f7d27e;"></span> Sincronizando com o Reino...</div>';
    document.body.appendChild(this._overlay);
  };

  Scene_NytheraCharSelect.prototype._loadData = function() {
    var self = this;
    var token = localStorage.getItem('nythera_auth_token');

    Promise.all([
      fetch(API_HOST + '/game/mzdata').then(function(r) { return r.json(); }),
      fetch(API_HOST + '/characters', {
        headers: { 'Authorization': 'Bearer ' + token }
      }).then(function(r) { return r.json(); })
    ])
    .then(function(results) {
      self._mzData = results[0];
      var charRes = results[1];
      self._characters = (charRes && charRes.data) || [];
      window.$nytheraCharacters = self._characters;

      if (window.NET && NET.setUserInfo) {
        NET.setUserInfo(null, charRes);
      }

      if (self._characters.length === 0) {
        self.terminate();
        SceneManager.goto(Scene_NytheraCharCreate);
        return;
      }

      self._buildUI();
    })
    .catch(function(err) {
      console.error('[CharSelect] Erro ao carregar dados:', err);
      if (self._overlay) {
        self._overlay.innerHTML = `
          <div style="text-align:center;">
            <h2 style="color:#fca5a5; margin-bottom:14px;">Falha ao carregar heróis</h2>
            <button class="nythera-btn-secondary" onclick="SceneManager.goto(Scene_Title)">Voltar ao Login</button>
          </div>
        `;
      }
    });
  };

  Scene_NytheraCharSelect.prototype._buildUI = function() {
    var self = this;
    this._overlay.innerHTML = '';

    var isVip = (window.NET && NET.isVip) ? NET.isVip() : false;
    var userRole = (window.NET && NET.userRole) ? NET.userRole() : 'normal';
    var daysRem = (window.NET && NET.vipDaysRemaining) ? NET.vipDaysRemaining() : 0;

    var badgeText = 'CONTA COMUM';
    var badgeStyle = 'background: rgba(148, 163, 184, 0.15); border: 1px solid rgba(148, 163, 184, 0.3); color: #94a3b8;';
    if (userRole === 'admin') {
      badgeText = '👑 ADMIN';
      badgeStyle = 'background: rgba(168, 85, 247, 0.2); border: 1px solid #a855f7; color: #d8b4fe;';
    } else if (userRole === 'gm') {
      badgeText = '🛡️ GM';
      badgeStyle = 'background: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; color: #93c5fd;';
    } else if (isVip) {
      badgeText = '⭐ VIP (' + (daysRem >= 999 ? 'Permanente' : daysRem + 'd') + ')';
      badgeStyle = 'background: rgba(247, 210, 126, 0.2); border: 1px solid #f7d27e; color: #f7d27e;';
    }

    var headerBox = document.createElement('div');
    headerBox.innerHTML = `
      <h1 class="nythera-main-title">Seus Campeões</h1>
      <p class="nythera-subtitle-text">
        Escolha quem empunhará sua glória nesta jornada
        <span style="display: inline-block; margin-left: 10px; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; ${badgeStyle}">${badgeText}</span>
      </p>
    `;
    this._overlay.appendChild(headerBox);

    var mainContainer = document.createElement('div');
    Object.assign(mainContainer.style, {
      display: 'flex',
      gap: '32px',
      alignItems: 'flex-start',
      justifyContent: 'center',
      maxWidth: '960px',
      width: '100%',
      padding: '0 20px',
      boxSizing: 'border-box'
    });

    // Grade de 6 Slots (3x2)
    var grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: '180px 180px 180px',
      gap: '18px',
      boxSizing: 'border-box'
    });

    var maxSlots = 6;
    for (var i = 0; i < maxSlots; i++) {
      (function(idx) {
        var char = self._characters[idx];
        var slot = document.createElement('div');
        Object.assign(slot.style, {
          width: '180px',
          height: '240px',
          background: 'rgba(16, 22, 36, 0.9)',
          border: '1px solid rgba(229, 184, 92, 0.25)',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          position: 'relative',
          boxSizing: 'border-box'
        });

        if (char) {
          // Slot Preenchido (Herói existente)
          if (idx >= 4) {
            var vipTag = document.createElement('div');
            vipTag.innerText = 'SLOT VIP';
            Object.assign(vipTag.style, {
              position: 'absolute',
              top: '6px',
              right: '6px',
              padding: '2px 6px',
              fontSize: '9px',
              fontWeight: '700',
              color: '#f7d27e',
              background: 'rgba(247, 210, 126, 0.15)',
              border: '1px solid rgba(247, 210, 126, 0.4)',
              borderRadius: '4px',
              letterSpacing: '0.5px'
            });
            slot.appendChild(vipTag);
          }

          var canvas = document.createElement('canvas');
          canvas.width = 96;
          canvas.height = 128;
          canvas.style.display = 'block';
          canvas.style.imageRendering = 'pixelated';
          slot.appendChild(canvas);

          var spriteName = char.characterName || 'Actor1';
          var spriteIdx = (char.characterIndex !== undefined) ? char.characterIndex : 0;
          NET.drawHeroCanvas(canvas, spriteName, spriteIdx, 0);

          var nameLabel = document.createElement('div');
          nameLabel.innerText = char.name;
          Object.assign(nameLabel.style, {
            fontWeight: '700',
            fontSize: '15px',
            color: '#f7d27e',
            marginTop: '8px',
            textAlign: 'center'
          });
          slot.appendChild(nameLabel);

          var classInfo = document.createElement('div');
          var cName = char.className || 'Aventureiro';
          classInfo.innerText = `Nv. ${char.level || 1} • ${cName}`;
          Object.assign(classInfo.style, {
            fontSize: '12px',
            color: '#94a3b8',
            marginTop: '4px'
          });
          slot.appendChild(classInfo);

          slot.onclick = function() {
            self._selectedCharId = char.id;
            self._updateDetailsPanel();

            // Atualiza destaque visual dos slots
            Array.from(grid.children).forEach(function(s) {
              if (s._isLocked) return;
              s.style.borderColor = 'rgba(229, 184, 92, 0.25)';
              s.style.boxShadow = 'none';
              s.style.background = 'rgba(16, 22, 36, 0.9)';
            });
            slot.style.borderColor = '#f7d27e';
            slot.style.boxShadow = '0 0 20px rgba(247, 210, 126, 0.35)';
            slot.style.background = 'rgba(229, 184, 92, 0.12)';
          };
        } else if (idx >= 4 && !isVip) {
          // Slot VIP Bloqueado para Não-VIP
          slot._isLocked = true;
          slot.style.border = '1px dashed rgba(255, 255, 255, 0.15)';
          slot.style.background = 'rgba(12, 16, 26, 0.6)';
          slot.style.cursor = 'not-allowed';
          slot.style.opacity = '0.75';

          var lockIcon = document.createElement('div');
          lockIcon.innerText = '🔒';
          lockIcon.style.fontSize = '30px';
          lockIcon.style.marginBottom = '6px';

          var lockedLabel = document.createElement('div');
          lockedLabel.innerText = 'Slot VIP';
          Object.assign(lockedLabel.style, {
            fontSize: '13px',
            fontWeight: '700',
            color: '#f7d27e',
            letterSpacing: '0.5px'
          });

          var lockedSub = document.createElement('div');
          lockedSub.innerText = 'Bloqueado';
          Object.assign(lockedSub.style, {
            fontSize: '11px',
            fontWeight: '600',
            color: '#ef4444',
            marginTop: '2px'
          });

          var lockedInfo = document.createElement('div');
          lockedInfo.innerText = '+2 slots p/ VIPs';
          Object.assign(lockedInfo.style, {
            fontSize: '11px',
            color: '#64748b',
            marginTop: '8px'
          });

          slot.appendChild(lockIcon);
          slot.appendChild(lockedLabel);
          slot.appendChild(lockedSub);
          slot.appendChild(lockedInfo);

          slot.onclick = function() {
            alert('Este slot é exclusivo para membros VIP (+2 slots de personagens)!\nAdquira VIP em jogo ou fale com a administração para desbloquear.');
          };
        } else {
          // Slot Vazio Desbloqueado -> Criar Novo Herói
          var isVipSlot = (idx >= 4);
          slot.style.border = isVipSlot ? '2px dashed rgba(247, 210, 126, 0.5)' : '2px dashed rgba(229, 184, 92, 0.3)';
          slot.style.background = isVipSlot ? 'rgba(247, 210, 126, 0.05)' : 'rgba(16, 22, 36, 0.6)';

          var plus = document.createElement('div');
          plus.innerText = '+';
          Object.assign(plus.style, {
            fontSize: '40px',
            color: isVipSlot ? '#f7d27e' : '#94a3b8',
            transition: 'all 0.2s ease',
            lineHeight: '1'
          });

          var createLabel = document.createElement('div');
          createLabel.innerText = isVipSlot ? 'Criar Herói VIP' : 'Criar Novo Herói';
          Object.assign(createLabel.style, {
            fontSize: '13px',
            fontWeight: '600',
            color: isVipSlot ? '#f7d27e' : '#94a3b8',
            marginTop: '10px',
            transition: 'all 0.2s ease'
          });

          slot.appendChild(plus);
          slot.appendChild(createLabel);

          slot.onmouseenter = function() {
            slot.style.borderColor = '#f7d27e';
            slot.style.background = 'rgba(229, 184, 92, 0.08)';
            plus.style.color = '#f7d27e';
            plus.style.transform = 'scale(1.15)';
            createLabel.style.color = '#f7d27e';
          };
          slot.onmouseleave = function() {
            slot.style.borderColor = isVipSlot ? 'rgba(247, 210, 126, 0.5)' : 'rgba(229, 184, 92, 0.3)';
            slot.style.background = isVipSlot ? 'rgba(247, 210, 126, 0.05)' : 'rgba(16, 22, 36, 0.6)';
            plus.style.color = isVipSlot ? '#f7d27e' : '#94a3b8';
            plus.style.transform = 'scale(1)';
            createLabel.style.color = isVipSlot ? '#f7d27e' : '#94a3b8';
          };

          slot.onclick = function() {
            self.terminate();
            SceneManager.goto(Scene_NytheraCharCreate);
          };
        }

        grid.appendChild(slot);
      })(i);
    }

    mainContainer.appendChild(grid);

    // Painel de Detalhes Lateral
    this._detailsPanel = document.createElement('div');
    Object.assign(this._detailsPanel.style, {
      width: '320px',
      background: 'rgba(16, 22, 36, 0.94)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(229, 184, 92, 0.35)',
      borderRadius: '12px',
      padding: '24px',
      display: 'none',
      flexDirection: 'column',
      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(229, 184, 92, 0.15)',
      boxSizing: 'border-box'
    });
    mainContainer.appendChild(this._detailsPanel);

    this._overlay.appendChild(mainContainer);

    // Barra Inferior (Trocar Conta)
    var bottomBar = document.createElement('div');
    bottomBar.style.marginTop = '28px';
    var logoutBtn = document.createElement('button');
    logoutBtn.className = 'nythera-btn-secondary';
    logoutBtn.innerText = '← Trocar de Conta';
    logoutBtn.onclick = function() {
      self.terminate();
      SceneManager.goto(Scene_Title);
    };
    bottomBar.appendChild(logoutBtn);
    this._overlay.appendChild(bottomBar);

    // Seleciona o primeiro personagem por padrão
    var firstSlot = grid.children[0];
    if (firstSlot && self._characters[0]) {
      firstSlot.click();
    }
  };

  Scene_NytheraCharSelect.prototype._updateDetailsPanel = function() {
    var self = this;
    if (!this._detailsPanel) return;

    var char = this._characters.find(function(c) {
      return c.id === self._selectedCharId;
    });
    if (!char) {
      this._detailsPanel.style.display = 'none';
      return;
    }

    var isVip = (window.NET && NET.isVip) ? NET.isVip() : false;
    var userRole = (window.NET && NET.userRole) ? NET.userRole() : 'normal';
    var daysRem = (window.NET && NET.vipDaysRemaining) ? NET.vipDaysRemaining() : 0;

    var roleLabel = 'Comum';
    var roleColor = '#94a3b8';
    if (userRole === 'admin') { roleLabel = 'Admin 👑'; roleColor = '#d8b4fe'; }
    else if (userRole === 'gm') { roleLabel = 'Game Master 🛡️'; roleColor = '#93c5fd'; }
    else if (isVip) { roleLabel = 'VIP ⭐'; roleColor = '#f7d27e'; }

    this._detailsPanel.style.display = 'flex';
    this._detailsPanel.innerHTML = '';

    var panelTitle = document.createElement('h2');
    panelTitle.innerText = 'Detalhes do Campeão';
    Object.assign(panelTitle.style, {
      margin: '0 0 18px 0',
      fontSize: '18px',
      fontWeight: '700',
      color: '#f7d27e',
      textAlign: 'center',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      paddingBottom: '10px'
    });
    this._detailsPanel.appendChild(panelTitle);

    var createRow = function(label, value, valueColor) {
      var row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        fontSize: '13px'
      });
      var l = document.createElement('span');
      l.innerText = label;
      l.style.color = '#94a3b8';
      var v = document.createElement('span');
      v.innerText = value;
      v.style.fontWeight = '600';
      v.style.color = valueColor || '#f8fafc';
      row.appendChild(l);
      row.appendChild(v);
      return row;
    };

    var mapName = 'Planície Inicial (MAP001)';
    if (this._mzData && this._mzData.maps) {
      var mId = char.map_id || char.mapId || 1;
      var foundMap = this._mzData.maps.find(function(m) { return m.id === mId; });
      if (foundMap) mapName = `${foundMap.name} (MAP${String(mId).padStart(3, '0')})`;
    }

    this._detailsPanel.appendChild(createRow('Nome', char.name, '#f7d27e'));
    this._detailsPanel.appendChild(createRow('Classe', char.className || 'Aventureiro'));
    this._detailsPanel.appendChild(createRow('Nível', String(char.level || 1)));
    this._detailsPanel.appendChild(createRow('Localização', mapName));
    this._detailsPanel.appendChild(createRow('Conta', roleLabel, roleColor));
    this._detailsPanel.appendChild(createRow('Slots de Criação', self._characters.length + ' / ' + (isVip ? '6 (VIP)' : '4')));
    if (isVip && daysRem < 999) {
      this._detailsPanel.appendChild(createRow('VIP Restante', daysRem + ' dias', '#f7d27e'));
    }

    // Botão ENTRAR NO REINO
    var enterBtn = document.createElement('button');
    enterBtn.className = 'nythera-btn-primary';
    enterBtn.style.marginTop = '24px';
    enterBtn.style.width = '100%';
    enterBtn.innerText = 'ENTRAR NO REINO';
    enterBtn.onclick = function() {
      self._enterGame(char);
    };
    this._detailsPanel.appendChild(enterBtn);

    // Botão DELETAR HERÓI
    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'nythera-btn-danger';
    deleteBtn.style.marginTop = '12px';
    deleteBtn.style.width = '100%';
    deleteBtn.innerText = 'DELETAR HERÓI';
    deleteBtn.onclick = function() {
      if (confirm(`Tem certeza de que deseja banir o herói "${char.name}" para sempre? Esta ação é irreversível.`)) {
        self._deleteCharacter(char.id);
      }
    };
    this._detailsPanel.appendChild(deleteBtn);
  };

  Scene_NytheraCharSelect.prototype._enterGame = function(char) {
    var self = this;
    var enterBtn = this._detailsPanel.querySelector('.nythera-btn-primary');
    if (enterBtn) {
      enterBtn.disabled = true;
      enterBtn.innerHTML = '<span class="nythera-spinner"></span> Conectando...';
    }

    var token = localStorage.getItem('nythera_auth_token');
    if (!token) {
      alert('Sessão expirada. Faça login novamente.');
      this.terminate();
      SceneManager.goto(Scene_Title);
      return;
    }

    NET.Client.token = token;
    NET.Client.characterId = char.id;
    NET.Client.connect();

    var onConnected = function(data) {
      if (NET.Client.off) {
        NET.Client.off('connected', onConnected);
        NET.Client.off('ERROR_RES', onError);
        NET.Client.off('disconnected', onDisconnected);
      }

      self.terminate();
      DataManager.setupNewGame();

      var cData = (data && data.character) || char;
      var actorId = cData.actorTemplateId || char.actor_template_id || 1;
      $gameParty._actors = [actorId];
      var leader = $gameParty.leader();
      if (leader) {
        leader.setName(cData.name || char.name);
      }
      if ($gamePlayer.followers()) {
        $gamePlayer.followers().hide();
      }

      var mapId = cData.mapId || char.map_id || 1;
      var x = cData.x !== undefined ? cData.x : (char.position_x || 13);
      var y = cData.y !== undefined ? cData.y : (char.position_y || 7);
      var dir = cData.direction || char.direction || 2;

      $gamePlayer.reserveTransfer(mapId, x, y, dir, 0);
      $gamePlayer.setTransparent(false);
      $gamePlayer.refresh();

      SceneManager.goto(Scene_Map);
    };

    var onError = function(data) {
      if (enterBtn) {
        enterBtn.disabled = false;
        enterBtn.innerText = 'ENTRAR NO REINO';
      }
      alert((data && data.message) || 'Erro ao conectar ao servidor.');
    };

    var onDisconnected = function() {
      if (enterBtn) {
        enterBtn.disabled = false;
        enterBtn.innerText = 'ENTRAR NO REINO';
      }
    };

    NET.Client.on('connected', onConnected);
    NET.Client.on('ERROR_RES', onError);
    NET.Client.on('disconnected', onDisconnected);
  };

  Scene_NytheraCharSelect.prototype._deleteCharacter = function(charId) {
    var self = this;
    var token = localStorage.getItem('nythera_auth_token');

    fetch(API_HOST + '/characters/' + charId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        self._loadData(); // Recarrega os heróis
      } else {
        alert(data.error || 'Falha ao deletar herói.');
      }
    })
    .catch(function(err) {
      console.error('[CharSelect] Erro ao deletar:', err);
      alert('Erro de conexão ao deletar personagem.');
    });
  };

  Scene_NytheraCharSelect.prototype.terminate = function() {
    Scene_Base.prototype.terminate.call(this);
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
    }
    this._overlay = null;
  };

  // Exporta cenas para o escopo global do RPG Maker MZ
  window.Scene_NytheraCharCreate = Scene_NytheraCharCreate;
  window.Scene_NytheraCharSelect = Scene_NytheraCharSelect;

})();
