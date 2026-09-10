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
  $.url = 'ws://localhost:3000/battle/sync';
  
  // Event listeners mapped by event type
  $.listeners = {};

  $.connect = function() {
    if (this.ws) this.ws.close();
    
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = this.onOpen.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
    this.ws.onclose = this.onClose.bind(this);
    this.ws.onerror = this.onError.bind(this);
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
      this.emit('connected', data);
    } else {
      this.emit(data.type, data);
    }
  };

  $.onClose = function() {
    console.log('[NET_Client] Disconnected. Reconnecting in 3s...');
    this.isConnected = false;
    setTimeout(this.connect.bind(this), 3000);
  };

  $.onError = function(err) {
    console.error('[NET_Client] Error:', err);
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

  $.emit = function(type, data) {
    if (this.listeners[type]) {
      this.listeners[type].forEach(function(cb) { cb(data); });
    }
  };

})(NET.Client);
