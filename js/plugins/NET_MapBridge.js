/*:
 * @plugindesc Server-Authoritative Map Sync — fluid movement and followers.
 * @author Antigravity
 *
 * @help
 * NET_MapBridge syncs player coordinates to the server and renders
 * sprites for other connected players and their followers.
 */

(function() {
    'use strict';

    // =========================================================================
    // 0. Background Execution (Web Worker)
    // =========================================================================
    (function() {
        const TARGET_FPS = 60;
        const INTERVAL = 1000 / TARGET_FPS;
        const STALL_THRESHOLD = 50;

        let _lastRafTick = performance.now();
        let _gameLoopStarted = false;

        const _original_onTick = Graphics._onTick;
        Graphics._onTick = function(deltaTime) {
            _lastRafTick = performance.now();
            _original_onTick.call(this, deltaTime);
        };

        const workerCode = `
            let timerId;
            self.onmessage = function(e) {
                if (e.data.action === 'start') {
                    timerId = setInterval(() => self.postMessage('tick'), e.data.interval);
                }
            };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = function() {
            if (!_gameLoopStarted) return;
            const now = performance.now();
            const sinceLast = now - _lastRafTick;

            if (sinceLast >= STALL_THRESHOLD) {
                const deltaTime = sinceLast / (1000 / 60);
                const cappedDelta = Math.min(deltaTime, 3.0);
                _original_onTick.call(Graphics, cappedDelta);
                _lastRafTick = performance.now(); 
            }
        };

        const _Graphics_startGameLoop = Graphics.startGameLoop;
        Graphics.startGameLoop = function() {
            _Graphics_startGameLoop.call(this);
            if (!_gameLoopStarted) {
                _gameLoopStarted = true;
                _lastRafTick = performance.now();
                worker.postMessage({ action: 'start', interval: INTERVAL });
            }
        };
    })();

    // =========================================================================
    // 1. Game_NetPlayer & Followers
    // =========================================================================
    function Game_NetPlayer() {
        this.initialize.apply(this, arguments);
    }

    Game_NetPlayer.prototype = Object.create(Game_CharacterBase.prototype);
    Game_NetPlayer.prototype.constructor = Game_NetPlayer;

    Game_NetPlayer.prototype.initialize = function(netData) {
        Game_CharacterBase.prototype.initialize.call(this);
        this._netId = netData.id;
        var startX = netData.realX !== undefined ? netData.realX : netData.x;
        var startY = netData.realY !== undefined ? netData.realY : netData.y;
        this._targetX = startX;
        this._targetY = startY;
        this._realX = startX;
        this._realY = startY;
        this.setPosition(Math.round(startX), Math.round(startY));
        this.setDirection(netData.direction || 2);
        this.setMoveSpeed(netData.speed || 4);
        this.setImage(netData.characterName, netData.characterIndex);
        this.setThrough(true);
        this._isMovingNet = !!netData.isMoving;
        this._lastTargetTimestamp = performance.now();

        this._followers = [];
        this._updateFollowers(netData.followers || []);
    };

    Game_NetPlayer.prototype.syncFromServer = function(data) {
        this.setImage(data.characterName, data.characterIndex);
        this.setDirection(data.direction);
        this.setMoveSpeed(data.speed || 4);
        this._isMovingNet = !!data.isMoving;
        this._lastTargetTimestamp = performance.now();
        
        var targetX = data.realX !== undefined ? data.realX : data.x;
        var targetY = data.realY !== undefined ? data.realY : data.y;
        this._targetX = targetX;
        this._targetY = targetY;

        var dist = Math.abs(targetX - this._realX) + Math.abs(targetY - this._realY);
        if (dist > 3) {
            this.setPosition(Math.round(targetX), Math.round(targetY));
            this._realX = targetX;
            this._realY = targetY;
        }

        this._updateFollowers(data.followers || []);
    };

    Game_NetPlayer.prototype._updateFollowers = function(followersData) {
        for (var i = 0; i < followersData.length; i++) {
            if (!this._followers[i]) {
                var f = new Game_NetFollower(this, i, followersData[i]);
                this._followers.push(f);
                if (window._injectNetSprite) window._injectNetSprite(f);
            }
            this._followers[i].syncFollower(followersData[i]);
        }
        while (this._followers.length > followersData.length) {
            var fToRemove = this._followers.pop();
            if (window._removeNetSprite) window._removeNetSprite(fToRemove._spriteId);
        }
    };

    Game_NetPlayer.prototype.isMoving = function() {
        return this._isMovingNet || Math.abs(this._targetX - this._realX) > 0.03 || Math.abs(this._targetY - this._realY) > 0.03;
    };

    Game_NetPlayer.prototype.update = function() {
        var now = performance.now();
        var elapsedMs = Math.max(0, now - (this._lastTargetTimestamp || now));
        var predictedLead = Math.min((elapsedMs / 1000) * 2.0, 0.3);

        var px = this._targetX;
        var py = this._targetY;
        if (this._isMovingNet) {
            if (this._direction === 6) px += predictedLead;
            else if (this._direction === 4) px -= predictedLead;
            else if (this._direction === 2) py += predictedLead;
            else if (this._direction === 8) py -= predictedLead;
        }

        var dx = px - this._realX;
        var dy = py - this._realY;
        var distance = Math.abs(dx) + Math.abs(dy);

        if (distance > 3) {
            this._realX = this._targetX;
            this._realY = this._targetY;
            this._x = Math.round(this._targetX);
            this._y = Math.round(this._targetY);
        } else if (distance > 0.001) {
            var factor = distance > 1.5 ? 0.55 : 0.35;
            this._realX += dx * factor;
            this._realY += dy * factor;
            this._x = Math.round(this._realX);
            this._y = Math.round(this._realY);
        }

        if (Math.abs(this._targetX - this._realX) < 0.03 && Math.abs(this._targetY - this._realY) < 0.03) {
            this._realX = this._targetX;
            this._realY = this._targetY;
            this._x = Math.round(this._targetX);
            this._y = Math.round(this._targetY);
            if (!this._isMovingNet) {
                this._stopCount++;
            }
        } else {
            this.resetStopCount();
        }

        this.updateAnimation();

        for (var i = 0; i < this._followers.length; i++) {
            this._followers[i].update();
        }
    };

    Game_NetPlayer.prototype.isNormalPriority = function() { return true; };
    Game_NetPlayer.prototype.scrolledX = function() { return $gameMap.adjustX(this._realX); };
    Game_NetPlayer.prototype.scrolledY = function() { return $gameMap.adjustY(this._realY); };


    // -- Follower Class --
    function Game_NetFollower() {
        this.initialize.apply(this, arguments);
    }
    Game_NetFollower.prototype = Object.create(Game_CharacterBase.prototype);
    Game_NetFollower.prototype.constructor = Game_NetFollower;

    Game_NetFollower.prototype.initialize = function(leader, index, data) {
        Game_CharacterBase.prototype.initialize.call(this);
        this._leader = leader;
        this._index = index;
        this._spriteId = 'follower_' + leader._netId + '_' + index;
        this.setThrough(true);
        var startX = (data && data.realX !== undefined) ? data.realX : (data ? data.x : leader._realX);
        var startY = (data && data.realY !== undefined) ? data.realY : (data ? data.y : leader._realY);
        this._targetX = startX;
        this._targetY = startY;
        this._realX = startX;
        this._realY = startY;
        this.setPosition(Math.round(startX), Math.round(startY));
        if (data) {
            this.setImage(data.characterName, data.characterIndex);
            this.setDirection(data.direction || 2);
        }
    };

    Game_NetFollower.prototype.syncFollower = function(data) {
        this.setImage(data.characterName, data.characterIndex);
        if (data.direction) this.setDirection(data.direction);
        this.setMoveSpeed(this._leader.moveSpeed());

        var targetX = data.realX !== undefined ? data.realX : data.x;
        var targetY = data.realY !== undefined ? data.realY : data.y;
        if (targetX !== undefined && targetY !== undefined) {
            this._targetX = targetX;
            this._targetY = targetY;

            var dist = Math.abs(targetX - this._realX) + Math.abs(targetY - this._realY);
            if (dist > 3) {
                this.setPosition(Math.round(targetX), Math.round(targetY));
                this._realX = targetX;
                this._realY = targetY;
            }
        }
    };

    Game_NetFollower.prototype.isMoving = function() {
        return Math.abs(this._targetX - this._realX) > 0.03 || Math.abs(this._targetY - this._realY) > 0.03;
    };

    Game_NetFollower.prototype.update = function() {
        var dx = this._targetX - this._realX;
        var dy = this._targetY - this._realY;
        var distance = Math.abs(dx) + Math.abs(dy);

        if (distance > 3) {
            this._realX = this._targetX;
            this._realY = this._targetY;
            this._x = Math.round(this._targetX);
            this._y = Math.round(this._targetY);
        } else if (distance > 0.001) {
            var factor = distance > 1.5 ? 0.55 : 0.35;
            this._realX += dx * factor;
            this._realY += dy * factor;
            this._x = Math.round(this._realX);
            this._y = Math.round(this._realY);
        }

        if (Math.abs(this._targetX - this._realX) < 0.03 && Math.abs(this._targetY - this._realY) < 0.03) {
            this._realX = this._targetX;
            this._realY = this._targetY;
            this._x = Math.round(this._targetX);
            this._y = Math.round(this._targetY);
            this._stopCount++;
        } else {
            this.resetStopCount();
        }

        this.updateAnimation();
    };

    Game_NetFollower.prototype.isNormalPriority = function() { return true; };
    Game_NetFollower.prototype.scrolledX = function() { return $gameMap.adjustX(this._realX); };
    Game_NetFollower.prototype.scrolledY = function() { return $gameMap.adjustY(this._realY); };

    // =========================================================================
    // 2. Registry
    // =========================================================================
    var _netPlayers = {};   // id -> Game_NetPlayer
    var _netSprites = {};   // id -> Sprite_Character

    function clearRegistry() {
        Object.keys(_netSprites).forEach(function(id) {
            window._removeNetSprite(id);
        });
        _netPlayers = {};
        _netSprites = {};
    }

    window._injectNetSprite = function(character, targetSpriteset) {
        var id = character._netId || character._spriteId;
        var spriteset = targetSpriteset || (SceneManager._scene && SceneManager._scene._spriteset);
        if (!spriteset || !spriteset._tilemap) return;

        if (_netSprites[id] && _netSprites[id].parent === spriteset._tilemap) {
            return;
        }

        if (_netSprites[id]) {
            if (_netSprites[id].parent) {
                _netSprites[id].parent.removeChild(_netSprites[id]);
            }
            delete _netSprites[id];
        }

        var sprite = new Sprite_Character(character);
        _netSprites[id] = sprite;
        spriteset._tilemap.addChild(sprite);
        if (spriteset._characterSprites && !spriteset._characterSprites.includes(sprite)) {
            spriteset._characterSprites.push(sprite);
        }
    };

    window._removeNetSprite = function(id) {
        if (_netSprites[id]) {
            var spriteset = SceneManager._scene && SceneManager._scene._spriteset;
            if (spriteset && spriteset._tilemap) {
                spriteset._tilemap.removeChild(_netSprites[id]);
            }
            if (spriteset && spriteset._characterSprites) {
                var idx = spriteset._characterSprites.indexOf(_netSprites[id]);
                if (idx >= 0) spriteset._characterSprites.splice(idx, 1);
            }
            delete _netSprites[id];
        }
    };

    function addNetPlayer(pData) {
        var np = new Game_NetPlayer(pData);
        _netPlayers[pData.id] = np;
        window._injectNetSprite(np);
        np._followers.forEach(function(f) { window._injectNetSprite(f); });
    }

    function removeNetPlayer(id) {
        if (_netPlayers[id]) {
            _netPlayers[id]._followers.forEach(function(f) { window._removeNetSprite(f._spriteId); });
        }
        window._removeNetSprite(id);
        delete _netPlayers[id];
    }

    // =========================================================================
    // 3. Handle MAP_UPDATE_RES
    // =========================================================================
    window.NET.Client.on('MAP_UPDATE_RES', function(data) {
        if (!data || !data.payload || !data.payload.players) return;
        if (!$gameMap || !$gamePlayer || !$gameMap.mapId()) return;

        var currentMapId = $gameMap.mapId();
        var players = data.payload.players;
        var receivedIds = {};
        players.forEach(function(pData) {
            if (pData.mapId !== undefined && pData.mapId !== currentMapId) return;
            receivedIds[pData.id] = true;
            if (_netPlayers[pData.id]) {
                _netPlayers[pData.id].syncFromServer(pData);
            } else {
                addNetPlayer(pData);
            }
        });

        Object.keys(_netPlayers).forEach(function(id) {
            if (!receivedIds[id]) removeNetPlayer(id);
        });
    });

    // =========================================================================
    // 4. Spriteset Hook
    // =========================================================================
    var _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters = function() {
        _Spriteset_Map_createCharacters.call(this);
        _netSprites = {};
        var self = this;
        Object.keys(_netPlayers).forEach(function(id) {
            var np = _netPlayers[id];
            window._injectNetSprite(np, self);
            np._followers.forEach(function(f) { window._injectNetSprite(f, self); });
        });
    };

    // =========================================================================
    // 5. Update Loop & Scene Lifecycle
    // =========================================================================
    var _Scene_Map_updateMain = Scene_Map.prototype.updateMain;
    Scene_Map.prototype.updateMain = function() {
        _Scene_Map_updateMain.call(this);
        Object.keys(_netPlayers).forEach(function(id) {
            _netPlayers[id].update();
        });
    };

    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        _lastSentX = null;
        _lastSentY = null;
        _lastSentDir = null;
        _lastSentAt = 0;
        var now = performance.now();
        Object.keys(_netPlayers).forEach(function(id) {
            if (_netPlayers[id]) {
                _netPlayers[id]._lastTargetTimestamp = now;
            }
        });
    };

    var _Scene_Map_terminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function() {
        _Scene_Map_terminate.call(this);
        _netSprites = {};
    };

    var _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        _Game_Map_setup.call(this, mapId);
        clearRegistry();
    };

    var _Scene_Title_start = Scene_Title.prototype.start;
    Scene_Title.prototype.start = function() {
        _Scene_Title_start.call(this);
        clearRegistry();
    };

    if (window.NET && NET.Client) {
        NET.Client.on('disconnected', function() {
            clearRegistry();
        });
    }

    // =========================================================================
    // 6. Send Move Request
    // =========================================================================
    var _lastSentX = null;
    var _lastSentY = null;
    var _lastSentDir = null;
    var _lastSentAt = 0;
    var _wasMoving = false;
    var SEND_INTERVAL_MS = 50; // 20 updates per second for super-fluid sync

    var _Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _Game_Player_update.call(this, sceneActive);

        if (!window.NET || !NET.Client || !NET.Client.isConnected) return;
        if (!$gameMap) return;

        var mapId = $gameMap.mapId();
        var x = this.x;
        var y = this.y;
        var dir = this.direction();
        var now = Date.now();
        var isMoving = this.isMoving();
        var followersMoving = this.followers ? this.followers().areMoving() : false;
        var movingNow = isMoving || followersMoving;

        var posChanged = (x !== _lastSentX || y !== _lastSentY || dir !== _lastSentDir);
        var changed = posChanged || movingNow || _wasMoving;
        var throttleOk = (now - _lastSentAt) >= SEND_INTERVAL_MS;

        if (changed && throttleOk) {
            _lastSentX = x;
            _lastSentY = y;
            _lastSentDir = dir;
            _lastSentAt = now;
            _wasMoving = movingNow;

            var followersData = [];
            if (this.followers && this.followers().isVisible()) {
                this.followers().visibleFollowers().forEach(function(f) {
                    followersData.push({
                        x: f.x,
                        y: f.y,
                        realX: f._realX,
                        realY: f._realY,
                        direction: f.direction(),
                        characterName: f.characterName(),
                        characterIndex: f.characterIndex()
                    });
                });
            }

            NET.Client.send({
                type: 'MAP_MOVE_REQ',
                payload: {
                    mapId: mapId,
                    x: x,
                    y: y,
                    realX: this._realX,
                    realY: this._realY,
                    isMoving: isMoving,
                    direction: dir,
                    speed: this.realMoveSpeed(),
                    characterName: this.characterName(),
                    characterIndex: this.characterIndex(),
                    followers: followersData
                }
            });
        }
    };

    // =========================================================================
    // 7. Desativar Andar por Clique (Mouse / Touch)
    // =========================================================================
    Scene_Map.prototype.isMapTouchOk = function() {
        return false;
    };

    Scene_Map.prototype.processMapTouch = function() {
        // Desativado: o jogador não anda ao clicar/tocar no mapa
    };

    Game_Temp.prototype.setDestination = function() {
        // Desativado: impede a criação de qualquer destino de clique no mapa
    };

})();
