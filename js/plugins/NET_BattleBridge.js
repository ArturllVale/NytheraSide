/*:
 * @plugindesc Server-Authoritative Battle Bridge
 * @author Antigravity
 *
 * @help
 * Intercepts BattleManager and nullifies Game_Action.apply.
 */

window.NET = window.NET || {};

(function() {
  
  // 1. Nullify Local Damage Execution!
  Game_Action.prototype.apply = function(target) {
    // We only execute events sent by the server. 
    // We do NOT execute local damage logic.
    var result = target.result();
    result.clear();
    result.used = this.testApply(target);
    // Ignore makeDamageValue, executeDamage, etc.
  };

  // 2. Override BattleManager to communicate with Server
  var _BattleManager_setup = BattleManager.setup;
  BattleManager.setup = function(troopId, canEscape, canLose) {
    _BattleManager_setup.call(this, troopId, canEscape, canLose);
    
    // Tell server we are starting a battle
    NET.Client.send({
      type: 'BATTLE_START_REQ',
      troopId: troopId
    });

    this._netState = 'WAITING';
    this._netEventQueue = [];
  };

  // 3. Listen to Server Payloads
  NET.Client.on('BATTLE_UPDATE_RES', function(data) {
    // Parse the state and events
    console.log('[NET_BattleBridge] Got battle update', data);
    
    // Sync basic HP/MP states to avoid visual bugs
    // Normally we should fully deserialize state.party and state.troop
    // For MVP, we will rely on events to show visual changes, but we hard sync at end of round
    
    // Push events to the visual queue
    if (data.events && data.events.length > 0) {
      data.events.forEach(function(ev) {
        BattleManager._netEventQueue.push(ev);
      });
    }
    
    BattleManager._netState = 'ACTIVE';
  });

  // 4. Input interception
  var _Scene_Battle_commandAttack = Scene_Battle.prototype.commandAttack;
  Scene_Battle.prototype.commandAttack = function() {
    var skillId = 1; // Default attack
    var targetIndex = this._enemyWindow.index(); 
    // We need to resolve enemy ID. 
    var enemy = $gameTroop.members()[targetIndex];
    // We assume enemy ids match array index + `enemy-` prefix for MVP based on service
    var serverTargetId = 'enemy-' + targetIndex;

    NET.Client.send({
      type: 'BATTLE_COMMAND_REQ',
      command: {
        type: 'SKILL',
        skillId: skillId,
        targetId: serverTargetId
      }
    });
    
    this._actorCommandWindow.deactivate();
    BattleManager._netState = 'WAITING_SERVER_TURN';
  };

  var _Scene_Battle_commandSkill = Scene_Battle.prototype.commandSkill;
  Scene_Battle.prototype.commandSkill = function() {
    var skillId = this._itemWindow.item().id;
    var targetIndex = this._enemyWindow.index(); // assuming enemy target
    var serverTargetId = 'enemy-' + targetIndex;

    NET.Client.send({
      type: 'BATTLE_COMMAND_REQ',
      command: {
        type: 'SKILL',
        skillId: skillId,
        targetId: serverTargetId
      }
    });

    this._actorCommandWindow.deactivate();
    BattleManager._netState = 'WAITING_SERVER_TURN';
  };

  // 5. Update loop to process server events
  var _BattleManager_update = BattleManager.update;
  BattleManager.update = function() {
    if (!this.isBusy() && !this.updateEventMain()) {
      if (this._netEventQueue && this._netEventQueue.length > 0) {
        this.processNetEvent(this._netEventQueue.shift());
        return;
      }
    }
    
    // Only proceed with vanilla update if we aren't waiting for the server
    if (this._netState === 'WAITING' || this._netState === 'WAITING_SERVER_TURN') {
      return; // Freeze battle flow
    }

    _BattleManager_update.call(this);
  };

  BattleManager.processNetEvent = function(ev) {
    console.log('[NET_BattleBridge] Process Visual Event:', ev);
    // Visual translation
    
    if (ev.type === 'ACTION_START') {
      var subject = this.findBattlerById(ev.sourceId);
      if (subject) {
        this._subject = subject;
        this._logWindow.displayAction(subject, $dataSkills[ev.meta.skillId || 1]);
        subject.performAction($dataSkills[ev.meta.skillId || 1]);
      }
    }
    
    if (ev.type === 'DAMAGE' || ev.type === 'HEAL') {
      var target = this.findBattlerById(ev.targetId);
      if (target) {
        var result = target.result();
        result.clear();
        result.used = true;
        result.hpDamage = ev.type === 'DAMAGE' ? ev.value : -ev.value;
        target.gainHp(-result.hpDamage); // local execution purely for popup and gauge
        target.startDamagePopup();
        if (ev.type === 'DAMAGE') target.performDamage();
      }
    }

    if (ev.type === 'DEATH') {
      var target = this.findBattlerById(ev.targetId);
      if (target) {
        target.addState(target.deathStateId());
        target.performCollapse();
      }
    }

    if (ev.type === 'BATTLE_WON') {
      this.processVictory();
    }
    if (ev.type === 'BATTLE_LOST') {
      this.processDefeat();
    }
  };

  BattleManager.findBattlerById = function(id) {
    // Hacky resolution for MVP since we know server ids:
    if (id.indexOf('player-') > -1 || id.indexOf('-') === -1) {
      // It's the party leader for MVP
      return $gameParty.members()[0];
    } else if (id.indexOf('enemy-') > -1) {
      var idx = parseInt(id.split('-')[1]);
      return $gameTroop.members()[idx];
    }
    return null;
  };

})();
