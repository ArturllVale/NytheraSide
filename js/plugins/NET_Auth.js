/*:
 * @target MZ
 * @plugindesc Interface Visual de Login & Registro e Integração com Servidor
 * @author Antigravity & Arthur Vale
 *
 * @param apiHost
 * @text URL da API
 * @desc Endereço base do servidor Fastify
 * @default http://localhost:3000
 *
 * @help
 * Este plugin substitui a tela de título padrão do RPG Maker por um modal
 * moderno de Login e Registro com comunicação em tempo real com o servidor.
 * 
 * Recursos:
 * - Aba de Login (Email, Senha, Lembrar Login)
 * - Aba de Registro (Nome de Usuário, Email, Senha, Repetir Senha)
 * - Criação automática do Personagem Inicial na criação de conta
 * - Isolamento de teclado para evitar conflitos com os comandos do jogo
 * - Opção de Modo Offline / Teste para desenvolvedores
 */

window.NET = window.NET || {};

(function() {
  var pluginParams = PluginManager.parameters('NET_Auth') || {};
  var API_HOST = pluginParams.apiHost || 'http://localhost:3000';

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

  // Oculta a janela de comandos padrão da Scene_Title para não iniciar jogos locais avulsos
  Scene_Title.prototype.createCommandWindow = function() {
    const rect = this.commandWindowRect();
    this._commandWindow = new Window_TitleCommand(rect);
    this._commandWindow.setHandler('newGame',  this.commandNewGame.bind(this));
    this._commandWindow.setHandler('continue', this.commandContinue.bind(this));
    this._commandWindow.setHandler('options',  this.commandOptions.bind(this));
    // Não adicionamos à window layer para manter a tela limpa
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

  // -------------------------------------------------------------
  // Módulo AuthUI: Gerenciamento do Modal HTML/CSS
  // -------------------------------------------------------------
  NET.AuthUI = {
    _container: null,
    _styleElem: null,
    _scene: null,
    _currentTab: 'login',

    _pendingMessage: null,

    init: function(scene) {
      this._scene = scene;
      this.destroy(); // Garante limpeza prévia se já existia
      this.injectStyles();
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
      if (this._styleElem && this._styleElem.parentNode) {
        this._styleElem.parentNode.removeChild(this._styleElem);
      }
      this._styleElem = null;
    },

    injectStyles: function() {
      if (document.getElementById('nythera-auth-styles')) return;

      var style = document.createElement('style');
      style.id = 'nythera-auth-styles';
      style.innerHTML = `
        #nythera-auth-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          pointer-events: auto;
          background: radial-gradient(circle at center, rgba(10, 15, 25, 0.45) 0%, rgba(5, 8, 15, 0.75) 100%);
          animation: nytheraFadeIn 0.3s ease-out;
        }

        @keyframes nytheraFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        #nythera-auth-modal {
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
          transform: translateY(0);
          transition: transform 0.2s ease;
        }

        .nythera-header {
          text-align: center;
          margin-bottom: 22px;
        }

        .nythera-title {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #f7d27e;
          text-shadow: 0 2px 10px rgba(247, 210, 126, 0.4);
          margin: 0 0 6px 0;
        }

        .nythera-subtitle {
          font-size: 13px;
          color: #94a3b8;
          letter-spacing: 0.5px;
          margin: 0;
        }

        /* Tabs */
        .nythera-tabs {
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          margin-bottom: 20px;
        }

        .nythera-tab-btn {
          flex: 1;
          padding: 10px 0;
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.8px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .nythera-tab-btn:hover {
          color: #f1f5f9;
        }

        .nythera-tab-btn.active {
          color: #f7d27e;
        }

        .nythera-tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: #f7d27e;
          box-shadow: 0 0 8px rgba(247, 210, 126, 0.8);
        }

        /* Forms */
        .nythera-form-group {
          margin-bottom: 15px;
          text-align: left;
        }

        .nythera-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #cbd5e1;
          margin-bottom: 6px;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }

        .nythera-input {
          width: 100%;
          padding: 11px 14px;
          background: rgba(8, 12, 22, 0.7);
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
          background: rgba(12, 17, 30, 0.9);
        }

        .nythera-checkbox-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 18px;
          user-select: none;
        }

        .nythera-checkbox-label {
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .nythera-checkbox-label input {
          margin-right: 8px;
          cursor: pointer;
          accent-color: #f7d27e;
        }

        /* Buttons */
        .nythera-btn-primary {
          width: 100%;
          padding: 12px;
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
          box-shadow: 0 4px 12px rgba(212, 160, 62, 0.35);
        }

        .nythera-btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #e5b04c 0%, #ffdf8f 100%);
          box-shadow: 0 6px 18px rgba(247, 210, 126, 0.5);
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

        .nythera-btn-offline {
          width: 100%;
          margin-top: 10px;
          padding: 8px 12px;
          background: transparent;
          border: 1px dashed rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nythera-btn-offline:hover {
          border-color: rgba(255, 255, 255, 0.4);
          color: #e2e8f0;
          background: rgba(255, 255, 255, 0.04);
        }

        /* Message Boxes */
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

        /* Loading indicator */
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

        @keyframes nytheraSpin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
      this._styleElem = style;
    },

    buildDOM: function() {
      var wrapper = document.createElement('div');
      wrapper.id = 'nythera-auth-wrapper';

      wrapper.innerHTML = `
        <div id="nythera-auth-modal">
          <div class="nythera-header">
            <h1 class="nythera-title">Nythera Online</h1>
            <p class="nythera-subtitle">Identifique-se para entrar nas Crônicas</p>
          </div>

          <div class="nythera-tabs">
            <button id="nythera-tab-login" class="nythera-tab-btn active" type="button">Entrar</button>
            <button id="nythera-tab-register" class="nythera-tab-btn" type="button">Criar Conta</button>
          </div>

          <div id="nythera-alert-box" class="nythera-alert"></div>

          <!-- FORMULÁRIO DE LOGIN -->
          <form id="nythera-login-form" autocomplete="on">
            <div class="nythera-form-group">
              <label class="nythera-label" for="nythera-login-email">E-mail</label>
              <input id="nythera-login-email" class="nythera-input" type="email" placeholder="seu@email.com" required autocomplete="email">
            </div>
            <div class="nythera-form-group">
              <label class="nythera-label" for="nythera-login-password">Senha</label>
              <input id="nythera-login-password" class="nythera-input" type="password" placeholder="••••••••" required autocomplete="current-password">
            </div>
            <div class="nythera-checkbox-row">
              <label class="nythera-checkbox-label">
                <input id="nythera-remember-me" type="checkbox" checked>
                Lembrar minha conta
              </label>
            </div>
            <button id="nythera-btn-submit-login" class="nythera-btn-primary" type="submit">
              Entrar no Reino
            </button>
            <button id="nythera-btn-offline" class="nythera-btn-offline" type="button">
              ⚔️ Modo Offline / Teste Local
            </button>
          </form>

          <!-- FORMULÁRIO DE REGISTRO -->
          <form id="nythera-register-form" style="display: none;" autocomplete="off">
            <div class="nythera-form-group">
              <label class="nythera-label" for="nythera-reg-username">Nome de Usuário / Herói</label>
              <input id="nythera-reg-username" class="nythera-input" type="text" placeholder="Ex: Eldrin" maxlength="20" required>
            </div>
            <div class="nythera-form-group">
              <label class="nythera-label" for="nythera-reg-email">E-mail</label>
              <input id="nythera-reg-email" class="nythera-input" type="email" placeholder="seu@email.com" required>
            </div>
            <div class="nythera-form-group">
              <label class="nythera-label" for="nythera-reg-password">Senha</label>
              <input id="nythera-reg-password" class="nythera-input" type="password" placeholder="Mínimo 8 caracteres" minlength="8" required>
            </div>
            <div class="nythera-form-group">
              <label class="nythera-label" for="nythera-reg-password-confirm">Repetir Senha</label>
              <input id="nythera-reg-password-confirm" class="nythera-input" type="password" placeholder="Confirme a senha" minlength="8" required>
            </div>
            <button id="nythera-btn-submit-reg" class="nythera-btn-primary" type="submit">
              Criar Conta e Jogar
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

      // Alternância de Abas
      tabLogin.addEventListener('click', function() { self.switchTab('login'); });
      tabRegister.addEventListener('click', function() { self.switchTab('register'); });

      // Modo Offline
      btnOffline.addEventListener('click', function() {
        self.showMessage('info', 'Iniciando jogo em modo offline...');
        setTimeout(function() {
          self.finishAndStartGame();
        }, 300);
      });

      // Submissão Login
      formLogin.addEventListener('submit', function(e) {
        e.preventDefault();
        self.handleLogin();
      });

      // Submissão Registro
      formRegister.addEventListener('submit', function(e) {
        e.preventDefault();
        self.handleRegister();
      });

      // ISOLAMENTO DE TECLADO:
      // Impede que teclas digitadas (Espaço, Enter, Setas, Z, X, etc.) vazem para o canvas do RPG Maker
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
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.style.display = 'block';
        formRegister.style.display = 'none';
        document.getElementById('nythera-login-email').focus();
      } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        formLogin.style.display = 'none';
        formRegister.style.display = 'block';
        document.getElementById('nythera-reg-username').focus();
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

    // -------------------------------------------------------------
    // Fluxo de Login
    // -------------------------------------------------------------
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
          self.showMessage('info', 'Autenticado! Verificando personagem...');
          
          // Garante que o jogador tem um personagem criado
          self.ensureCharacter(token, email.split('@')[0], function() {
            self.connectWebSocket(token);
          });
        } else {
          self.setLoading('nythera-btn-submit-login', false, 'Entrar no Reino');
          var errorMsg = (result.data && result.data.error) || 'E-mail ou senha incorretos.';
          self.showMessage('error', errorMsg);
        }
      })
      .catch(function(err) {
        self.setLoading('nythera-btn-submit-login', false, 'Entrar no Reino');
        console.error('[NET_Auth] Erro ao conectar ao servidor:', err);
        self.showMessage('error', 'Não foi possível conectar ao servidor (' + API_HOST + '). Verifique se o backend está rodando.');
      });
    },

    // -------------------------------------------------------------
    // Fluxo de Registro
    // -------------------------------------------------------------
    handleRegister: function() {
      var self = this;
      var username = document.getElementById('nythera-reg-username').value.trim();
      var email = document.getElementById('nythera-reg-email').value.trim();
      var password = document.getElementById('nythera-reg-password').value;
      var confirmPassword = document.getElementById('nythera-reg-password-confirm').value;

      if (!username || !email || !password || !confirmPassword) {
        this.showMessage('error', 'Por favor, preencha todos os campos.');
        return;
      }

      if (username.length < 2) {
        this.showMessage('error', 'O nome de usuário deve ter pelo menos 2 caracteres.');
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
      this.setLoading('nythera-btn-submit-reg', true, 'Criar Conta e Jogar');

      // 1. Cadastrar usuário
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
          
          // 2. Login automático após o registro
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
              self.showMessage('info', 'Criando personagem "' + username + '"...');
              
              // 3. Cria personagem inicial com o nome de usuário escolhido
              return self.createStarterCharacter(token, username).then(function() {
                self.connectWebSocket(token);
              });
            } else {
              throw new Error('Falha ao autenticar após o registro.');
            }
          });
        } else {
          var errorMsg = (result.data && result.data.error) || 'Erro ao registrar usuário.';
          if (result.status === 409) {
            errorMsg = 'Este e-mail já está cadastrado.';
          }
          throw new Error(errorMsg);
        }
      })
      .catch(function(err) {
        self.setLoading('nythera-btn-submit-reg', false, 'Criar Conta e Jogar');
        console.error('[NET_Auth] Erro no registro:', err);
        self.showMessage('error', err.message || 'Falha ao comunicar com o servidor.');
      });
    },

    // -------------------------------------------------------------
    // Criação e Verificação de Personagem
    // -------------------------------------------------------------
    ensureCharacter: function(token, defaultName, callback) {
      var self = this;
      fetch(API_HOST + '/characters', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      .then(function(res) { return res.json(); })
      .then(function(json) {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          callback();
        } else {
          // Nenhum personagem encontrado, cria o inicial
          self.createStarterCharacter(token, defaultName).then(callback);
        }
      })
      .catch(function(err) {
        console.warn('[NET_Auth] Erro ao checar personagens:', err);
        callback();
      });
    },

    createStarterCharacter: function(token, characterName) {
      var name = characterName || 'Herói';
      return fetch(API_HOST + '/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ actorTemplateId: 1, name: name })
      })
      .then(function(res) { return res.json(); })
      .catch(function(err) {
        console.warn('[NET_Auth] Não foi possível criar o personagem inicial:', err);
      });
    },

    // -------------------------------------------------------------
    // Conexão WebSocket e Início do Jogo
    // -------------------------------------------------------------
    connectWebSocket: function(token) {
      var self = this;
      this.showMessage('info', 'Sincronizando com o mundo...');

      NET.Client.token = token;
      NET.Client.connect();

      var onConnected = function(data) {
        if (NET.Client.off) {
          NET.Client.off('connected', onConnected);
          NET.Client.off('ERROR_RES', onError);
          NET.Client.off('disconnected', onDisconnected);
        }
        self.showMessage('success', 'Conectado com sucesso! Entrando...');
        setTimeout(function() {
          self.finishAndStartGame(data && data.character);
        }, 500);
      };

      var onError = function(data) {
        var msg = (data && data.message) || 'O servidor está offline ou inacessível no momento.';
        self.showMessage('error', msg);
        self.setLoading('nythera-btn-submit-login', false, 'Entrar no Reino');
        self.setLoading('nythera-btn-submit-reg', false, 'Criar Conta e Jogar');
      };

      var onDisconnected = function() {
        self.showMessage('error', 'O servidor está offline ou inacessível no momento.');
        self.setLoading('nythera-btn-submit-login', false, 'Entrar no Reino');
        self.setLoading('nythera-btn-submit-reg', false, 'Criar Conta e Jogar');
      };

      NET.Client.on('connected', onConnected);
      NET.Client.on('ERROR_RES', onError);
      NET.Client.on('disconnected', onDisconnected);
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

})();
