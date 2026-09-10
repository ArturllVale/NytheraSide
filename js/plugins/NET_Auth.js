/*:
 * @plugindesc Network Auth overlay & Save/Load disabler
 * @author Antigravity
 *
 * @help
 * Disables default saving and loading.
 * Overrides Scene_Title to prompt for login token via window prompt.
 */

window.NET = window.NET || {};

(function() {
  // Disable save/load
  DataManager.isAnySavefileExists = function() { return false; };
  DataManager.loadGame = function() { return false; };
  DataManager.saveGame = function() { return false; };
  
  // Disable save menu
  Window_MenuCommand.prototype.isSaveEnabled = function() {
    return false;
  };

  // Override Title Scene to just ask for Token
  var _Scene_Title_start = Scene_Title.prototype.start;
  Scene_Title.prototype.start = function() {
    _Scene_Title_start.call(this);
    this.promptLogin();
  };

  Scene_Title.prototype.promptLogin = function() {
    // Basic MVP Auth: prompt the user for their token directly.
    // In a real game, this would be an HTML overlay for Login/Register.
    var token = prompt('Enter your Session Token (from POST /auth/login):', '');
    if (token) {
      NET.Client.token = token;
      NET.Client.connect();
      
      NET.Client.on('connected', function() {
        alert('Connected successfully!');
        // Start game
        DataManager.setupNewGame();
        SceneManager.goto(Scene_Map);
      }.bind(this));
    } else {
      alert('Token required. Please refresh.');
    }
  };

  // Remove Title Command Window completely so we don't start local new games randomly
  Scene_Title.prototype.createCommandWindow = function() {
    this._commandWindow = new Window_TitleCommand();
    this._commandWindow.setHandler('newGame',  this.commandNewGame.bind(this));
    this._commandWindow.setHandler('continue', this.commandContinue.bind(this));
    this._commandWindow.setHandler('options',  this.commandOptions.bind(this));
    // Don't add to window layer!
  };

})();
