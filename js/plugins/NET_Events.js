/*:
 * @target MZ
 * @plugindesc NytheraSide - Eventos Sincronizados com o Servidor
 * @author Nythera
 *
 * @help NET_Events.js
 * Executa os eventos localmente usando os recursos nativos do RPG Maker,
 * mas envia o histórico de escolhas (choices) para o servidor validar e 
 * aplicar as recompensas (Ouro, Itens, XP) de forma autoritativa.
 */

(function() {
    // -------------------------------------------------------------------------
    // Game_Interpreter Hooks (Gravação de Histórico e Envio)
    // -------------------------------------------------------------------------
    var _Game_Interpreter_setup = Game_Interpreter.prototype.setup;
    Game_Interpreter.prototype.setup = function(list, eventId) {
        _Game_Interpreter_setup.call(this, list, eventId);
        this._serverChoiceHistory = [];
        this._isSyncEvent = false;
        
        // Verifica se é um evento de mapa válido (não commom event genérico)
        if (this._mapId === $gameMap.mapId() && eventId > 0) {
            var event = $gameMap.event(eventId);
            if (event) {
                // Podemos sincronizar todos os eventos ou apenas os com [NPC] / <sync>
                if (event.event().name.includes('[NPC]') || event.event().note.match(/<sync>/i) || event.event().note.match(/<npcId/i)) {
                    this._isSyncEvent = true;
                }
            }
        }
    };

    var _Game_Interpreter_setupChoices = Game_Interpreter.prototype.setupChoices;
    Game_Interpreter.prototype.setupChoices = function(params) {
        _Game_Interpreter_setupChoices.call(this, params);
        // Intercept the choice callback to record the user's selection
        var originalCallback = $gameMessage.choiceCallback();
        $gameMessage.setChoiceCallback(function(n) {
            if (this._isSyncEvent) {
                this._serverChoiceHistory.push(n);
            }
            if (originalCallback) {
                originalCallback.call(this, n);
            }
        }.bind(this));
    };

    var _Game_Interpreter_terminate = Game_Interpreter.prototype.terminate;
    Game_Interpreter.prototype.terminate = function() {
        if (this._isSyncEvent && window.NET && NET.Client) {
            NET.Client.send({
                type: 'EVENT_SYNC_REQ',
                mapId: this._mapId,
                eventId: this._eventId,
                choices: this._serverChoiceHistory
            });
        }
        _Game_Interpreter_terminate.call(this);
    };

    // Bloqueia comandos de recompensa nativos para não dar recompensa falsa no cliente.
    // A recompensa real virá do servidor.
    var _Game_Interpreter_command125 = Game_Interpreter.prototype.command125; // Change Gold
    Game_Interpreter.prototype.command125 = function(params) {
        if (this._isSyncEvent) return true; // Pula a execução local, o server fará isso
        return _Game_Interpreter_command125.call(this, params);
    };

    var _Game_Interpreter_command126 = Game_Interpreter.prototype.command126; // Change Items
    Game_Interpreter.prototype.command126 = function(params) {
        if (this._isSyncEvent) return true; 
        return _Game_Interpreter_command126.call(this, params);
    };

    var _Game_Interpreter_command127 = Game_Interpreter.prototype.command127; // Change Weapons
    Game_Interpreter.prototype.command127 = function(params) {
        if (this._isSyncEvent) return true; 
        return _Game_Interpreter_command127.call(this, params);
    };

    var _Game_Interpreter_command128 = Game_Interpreter.prototype.command128; // Change Armors
    Game_Interpreter.prototype.command128 = function(params) {
        if (this._isSyncEvent) return true; 
        return _Game_Interpreter_command128.call(this, params);
    };

    var _Game_Interpreter_command311 = Game_Interpreter.prototype.command311; // Change HP
    Game_Interpreter.prototype.command311 = function(params) {
        if (this._isSyncEvent) return true; 
        return _Game_Interpreter_command311.call(this, params);
    };

})();
