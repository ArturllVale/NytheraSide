/*:
 * @plugindesc Content Guard to verify client-server sync
 * @author Antigravity
 *
 * @help
 * Fetches the active content version on boot.
 */

window.NET = window.NET || {};

(function() {
  var _Scene_Boot_start = Scene_Boot.prototype.start;
  Scene_Boot.prototype.start = function() {
    _Scene_Boot_start.call(this);
    this.verifyContentVersion();
  };

  Scene_Boot.prototype.verifyContentVersion = function() {
    var xhr = new XMLHttpRequest();
    var url = 'http://localhost:3000/content/active';
    xhr.open('GET', url);
    xhr.onload = function() {
      if (xhr.status === 200) {
        var response = JSON.parse(xhr.responseText);
        console.log('[NET_ContentGuard] Server content version:', response.version);
        // Normally we'd compare this to a local constant written during `npm run build:content`
        // If mismatched, show a warning or force restart.
      }
    };
    xhr.onerror = function() {
      console.error('[NET_ContentGuard] Could not reach server to verify content.');
    };
    xhr.send();
  };

})();
