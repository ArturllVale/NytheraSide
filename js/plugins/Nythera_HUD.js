/*:
 * @target MZ
 * @plugindesc Compact Pixel-Style MMORPG HUD (Fiel ao Protótipo)
 * @author Antigravity
 *
 * @help Nythera_HUD.js
 *
 * Interface compacta perfeitamente integrada ao estilo pixel art:
 * - HUD Principal compacta (Avatar, Lv, Nome, Pílulas de HP Verde, MP Azul e EXP)
 * - HUD de Acompanhantes compacta (Cards menores com avatar, nome, nível e HP verde)
 * - Minimapa discreto e funcional
 * - Nameplates no mapa com barra de HP verde compacta
 */

(() => {
    'use strict';

    // =========================================================================
    // DRAWING HELPERS (Capsules & Pixel-Friendly Panels)
    // =========================================================================
    const UI = {
        // Capsule / Pill shape (fully rounded ends)
        drawPill(ctx, x, y, w, h) {
            const r = h / 2;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(x + r, y + h);
            ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
            ctx.closePath();
        },

        // Rounded box with custom radius
        roundRect(ctx, x, y, w, h, r = 6) {
            if (w < 2 * r) r = w / 2;
            if (h < 2 * r) r = h / 2;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        },

        // Clean dark container matching the reference screenshot
        drawContainer(ctx, x, y, w, h, radius = 8) {
            ctx.save();
            this.roundRect(ctx, x, y, w, h, radius);

            // Dark navy/slate background
            const bg = ctx.createLinearGradient(x, y, x, y + h);
            bg.addColorStop(0, 'rgba(12, 21, 34, 0.92)');
            bg.addColorStop(1, 'rgba(8, 14, 24, 0.96)');
            ctx.fillStyle = bg;
            ctx.fill();

            // Subtle dark blue border
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(32, 62, 96, 0.9)';
            ctx.stroke();

            // 1px inner soft highlight on top edge
            ctx.beginPath();
            ctx.moveTo(x + radius, y + 1);
            ctx.lineTo(x + w - radius, y + 1);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
        },

        // Pill-shaped status bar (exact style as in screenshot)
        drawPillBar(ctx, x, y, w, h, current, max, type = 'HP', label = '', customText = '') {
            ctx.save();

            // 1. Background Well (Dark recessed capsule)
            this.drawPill(ctx, x, y, w, h);
            ctx.fillStyle = 'rgba(7, 12, 20, 0.95)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.stroke();

            // 2. Filled Portion
            const rate = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
            const fillW = Math.max(0, Math.floor(w * rate));

            if (fillW >= 4) {
                ctx.save();
                this.drawPill(ctx, x, y, w, h);
                ctx.clip(); // Ensure fill respects the capsule bounds

                this.drawPill(ctx, x, y, fillW, h);
                const grad = ctx.createLinearGradient(x, y, x, y + h);

                if (type === 'HP') {
                    // VERDE (Green)
                    grad.addColorStop(0, '#4ade80'); // bright green highlight
                    grad.addColorStop(0.3, '#22c55e');
                    grad.addColorStop(0.8, '#16a34a');
                    grad.addColorStop(1, '#15803d');
                } else if (type === 'MP') {
                    // AZUL (Blue)
                    grad.addColorStop(0, '#60a5fa'); // bright blue highlight
                    grad.addColorStop(0.3, '#3b82f6');
                    grad.addColorStop(0.8, '#2563eb');
                    grad.addColorStop(1, '#1d4ed8');
                } else {
                    // EXP (Sky Blue / Cyan)
                    grad.addColorStop(0, '#93c5fd');
                    grad.addColorStop(0.5, '#60a5fa');
                    grad.addColorStop(1, '#3b82f6');
                }

                ctx.fillStyle = grad;
                ctx.fill();

                // Specular gloss line on top half
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.fillRect(x, y + 1, fillW, Math.floor(h * 0.35));

                ctx.restore();
            }

            // 3. Texts inside the bar (Clean, pixel-compatible typography)
            ctx.font = `bold ${Math.max(9, Math.floor(h * 0.72))}px sans-serif`;
            ctx.textBaseline = 'middle';

            // Left Label (e.g. "HP" or "MP")
            if (label) {
                const labelX = x + 8;
                const textY = y + h / 2;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillText(label, labelX + 1, textY + 1);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(label, labelX, textY);
            }

            // Right Numbers (e.g. "2450 / 2450" or "62%")
            const valueText = customText || `${current} / ${max}`;
            const textRightX = x + w - 8;
            const textY = y + h / 2;

            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillText(valueText, textRightX + 1, textY + 1);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(valueText, textRightX, textY);
            ctx.textAlign = 'left';

            ctx.restore();
        }
    };

    // =========================================================================
    // SPRITE: MAIN HUD & COMPANIONS
    // =========================================================================
    function Sprite_NytheraHUD() {
        this.initialize(...arguments);
    }

    Sprite_NytheraHUD.prototype = Object.create(Sprite.prototype);
    Sprite_NytheraHUD.prototype.constructor = Sprite_NytheraHUD;

    Sprite_NytheraHUD.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this.createSubSprites();
        this._lastHp = -1;
        this._lastMp = -1;
        this._lastExp = -1;
        this._lastPartyHp = [];
        this._lastPartyCount = 0;
        this._lastPlayerX = -1;
        this._lastPlayerY = -1;
        this.refresh();
    };

    Sprite_NytheraHUD.prototype.createSubSprites = function() {
        // Main HUD container: compact (260x88px)
        this._mainHudSprite = new Sprite(new Bitmap(270, 96));
        this._mainHudSprite.x = 12;
        this._mainHudSprite.y = 12;
        this.addChild(this._mainHudSprite);

        // Companions container: compact (160x180px)
        this._partyHudSprite = new Sprite(new Bitmap(170, 200));
        this._partyHudSprite.x = 12;
        this._partyHudSprite.y = 106;
        this.addChild(this._partyHudSprite);

        // Minimap container: compact (140x160px)
        this._minimapSprite = new Sprite(new Bitmap(150, 170));
        this._minimapSprite.x = Graphics.width - 156;
        this._minimapSprite.y = 12;
        this.addChild(this._minimapSprite);
    };

    Sprite_NytheraHUD.prototype.update = function() {
        Sprite.prototype.update.call(this);

        if (this.needsRefresh()) {
            this.refresh();
        }

        this.updateMinimap();
    };

    Sprite_NytheraHUD.prototype.needsRefresh = function() {
        const leader = $gameParty.leader();
        if (!leader) return false;

        if (this._lastHp !== leader.hp || this._lastMp !== leader.mp || this._lastExp !== leader.currentExp()) {
            this._lastHp = leader.hp;
            this._lastMp = leader.mp;
            this._lastExp = leader.currentExp();
            return true;
        }

        const members = $gameParty.members();
        if (this._lastPartyCount !== members.length) {
            this._lastPartyCount = members.length;
            return true;
        }

        for (let i = 1; i < members.length; i++) {
            if (this._lastPartyHp[i] !== members[i].hp) {
                this._lastPartyHp[i] = members[i].hp;
                return true;
            }
        }

        return false;
    };

    Sprite_NytheraHUD.prototype.refresh = function() {
        if (!$gameParty.leader()) return;
        this.drawMainHud();
        this.drawPartyHud();
    };

    // -------------------------------------------------------------------------
    // RENDER: COMPACT MAIN CHARACTER HUD (Fiel ao Protótipo)
    // -------------------------------------------------------------------------
    Sprite_NytheraHUD.prototype.drawMainHud = function() {
        const bmp = this._mainHudSprite.bitmap;
        bmp.clear();
        const ctx = bmp.context;
        const leader = $gameParty.leader();

        const boxW = 256;
        const boxH = 84;
        const radius = 10;

        // 1. Container Panel
        UI.drawContainer(ctx, 0, 0, boxW, boxH, radius);

        // 2. Portrait (Left Well)
        const avX = 7;
        const avY = 7;
        const avSize = 70;
        const avR = 8;

        ctx.save();
        UI.roundRect(ctx, avX, avY, avSize, avSize, avR);
        ctx.fillStyle = 'rgba(5, 10, 18, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(30, 60, 95, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.save();
        UI.roundRect(ctx, avX + 1, avY + 1, avSize - 2, avSize - 2, avR - 1);
        ctx.clip();

        const faceName = leader.faceName();
        const faceIndex = leader.faceIndex();
        if (faceName) {
            const faceBmp = ImageManager.loadFace(faceName);
            if (faceBmp.isReady()) {
                const sw = ImageManager.faceWidth;
                const sh = ImageManager.faceHeight;
                const sx = (faceIndex % 4) * sw;
                const sy = Math.floor(faceIndex / 4) * sh;
                ctx.drawImage(faceBmp.image, sx, sy, sw, sh, avX, avY, avSize, avSize);
            } else {
                faceBmp.addLoadListener(() => this.drawMainHud());
            }
        }
        ctx.restore();
        ctx.restore();

        // 3. Header: Level & Name
        const barX = 84;
        const barW = 164;

        ctx.save();
        ctx.font = 'bold 13px sans-serif';
        ctx.textBaseline = 'top';

        // Lv. 35
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(`Lv. ${leader.level}`, barX + 1, 9);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Lv. ${leader.level}`, barX, 8);

        // Arthas
        const nameX = barX + 50;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(leader.name(), nameX + 1, 9);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(leader.name(), nameX, 8);
        ctx.restore();

        // 4. HP Bar (VERDE - Pill Shape)
        UI.drawPillBar(ctx, barX, 26, barW, 15, leader.hp, leader.mhp, 'HP', 'HP');

        // 5. MP Bar (AZUL - Pill Shape)
        UI.drawPillBar(ctx, barX, 44, barW, 15, leader.mp, leader.mmp, 'MP', 'MP');

        // 6. EXP Bar (Sky Blue / Cyan Pill)
        const curLvlExp = leader.currentLevelExp();
        const nextLvlExp = leader.nextLevelExp();
        const exp = Math.max(0, leader.currentExp() - curLvlExp);
        const maxExp = Math.max(1, nextLvlExp - curLvlExp);
        const percent = Math.floor((exp / maxExp) * 100);

        // EXP text label outside
        ctx.save();
        ctx.font = 'bold 10px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('EXP', barX, 68);

        // EXP fill pill
        const expBarX = barX + 26;
        const expBarW = barW - 26;
        UI.drawPillBar(ctx, expBarX, 62, expBarW, 12, exp, maxExp, 'EXP', '', `${percent}%`);
        ctx.restore();

        bmp._baseTexture.update();
    };

    // -------------------------------------------------------------------------
    // RENDER: COMPANIONS HUD (Fiel ao Protótipo)
    // -------------------------------------------------------------------------
    Sprite_NytheraHUD.prototype.drawPartyHud = function() {
        const bmp = this._partyHudSprite.bitmap;
        bmp.clear();
        const ctx = bmp.context;
        const members = $gameParty.members();

        let cardY = 0;
        const cardW = 140;
        const cardH = 38;
        const gap = 4;

        for (let i = 1; i < members.length; i++) {
            const actor = members[i];
            if (!actor) continue;

            // 1. Companion Card Container
            UI.drawContainer(ctx, 0, cardY, cardW, cardH, 6);

            // 2. Mini Avatar (Left)
            const avX = 4;
            const avY = cardY + 4;
            const avSize = 30;

            ctx.save();
            UI.roundRect(ctx, avX, avY, avSize, avSize, 4);
            ctx.fillStyle = 'rgba(5, 10, 18, 0.9)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(30, 60, 95, 0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.save();
            UI.roundRect(ctx, avX + 1, avY + 1, avSize - 2, avSize - 2, 3);
            ctx.clip();

            const faceName = actor.faceName();
            const faceIndex = actor.faceIndex();
            if (faceName) {
                const faceBmp = ImageManager.loadFace(faceName);
                if (faceBmp.isReady()) {
                    const sw = ImageManager.faceWidth;
                    const sh = ImageManager.faceHeight;
                    const sx = (faceIndex % 4) * sw;
                    const sy = Math.floor(faceIndex / 4) * sh;
                    ctx.drawImage(faceBmp.image, sx, sy, sw, sh, avX, avY, avSize, avSize);
                }
            }
            ctx.restore();
            ctx.restore();

            // 3. Name & Level
            const textX = 39;
            ctx.save();
            ctx.font = 'bold 11px sans-serif';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(actor.name(), textX, cardY + 4);

            ctx.font = '9px sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(`Lv. ${actor.level}`, textX, cardY + 16);
            ctx.restore();

            // 4. Compact HP Bar (Pill Verde)
            const barX = textX;
            const barY = cardY + 27;
            const barW = cardW - barX - 6;
            const barH = 6;

            UI.drawPillBar(ctx, barX, barY, barW, barH, actor.hp, actor.mhp, 'HP', '', '');

            this._lastPartyHp[i] = actor.hp;
            cardY += cardH + gap;
        }

        bmp._baseTexture.update();
    };

    // -------------------------------------------------------------------------
    // RENDER: COMPACT MINIMAP (60 FPS Fluido com Cache e Sub-Pixel Smoothing)
    // -------------------------------------------------------------------------
    Sprite_NytheraHUD.prototype.buildMapCache = function() {
        if (!$gameMap) return;
        this._cachedMapId = $gameMap.mapId();
        this._scale = 4; // 4px por tile
        const scale = this._scale;
        const mapW = $gameMap.width();
        const mapH = $gameMap.height();

        // Criação de bitmap offscreen com a renderização prévia do mapa
        this._cachedMapBitmap = new Bitmap(mapW * scale, mapH * scale);
        const cctx = this._cachedMapBitmap.context;

        for (let x = 0; x < mapW; x++) {
            for (let y = 0; y < mapH; y++) {
                const isPassable = $gameMap.isPassable(x, y, 2) ||
                                  $gameMap.isPassable(x, y, 4) ||
                                  $gameMap.isPassable(x, y, 6) ||
                                  $gameMap.isPassable(x, y, 8);

                if (isPassable) {
                    cctx.fillStyle = (x + y) % 2 === 0 ? '#1e382b' : '#234434';
                } else {
                    cctx.fillStyle = '#0f172a';
                }
                cctx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    };

    Sprite_NytheraHUD.prototype.updateMinimap = function() {
        if (!$gameMap || !$gamePlayer) return;

        // Constrói o cache apenas quando entra em um novo mapa
        if (this._cachedMapId !== $gameMap.mapId() || !this._cachedMapBitmap) {
            this.buildMapCache();
        }

        const bmp = this._minimapSprite.bitmap;
        bmp.clear();
        const ctx = bmp.context;

        const cx = 70;
        const cy = 68;
        const radius = 54;
        const scale = this._scale || 4;

        // Posição contínua de ponto flutuante (sub-tile) para movimento 100% fluido a 60 FPS
        const px = $gamePlayer._realX;
        const py = $gamePlayer._realY;

        ctx.save();

        // 1. Viewport do Radar (Círculo com Clip)
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#0a121e';
        ctx.fill();
        ctx.save();
        ctx.clip();

        // Desenha o terreno do cache pré-renderizado sem nenhum peso de CPU por frame
        if (this._cachedMapBitmap && this._cachedMapBitmap._canvas) {
            const drawX = Math.round(cx - px * scale);
            const drawY = Math.round(cy - py * scale);
            ctx.drawImage(this._cachedMapBitmap._canvas, drawX, drawY);
        }

        // Anel sutil de alcance
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        // Marcadores de Eventos (NPCs e Inimigos) com interpolação suave
        const events = $gameMap.events();
        for (const ev of events) {
            if (!ev || ev.isTransparent() || ev._erased) continue;
            const edx = (ev._realX - px) * scale;
            const edy = (ev._realY - py) * scale;

            if (edx * edx + edy * edy <= (radius - 2) * (radius - 2)) {
                const ex = Math.round(cx + edx);
                const ey = Math.round(cy + edy);
                const isNpc = ev.event() && ev.event().name && ev.event().name.startsWith('NPC:');

                ctx.beginPath();
                ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = isNpc ? '#fbbf24' : '#ef4444';
                ctx.fill();
            }
        }

        // Marcador do Jogador (Seta em ciano no centro)
        ctx.save();
        ctx.translate(cx, cy);
        let angle = 0;
        const dir = $gamePlayer.direction();
        if (dir === 8) angle = -Math.PI / 2;
        else if (dir === 2) angle = Math.PI / 2;
        else if (dir === 4) angle = Math.PI;
        else if (dir === 6) angle = 0;
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.restore();

        ctx.restore(); // Fim do clip

        // 2. Aro Metálico Discreto
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(38, 70, 110, 0.9)';
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
        ctx.stroke();

        // Marcador Norte
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('N', cx, cy - radius + 7);

        // 3. Placa de Localidade e Coordenadas
        const plaqueW = 124;
        const plaqueH = 18;
        const plaqueX = cx - plaqueW / 2;
        const plaqueY = cy + radius + 6;

        UI.drawContainer(ctx, plaqueX, plaqueY, plaqueW, plaqueH, 4);

        const mapName = ($gameMap && $gameMap.displayName()) || 'Mapa';
        const coords = `${$gamePlayer.x}, ${$gamePlayer.y}`;

        ctx.font = '9px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(mapName, plaqueX + 6, plaqueY + plaqueH / 2);

        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'right';
        ctx.fillText(coords, plaqueX + plaqueW - 6, plaqueY + plaqueH / 2);

        ctx.restore();
        bmp._baseTexture.update();
    };

    // =========================================================================
    // SCENE HOOKS
    // =========================================================================
    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        this.createNytheraHUD();
    };

    Scene_Map.prototype.createNytheraHUD = function() {
        this._nytheraHUD = new Sprite_NytheraHUD();
        this.addChild(this._nytheraHUD);
    };

    Window_MapName.prototype.open = function() {};

    // =========================================================================
    // PHASE 2: RAGNAROK-STYLE NAMEPLATES & FOOT BARS (HP VERDE / MP AZUL)
    // =========================================================================

    // 1. Nameplate (Acima da cabeça)
    function Sprite_CharacterName() {
        this.initialize(...arguments);
    }

    Sprite_CharacterName.prototype = Object.create(Sprite.prototype);
    Sprite_CharacterName.prototype.constructor = Sprite_CharacterName;

    Sprite_CharacterName.prototype.initialize = function(character) {
        Sprite.prototype.initialize.call(this);
        this._character = character;
        this.bitmap = new Bitmap(130, 20);
        this.anchor.x = 0.5;
        this.anchor.y = 1;
        this.y = -48; // Flutuando sobre a cabeça
        this.z = 8;
        this._lastName = '';
        this._lastColor = '';
    };

    Sprite_CharacterName.prototype.update = function() {
        Sprite.prototype.update.call(this);
        if (this._character) {
            this.updateBitmap();
        }
    };

    Sprite_CharacterName.prototype.updateBitmap = function() {
        let name = '';
        let color = '#ffffff';

        if (this._character === $gamePlayer) {
            const actor = $gameParty.leader();
            if (actor) {
                name = actor.name();
                color = '#ffffff';
            }
        } else if (this._character instanceof Game_Follower) {
            const actor = this._character.actor();
            if (actor) {
                name = actor.name();
                color = '#e2e8f0';
            }
        } else if (this._character instanceof Game_Event) {
            const event = this._character.event();
            if (event && event.name) {
                if (event.name.startsWith('NPC:')) {
                    name = event.name.replace('NPC:', '').trim();
                    color = '#fef08a';
                } else if (event.name.startsWith('Enemy:')) {
                    name = event.name.replace('Enemy:', '').trim();
                    color = '#fca5a5';
                }
            }
        }

        if (this._lastName !== name || this._lastColor !== color) {
            this._lastName = name;
            this._lastColor = color;
            this.redraw(name, color);
        }
    };

    Sprite_CharacterName.prototype.redraw = function(name, color) {
        this.bitmap.clear();
        if (!name) return;

        const ctx = this.bitmap.context;
        const cx = 65;
        const cy = 10;

        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Contorno preto nítido estilo pixel
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.lineWidth = 2.5;
        ctx.strokeText(name, cx, cy);

        // Texto principal
        ctx.fillStyle = color;
        ctx.fillText(name, cx, cy);
        ctx.restore();

        this.bitmap._baseTexture.update();
    };

    // 2. Barrinhas aos Pés (Estilo Ragnarok: Verde HP / Azul MP / Sem números)
    function Sprite_CharacterFootBars() {
        this.initialize(...arguments);
    }

    Sprite_CharacterFootBars.prototype = Object.create(Sprite.prototype);
    Sprite_CharacterFootBars.prototype.constructor = Sprite_CharacterFootBars;

    Sprite_CharacterFootBars.prototype.initialize = function(character) {
        Sprite.prototype.initialize.call(this);
        this._character = character;
        this.bitmap = new Bitmap(40, 12);
        this.anchor.x = 0.5;
        this.anchor.y = 0;
        this.y = 2; // Exatamente abaixo dos pés do sprite
        this.z = 7;
        this.opacity = 0; // Invisível por padrão
        this.visible = false;
        this._lastHp = -1;
        this._lastMaxHp = -1;
        this._lastMp = -1;
        this._lastMaxMp = -1;
    };

    Sprite_CharacterFootBars.prototype.update = function() {
        Sprite.prototype.update.call(this);
        if (this._character) {
            this.updateHover();
            this.updateBitmap();
        }
    };

    Sprite_CharacterFootBars.prototype.isMouseHovered = function() {
        if (!this._character || !this._character.screenX) return false;
        if (this._character.isTransparent && this._character.isTransparent()) return false;

        const mx = TouchInput.x;
        const my = TouchInput.y;
        if (mx === undefined || my === undefined || mx < 0 || my < 0) return false;

        const sx = this._character.screenX();
        const sy = this._character.screenY();

        // Verificação segura de colisão com dimensões padrão de tile (48x48)
        const halfW = 24;
        const h = 48;

        return mx >= sx - halfW && mx <= sx + halfW && my >= sy - h && my <= sy + 14;
    };

    Sprite_CharacterFootBars.prototype.updateHover = function() {
        const hovered = this.isMouseHovered();
        const targetOpacity = hovered ? 255 : 0;

        if (this.opacity < targetOpacity) {
            this.opacity = Math.min(255, this.opacity + 45);
        } else if (this.opacity > targetOpacity) {
            this.opacity = Math.max(0, this.opacity - 45);
        }

        this.visible = this.opacity > 0;
    };

    Sprite_CharacterFootBars.prototype.updateBitmap = function() {
        let hp = 0;
        let maxHp = 0;
        let mp = 0;
        let maxMp = 0;
        let show = false;

        if (this._character === $gamePlayer) {
            const actor = $gameParty.leader();
            if (actor) {
                hp = actor.hp;
                maxHp = actor.mhp;
                mp = actor.mp;
                maxMp = actor.mmp;
                show = true;
            }
        } else if (this._character instanceof Game_Follower) {
            const actor = this._character.actor();
            if (actor) {
                hp = actor.hp;
                maxHp = actor.mhp;
                mp = actor.mp;
                maxMp = actor.mmp;
                show = true;
            }
        }

        if (this._lastHp !== hp || this._lastMaxHp !== maxHp || this._lastMp !== mp || this._lastMaxMp !== maxMp) {
            this._lastHp = hp;
            this._lastMaxHp = maxHp;
            this._lastMp = mp;
            this._lastMaxMp = maxMp;
            this.redraw(hp, maxHp, mp, maxMp, show);
        }
    };

    Sprite_CharacterFootBars.prototype.redraw = function(hp, maxHp, mp, maxMp, show) {
        this.bitmap.clear();
        if (!show || maxHp <= 0) return;

        const ctx = this.bitmap.context;
        const barW = 32;
        const barH = 3;
        const barX = Math.floor((40 - barW) / 2);

        // --- BARRA DE HP (VERDE) ---
        const hpY = 1;
        // Fundo escuro (calha)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(barX, hpY, barW, barH);

        // Preenchimento Verde
        const hpRate = Math.min(1, Math.max(0, hp / maxHp));
        const hpFillW = Math.floor(barW * hpRate);
        if (hpFillW > 0) {
            ctx.fillStyle = '#22c55e'; // Verde vibrante
            ctx.fillRect(barX, hpY, hpFillW, barH);
        }

        // Borda preta de 1px
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX - 0.5, hpY - 0.5, barW + 1, barH + 1);

        // --- BARRA DE MP (AZUL) ---
        const mpY = 5;
        // Fundo escuro
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(barX, mpY, barW, barH);

        // Preenchimento Azul
        const mpRate = maxMp > 0 ? Math.min(1, Math.max(0, mp / maxMp)) : 0;
        const mpFillW = Math.floor(barW * mpRate);
        if (mpFillW > 0) {
            ctx.fillStyle = '#3b82f6'; // Azul vibrante
            ctx.fillRect(barX, mpY, mpFillW, barH);
        }

        // Borda preta de 1px
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX - 0.5, mpY - 0.5, barW + 1, barH + 1);

        this.bitmap._baseTexture.update();
    };

    // Anexar componentes ao Sprite_Character
    const _Sprite_Character_initMembers = Sprite_Character.prototype.initMembers;
    Sprite_Character.prototype.initMembers = function() {
        _Sprite_Character_initMembers.call(this);
        this._nameplateSprite = null;
        this._footBarsSprite = null;
    };

    const _Sprite_Character_setCharacter = Sprite_Character.prototype.setCharacter;
    Sprite_Character.prototype.setCharacter = function(character) {
        _Sprite_Character_setCharacter.call(this, character);
        if (this._character) {
            this.createCharacterHUD();
        }
    };

    Sprite_Character.prototype.createCharacterHUD = function() {
        if (!this._nameplateSprite) {
            this._nameplateSprite = new Sprite_CharacterName(this._character);
            this.addChild(this._nameplateSprite);
        } else {
            this._nameplateSprite._character = this._character;
        }

        if (!this._footBarsSprite) {
            this._footBarsSprite = new Sprite_CharacterFootBars(this._character);
            this.addChild(this._footBarsSprite);
        } else {
            this._footBarsSprite._character = this._character;
        }
    };

})();
