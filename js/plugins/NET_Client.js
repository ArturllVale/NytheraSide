/*:
 * @plugindesc Network Client for Server-Authoritative Engine
 * @author Antigravity
 *
 * @help
 * NET_Client initializes the WebSocket connection.
 */

window.NET = window.NET || {};
NET.Client = NET.Client || {};

(function($) {
  $.ws = null;
  $.token = null; // Session token set by NET_Auth
  $.isConnected = false;
  $.url = 'ws://localhost:3000/sync';
  
  // Event listeners mapped by event type
  $.listeners = {};

  $.connect = function() {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = this.onOpen.bind(this);
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onclose = this.onClose.bind(this);
      this.ws.onerror = this.onError.bind(this);
    } catch (e) {
      console.error('[NET_Client] Failed to create WebSocket:', e);
      this.onError(e);
    }
  };

  $.onOpen = function() {
    console.log('[NET_Client] Connected');
    if (this.token) {
      this.send({ type: 'AUTH_REQ', token: this.token });
    }
  };

  $.onMessage = function(event) {
    var data = JSON.parse(event.data);
    console.log('[NET_Client] Received:', data);
    
    if (data.type === 'AUTH_RES' && data.success) {
      this.isConnected = true;
      this.character = data.character;
      this.emit('connected', data);
    } else {
      this.emit(data.type, data);
    }
  };

  $.onClose = function(event) {
    console.log('[NET_Client] Disconnected.');
    var wasConnected = this.isConnected;
    this.isConnected = false;

    // Se estiver no meio do jogo, joga imediatamente para a tela de login
    if (window.SceneManager && SceneManager._scene && !(SceneManager._scene instanceof Scene_Title)) {
      if (window.NET && NET.AuthUI) {
        NET.AuthUI._pendingMessage = {
          type: 'error',
          text: 'Você foi desconectado do servidor. A conexão foi perdida.'
        };
      }
      SceneManager.goto(Scene_Title);
    }

    this.emit('disconnected', { wasConnected: wasConnected });
  };

  $.onError = function(err) {
    console.error('[NET_Client] Error:', err);
    this.emit('error', err);
  };

  $.send = function(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      console.warn('[NET_Client] Cannot send. Not connected.', payload);
    }
  };

  $.on = function(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
  };

  $.off = function(type, callback) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(function(cb) { return cb !== callback; });
  };

  $.emit = function(type, data) {
    if (this.listeners[type]) {
      this.listeners[type].forEach(function(cb) { cb(data); });
    }
  };

})(NET.Client);
