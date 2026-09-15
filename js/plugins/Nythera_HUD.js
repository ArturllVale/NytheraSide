/*:
 * @target MZ
 * @plugindesc Modern Dark-Glass MMORPG HUD (NytheraSide Edition)
 * @author Antigravity & Artur Vale
 *
 * @help Nythera_HUD.js
 *
 * Interface moderna, compacta e elegante perfeitamente integrada ao estilo
 * e design system do NytheraSide (Dark Glassmorphism com acentos dourados):
 * - HUD Principal compacta (Avatar com moldura dourada e badge de nível, Nome, Classe, Barras de HP, MP e EXP)
 * - HUD de Acompanhantes compacta (Cards de vidro escuro com avatar, nível e barra de HP)
 * - Minimapa tático retangular em vidro escuro no canto superior direito
 * - Nameplates sobre os personagens e barras aos pés com detecção de hover
 */

(() => {
    'use strict';

    // =========================================================================
    // DRAWING HELPERS (Glassmorphic Containers & Vibrant Bars)
    // =========================================================================
    const UI = {
        // Pílula / Cápsula
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

        // Retângulo com cantos arredondados
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

        // Container Dark Glassmorphism com borda dourada elegante
        drawContainer(ctx, x, y, w, h, radius = 8, goldAccents = true) {
            ctx.save();

            // 1. Sombra projetada sutil
            ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 3;

            // 2. Fundo Dark Glass (Obsidiana / Ardósia Profundo)
            this.roundRect(ctx, x, y, w, h, radius);
            const bg = ctx.createLinearGradient(x, y, x, y + h);
            bg.addColorStop(0, 'rgba(10, 16, 28, 0.92)');
            bg.addColorStop(1, 'rgba(5, 9, 18, 0.96)');
            ctx.fillStyle = bg;
            ctx.fill();

            ctx.shadowColor = 'transparent';

            // 3. Borda fina com gradiente dourado sutil
            ctx.lineWidth = 1.2;
            const borderGrad = ctx.createLinearGradient(x, y, x + w, y + h);
            if (goldAccents) {
                borderGrad.addColorStop(0, 'rgba(247, 210, 126, 0.65)');
                borderGrad.addColorStop(0.5, 'rgba(180, 130, 50, 0.35)');
                borderGrad.addColorStop(1, 'rgba(212, 160, 62, 0.55)');
            } else {
                borderGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
                borderGrad.addColorStop(1, 'rgba(30, 58, 95, 0.4)');
            }
            ctx.strokeStyle = borderGrad;
            ctx.stroke();

            // 4. Reflexo sutil de luz na borda superior
            ctx.beginPath();
            ctx.moveTo(x + radius, y + 1);
            ctx.lineTo(x + w - radius, y + 1);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 5. Cantoneiras douradas decorativas
            if (goldAccents && radius >= 6) {
                ctx.strokeStyle = 'rgba(247, 210, 126, 0.75)';
                ctx.lineWidth = 1.5;
                const arm = 5;

                // Top-Left
                ctx.beginPath();
                ctx.moveTo(x + 2, y + 2 + arm);
                ctx.lineTo(x + 2, y + 2);
                ctx.lineTo(x + 2 + arm, y + 2);
                ctx.stroke();

                // Top-Right
                ctx.beginPath();
                ctx.moveTo(x + w - 2 - arm, y + 2);
                ctx.lineTo(x + w - 2, y + 2);
                ctx.lineTo(x + w - 2, y + 2 + arm);
                ctx.stroke();

                // Bottom-Left
                ctx.beginPath();
                ctx.moveTo(x + 2, y + h - 2 - arm);
                ctx.lineTo(x + 2, y + h - 2);
                ctx.lineTo(x + 2 + arm, y + h - 2);
                ctx.stroke();

                // Bottom-Right
                ctx.beginPath();
                ctx.moveTo(x + w - 2 - arm, y + h - 2);
                ctx.lineTo(x + w - 2, y + h - 2);
                ctx.lineTo(x + w - 2, y + h - 2 - arm);
                ctx.stroke();
            }

            ctx.restore();
        },

        // Barra de status com gradiente vibrante, brilho de vidro e números nítidos
        drawPillBar(ctx, x, y, w, h, current, max, type = 'HP', label = '', customText = '') {
            ctx.save();

            // 1. Calha escura rebaixada (Background Well)
            this.drawPill(ctx, x, y, w, h);
            ctx.fillStyle = 'rgba(4, 7, 13, 0.95)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(20, 35, 55, 0.85)';
            ctx.stroke();

            // 2. Preenchimento Vibrante com Gradiente
            const rate = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
            const fillW = Math.max(0, Math.floor(w * rate));

            if (fillW >= 4) {
                ctx.save();
                this.drawPill(ctx, x, y, w, h);
                ctx.clip(); // Garante formato de pílula

                this.drawPill(ctx, x, y, fillW, h);
                const grad = ctx.createLinearGradient(x, y, x, y + h);

                if (type === 'HP') {
                    // Esmeralda Radiante
                    grad.addColorStop(0, '#6ee7b7');
                    grad.addColorStop(0.25, '#22c55e');
                    grad.addColorStop(0.75, '#16a34a');
                    grad.addColorStop(1, '#14532d');
                } else if (type === 'MP') {
                    // Safira / Azul Azure
                    grad.addColorStop(0, '#93c5fd');
                    grad.addColorStop(0.25, '#3b82f6');
                    grad.addColorStop(0.75, '#2563eb');
                    grad.addColorStop(1, '#1e3a8a');
                } else {
                    // Ametista / EXP Roxa
                    grad.addColorStop(0, '#e9d5ff');
                    grad.addColorStop(0.25, '#c084fc');
                    grad.addColorStop(0.75, '#9333ea');
                    grad.addColorStop(1, '#581c87');
                }

                ctx.fillStyle = grad;
                ctx.fill();

                // Linha de reflexo especular no terço superior
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(x, y + 1, fillW, Math.floor(h * 0.38));

                ctx.restore();
            }

            // 3. Textos da Barra (Tipografia limpa e legível)
            ctx.font = `bold ${Math.max(9, Math.floor(h * 0.72))}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
            ctx.textBaseline = 'middle';

            // Rótulo à Esquerda ("HP", "MP", "EXP")
            if (label) {
                const labelX = x + 8;
                const textY = y + h / 2;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
                ctx.fillText(label, labelX + 1, textY + 1);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(label, labelX, textY);
            }

            // Números à Direita ("297 / 297" ou "65%")
            const valueText = customText || `${current} / ${max}`;
            const textRightX = x + w - 8;
            const textY = y + h / 2;

            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
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
        this._minimapZoomIndex = 1;
        this._minimapZooms = [0.75, 1.0, 1.5];
        this._scale = 4;

        this.createSubSprites();
        this._lastHp = -1;
        this._lastMp = -1;
        this._lastExp = -1;
        this._lastLevel = -1;
        this._lastName = '';
        this._lastFaceName = '';
        this._lastFaceIndex = -1;
        this._lastPartyHp = [];
        this._lastPartyCount = 0;
        this._lastPlayerX = -1;
        this._lastPlayerY = -1;
        this.refresh();
    };

    Sprite_NytheraHUD.prototype.createSubSprites = function() {
        // Container principal da HUD: Compacto, proporcional e elegante (296 x 96px)
        this._mainHudSprite = new Sprite(new Bitmap(304, 104));
        this._mainHudSprite.x = 14;
        this._mainHudSprite.y = 14;
        this.addChild(this._mainHudSprite);

        // Companions container: mini cards logo abaixo da HUD principal
        this._partyHudSprite = new Sprite(new Bitmap(180, 220));
        this._partyHudSprite.x = 14;
        this._partyHudSprite.y = 118;
        this.addChild(this._partyHudSprite);

        // Minimap container: Canto Superior Direito (196 x 160px)
        this._minimapSprite = new Sprite(new Bitmap(196, 160));
        this._minimapSprite.x = Graphics.width - 210;
        this._minimapSprite.y = 14;
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

        if (this._lastHp !== leader.hp ||
            this._lastMp !== leader.mp ||
            this._lastExp !== leader.currentExp() ||
            this._lastLevel !== leader.level ||
            this._lastName !== leader.name() ||
            this._lastFaceName !== leader.faceName() ||
            this._lastFaceIndex !== leader.faceIndex()) {
            this._lastHp = leader.hp;
            this._lastMp = leader.mp;
            this._lastExp = leader.currentExp();
            this._lastLevel = leader.level;
            this._lastName = leader.name();
            this._lastFaceName = leader.faceName();
            this._lastFaceIndex = leader.faceIndex();
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
    // RENDER: MAIN CHARACTER HUD (Dark Glassmorphism com Acentos Dourados)
    // -------------------------------------------------------------------------
    Sprite_NytheraHUD.prototype.drawMainHud = function() {
        const bmp = this._mainHudSprite.bitmap;
        bmp.clear();
        const ctx = bmp.context;
        const leader = $gameParty.leader();
        if (!leader) return;

        const boxW = 296;
        const boxH = 92;
        const radius = 8;

        // 1. Painel Container em Dark Glass com Acentos Dourados
        UI.drawContainer(ctx, 0, 0, boxW, boxH, radius, true);

        // 2. Avatar / Retrato (Canto Esquerdo com Moldura Dourada)
        const avX = 8;
        const avY = 8;
        const avSize = 76;
        const avR = 6;

        ctx.save();
        // Fundo do poço do avatar
        UI.roundRect(ctx, avX, avY, avSize, avSize, avR);
        ctx.fillStyle = 'rgba(4, 7, 12, 0.95)';
        ctx.fill();

        // Borda dourada do avatar
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(212, 160, 62, 0.65)';
        ctx.stroke();

        // Recorte do rosto do personagem
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

        // 3. Badge de Nível Flutuante na Base do Avatar
        const badgeW = 44;
        const badgeH = 15;
        const badgeX = avX + Math.floor((avSize - badgeW) / 2);
        const badgeY = avY + avSize - badgeH + 2;

        UI.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
        ctx.fillStyle = 'rgba(10, 15, 25, 0.94)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(247, 210, 126, 0.85)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fef08a';
        ctx.fillText(`Lv. ${leader.level}`, badgeX + badgeW / 2, badgeY + badgeH / 2);

        ctx.restore();

        // 4. Cabeçalho: Nome e Vocação/Classe
        const barX = avX + avSize + 10;
        const barW = boxW - barX - 10;

        ctx.save();
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Nome do Herói
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(leader.name(), barX, 9);

        // Classe / Vocação (ao lado do nome)
        const currentClass = leader.currentClass();
        const className = (currentClass && currentClass.name) ? currentClass.name : '';
        if (className) {
            const nameWidth = ctx.measureText(leader.name()).width;
            ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(className, barX + nameWidth + 8, 12);
        }
        ctx.restore();

        // 5. Barra de HP (Esmeralda Vibrante)
        UI.drawPillBar(ctx, barX, 29, barW, 15, leader.hp, leader.mhp, 'HP', 'HP');

        // 6. Barra de MP (Safira Azul Vibrante)
        UI.drawPillBar(ctx, barX, 48, barW, 15, leader.mp, leader.mmp, 'MP', 'MP');

        // 7. Barra de EXP (Ametista Roxa com Porcentagem)
        const curLvlExp = leader.currentLevelExp();
        const nextLvlExp = leader.nextLevelExp();
        const exp = Math.max(0, leader.currentExp() - curLvlExp);
        const maxExp = Math.max(1, nextLvlExp - curLvlExp);
        const percent = Math.floor((exp / maxExp) * 100);

        UI.drawPillBar(ctx, barX, 67, barW, 13, exp, maxExp, 'EXP', 'EXP', `${percent}%`);

        bmp._baseTexture.update();
    };

    // -------------------------------------------------------------------------
    // RENDER: COMPANIONS HUD (Mini Cards em Dark Glass)
    // -------------------------------------------------------------------------
    Sprite_NytheraHUD.prototype.drawPartyHud = function() {
        const bmp = this._partyHudSprite.bitmap;
        bmp.clear();
        const ctx = bmp.context;
        const members = $gameParty.members();

        let cardY = 0;
        const cardW = 150;
        const cardH = 40;
        const gap = 5;

        for (let i = 1; i < members.length; i++) {
            const actor = members[i];
            if (!actor) continue;

            // 1. Card Container (Dark Glass com Acentos Dourados)
            UI.drawContainer(ctx, 0, cardY, cardW, cardH, 6, true);

            // 2. Mini Avatar
            const avX = 5;
            const avY = cardY + 5;
            const avSize = 30;

            ctx.save();
            UI.roundRect(ctx, avX, avY, avSize, avSize, 4);
            ctx.fillStyle = 'rgba(4, 7, 12, 0.9)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(212, 160, 62, 0.65)';
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

            // 3. Nome e Nível
            const textX = 40;
            ctx.save();
            ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(actor.name(), textX, cardY + 5);

            ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillStyle = '#fef08a';
            ctx.fillText(`Lv. ${actor.level}`, textX, cardY + 17);
            ctx.restore();

            // 4. Barra de HP Compacta
            const barX = textX;
            const barY = cardY + 28;
            const barW = cardW - barX - 6;
            const barH = 6;

            UI.drawPillBar(ctx, barX, barY, barW, barH, actor.hp, actor.mhp, 'HP', '', '');

            this._lastPartyHp[i] = actor.hp;
            cardY += cardH + gap;
        }

        bmp._baseTexture.update();
    };

    // -------------------------------------------------------------------------
    // RENDER: RECTANGULAR MINIMAP WINDOW (Dark Glassmorphic Tactical Map)
    // -------------------------------------------------------------------------
    Sprite_NytheraHUD.prototype.getMapName = function() {
        if (!$gameMap || !$gameMap.mapId()) return '';

        // 1. Tenta pegar o Nome de Exibição configurado no RPG Maker ($dataMap.displayName)
        if ($gameMap.displayName && typeof $gameMap.displayName === 'function') {
            const disp = $gameMap.displayName();
            if (disp && disp.trim().length > 0) {
                return disp.trim();
            }
        }

        // 2. Se não houver Nome de Exibição, pega o Nome do mapa cadastrado na árvore ($dataMapInfos)
        const mapId = $gameMap.mapId();
        if (window.$dataMapInfos && $dataMapInfos[mapId] && $dataMapInfos[mapId].name) {
            const name = $dataMapInfos[mapId].name.trim();
            if (name.length > 0) {
                return name;
            }
        }

        // 3. Fallback neutro
        return `Mapa ${mapId}`;
    };

    Sprite_NytheraHUD.prototype.buildMapCache = function() {
        if (!$gameMap || !$gameMap.mapId()) return;
        this._cachedMapId = $gameMap.mapId();

        const mapW = $gameMap.width();
        const mapH = $gameMap.height();

        let baseScale = 10;
        if (mapW < 25 && mapH < 25) {
            baseScale = 12;
        } else if (mapW > 50 || mapH > 50) {
            baseScale = 8;
        }
        this._scale = baseScale;
        const scale = this._scale;

        this._cachedMapBitmap = new Bitmap(mapW * scale, mapH * scale);
        const cctx = this._cachedMapBitmap.context;

        const passable = [];
        const water = [];
        for (let x = 0; x < mapW; x++) {
            passable[x] = [];
            water[x] = [];
            for (let y = 0; y < mapH; y++) {
                const isPassable = $gameMap.isPassable(x, y, 2) ||
                                  $gameMap.isPassable(x, y, 4) ||
                                  $gameMap.isPassable(x, y, 6) ||
                                  $gameMap.isPassable(x, y, 8);
                passable[x][y] = isPassable;

                const t0 = $gameMap.tileId(x, y, 0);
                water[x][y] = t0 >= 2048 && t0 < 2816;
            }
        }

        // Passada de Terreno Base
        for (let x = 0; x < mapW; x++) {
            for (let y = 0; y < mapH; y++) {
                if (water[x][y]) {
                    cctx.fillStyle = '#0b1d30';
                    cctx.fillRect(x * scale, y * scale, scale, scale);
                } else if (passable[x][y]) {
                    cctx.fillStyle = '#1a2432';
                    cctx.fillRect(x * scale, y * scale, scale, scale);
                    cctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
                    cctx.lineWidth = 0.5;
                    cctx.strokeRect(x * scale + 0.5, y * scale + 0.5, scale - 1, scale - 1);
                } else {
                    cctx.fillStyle = '#080c14';
                    cctx.fillRect(x * scale, y * scale, scale, scale);
                }
            }
        }

        // Passada de Relevo e Contornos Arquiteturais
        for (let x = 0; x < mapW; x++) {
            for (let y = 0; y < mapH; y++) {
                if (water[x][y]) {
                    const touchesLand = (x > 0 && passable[x - 1][y]) ||
                                        (x < mapW - 1 && passable[x + 1][y]) ||
                                        (y > 0 && passable[x][y - 1]) ||
                                        (y < mapH - 1 && passable[x][y + 1]);
                    if (touchesLand) {
                        cctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
                        cctx.lineWidth = 1;
                        cctx.strokeRect(x * scale + 0.5, y * scale + 0.5, scale - 1, scale - 1);
                    }
                } else if (!passable[x][y]) {
                    cctx.strokeStyle = '#203348';
                    cctx.lineWidth = 1;

                    if (x > 0 && passable[x - 1][y]) {
                        cctx.beginPath();
                        cctx.moveTo(x * scale + 0.5, y * scale);
                        cctx.lineTo(x * scale + 0.5, (y + 1) * scale);
                        cctx.stroke();
                    }
                    if (x < mapW - 1 && passable[x + 1][y]) {
                        cctx.beginPath();
                        cctx.moveTo((x + 1) * scale - 0.5, y * scale);
                        cctx.lineTo((x + 1) * scale - 0.5, (y + 1) * scale);
                        cctx.stroke();
                    }
                    if (y > 0 && passable[x][y - 1]) {
                        cctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                        cctx.beginPath();
                        cctx.moveTo(x * scale, y * scale + 0.5);
                        cctx.lineTo((x + 1) * scale, y * scale + 0.5);
                        cctx.stroke();
                        cctx.strokeStyle = '#203348';
                    }
                    if (y < mapH - 1 && passable[x][y + 1]) {
                        cctx.beginPath();
                        cctx.moveTo(x * scale, (y + 1) * scale - 0.5);
                        cctx.lineTo((x + 1) * scale, (y + 1) * scale - 0.5);
                        cctx.stroke();

                        const shadowH = Math.min(4, Math.floor(scale * 0.35));
                        cctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                        cctx.fillRect(x * scale, (y + 1) * scale, scale, shadowH);
                    }
                }
            }
        }

        this._cachedMapBitmap._baseTexture.update();
    };

    Sprite_NytheraHUD.prototype.updateMinimap = function() {
        if (!$gameMap || !$gamePlayer) return;

        if (this._cachedMapId !== $gameMap.mapId() || !this._cachedMapBitmap) {
            this.buildMapCache();
        }

        const bmp = this._minimapSprite.bitmap;
        bmp.clear();
        const ctx = bmp.context;

        const winW = 194;
        const winH = 148;
        const scale = this._scale || 10;
        const currentZoom = this._minimapZooms[this._minimapZoomIndex] || 1.0;
        const drawScale = scale * currentZoom;

        const vx = 4;
        const vy = 22;
        const vw = winW - 8;
        const vh = winH - 26;

        // Tratamento de cliques nos botões de Zoom
        const mouseX = TouchInput.x;
        const mouseY = TouchInput.y;
        const isClick = TouchInput.isTriggered();

        const btnSize = 17;
        const btnX = vx + vw - btnSize - 4;
        const btnMinusY = vy + vh - btnSize - 4;
        const btnPlusY = btnMinusY - btnSize - 3;

        const localMX = mouseX - this._minimapSprite.x;
        const localMY = mouseY - this._minimapSprite.y;

        const isPlusHover = localMX >= btnX && localMX <= btnX + btnSize && localMY >= btnPlusY && localMY <= btnPlusY + btnSize;
        const isMinusHover = localMX >= btnX && localMX <= btnX + btnSize && localMY >= btnMinusY && localMY <= btnMinusY + btnSize;

        if (isClick) {
            if (isPlusHover) {
                if (this._minimapZoomIndex < this._minimapZooms.length - 1) {
                    this._minimapZoomIndex++;
                    if (SoundManager) SoundManager.playCursor();
                }
            } else if (isMinusHover) {
                if (this._minimapZoomIndex > 0) {
                    this._minimapZoomIndex--;
                    if (SoundManager) SoundManager.playCursor();
                }
            }
        }

        // 1. Moldura da Janela em Dark Glass com Acentos Dourados
        UI.drawContainer(ctx, 0, 0, winW, winH, 8, true);

        // 2. Barra de Título (Header com estilo Dark Glass e Ouro)
        const mapName = this.getMapName();

        ctx.save();
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Ícone / Ornamento Dourado
        ctx.fillStyle = '#fde047';
        ctx.shadowColor = 'rgba(253, 224, 71, 0.4)';
        ctx.shadowBlur = 4;
        ctx.fillText('◆', 10, 11);

        // Nome do Mapa
        ctx.fillStyle = '#f8fafc';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 2;
        ctx.fillText(mapName, 22, 11);
        ctx.restore();

        // Linha divisória dourada sutil
        const divGrad = ctx.createLinearGradient(4, 21.5, winW - 4, 21.5);
        divGrad.addColorStop(0, 'rgba(247, 210, 126, 0.1)');
        divGrad.addColorStop(0.25, 'rgba(247, 210, 126, 0.7)');
        divGrad.addColorStop(0.75, 'rgba(247, 210, 126, 0.7)');
        divGrad.addColorStop(1, 'rgba(247, 210, 126, 0.1)');
        ctx.strokeStyle = divGrad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(4, 21.5);
        ctx.lineTo(winW - 4, 21.5);
        ctx.stroke();

        // 3. Viewport do Mapa
        ctx.save();
        UI.roundRect(ctx, vx, vy, vw, vh, 4);
        ctx.fillStyle = '#060a10';
        ctx.fill();
        ctx.clip();

        const cx = vx + vw / 2;
        const cy = vy + vh / 2;
        const px = $gamePlayer._realX;
        const py = $gamePlayer._realY;

        if (this._cachedMapBitmap && this._cachedMapBitmap._canvas) {
            const mapW = $gameMap.width();
            const mapH = $gameMap.height();
            const drawX = Math.round(cx - (px + 0.5) * drawScale);
            const drawY = Math.round(cy - (py + 0.5) * drawScale);
            ctx.drawImage(
                this._cachedMapBitmap._canvas,
                drawX,
                drawY,
                mapW * drawScale,
                mapH * drawScale
            );
        }

        // Vinheta atmosférica suave perimetral
        const radG = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(vw, vh) * 0.7);
        radG.addColorStop(0, 'rgba(0, 0, 0, 0)');
        radG.addColorStop(0.7, 'rgba(4, 8, 14, 0.15)');
        radG.addColorStop(1, 'rgba(4, 8, 14, 0.55)');
        ctx.fillStyle = radG;
        ctx.fillRect(vx, vy, vw, vh);

        // Outros Jogadores Conectados
        if (window._netPlayers) {
            for (const id in window._netPlayers) {
                const np = window._netPlayers[id];
                if (!np) continue;
                const edx = ((np._realX + 0.5) - (px + 0.5)) * drawScale;
                const edy = ((np._realY + 0.5) - (py + 0.5)) * drawScale;
                if (Math.abs(edx) <= vw / 2 && Math.abs(edy) <= vh / 2) {
                    const nx = Math.round(cx + edx);
                    const ny = Math.round(cy + edy);
                    ctx.beginPath();
                    ctx.arc(nx, ny, 5, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(nx, ny, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#10b981';
                    ctx.fill();
                    ctx.lineWidth = 1.2;
                    ctx.strokeStyle = '#ffffff';
                    ctx.stroke();
                }
            }
        }

        // Marcadores de Eventos (NPCs, Quests, Inimigos)
        const events = $gameMap.events();
        for (const ev of events) {
            if (!ev || ev.isTransparent() || ev._erased) continue;
            const edx = ((ev._realX + 0.5) - (px + 0.5)) * drawScale;
            const edy = ((ev._realY + 0.5) - (py + 0.5)) * drawScale;

            if (Math.abs(edx) <= vw / 2 - 2 && Math.abs(edy) <= vh / 2 - 2) {
                const ex = Math.round(cx + edx);
                const ey = Math.round(cy + edy);
                const evName = (ev.event() && ev.event().name) || '';
                const isQuest = evName.startsWith('Quest:') || evName.includes('!');
                const isNpc = isQuest || evName.startsWith('NPC:');

                if (isQuest) {
                    ctx.save();
                    ctx.translate(ex, ey);
                    ctx.rotate(Math.PI / 4);
                    ctx.beginPath();
                    ctx.rect(-4, -4, 8, 8);
                    ctx.fillStyle = '#f59e0b';
                    ctx.fill();
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = '#000000';
                    ctx.stroke();
                    ctx.restore();

                    ctx.save();
                    ctx.font = 'bold 8px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText('!', ex, ey);
                    ctx.restore();
                } else if (isNpc) {
                    ctx.beginPath();
                    ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#fbbf24';
                    ctx.fill();
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = '#000000';
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#f43f5e';
                    ctx.fill();
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = '#000000';
                    ctx.stroke();
                }
            }
        }

        // Bússola Norte (Estilo Dourado / Dark Glass)
        ctx.save();
        const compassX = vx + 12;
        const compassY = vy + 10;
        ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 3;
        ctx.fillStyle = '#fde047';
        ctx.fillText('▲', compassX, compassY);
        ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText('N', compassX, compassY + 9);
        ctx.restore();

        // Marcador do Jogador
        let angle = 0;
        const dir = $gamePlayer.direction();
        if (dir === 8) angle = -Math.PI / 2;
        else if (dir === 2) angle = Math.PI / 2;
        else if (dir === 4) angle = Math.PI;
        else if (dir === 6) angle = 0;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(-2.5, 0);
        ctx.lineTo(-5, 5);
        ctx.closePath();

        const pGrad = ctx.createLinearGradient(-5, 0, 7, 0);
        pGrad.addColorStop(0, '#dc2626');
        pGrad.addColorStop(1, '#ef4444');
        ctx.fillStyle = pGrad;
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.stroke();
        ctx.restore();

        // Placa Inferior Esquerda: Coordenadas (Estilo Dark Glass e Ouro)
        const plaqueW = 76;
        const plaqueH = 17;
        const plaqueX = vx + 4;
        const plaqueY = vy + vh - plaqueH - 4;

        ctx.save();
        UI.roundRect(ctx, plaqueX, plaqueY, plaqueW, plaqueH, 3);
        ctx.fillStyle = 'rgba(6, 11, 20, 0.92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(247, 210, 126, 0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const coordsText = `X: ${$gamePlayer.x}  Y: ${$gamePlayer.y}`;
        ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 2;
        ctx.fillText(coordsText, plaqueX + plaqueW / 2, plaqueY + plaqueH / 2);
        ctx.restore();

        // Botões de Zoom [+] e [-] (Estilo Dark Glass e Ouro)
        ctx.save();
        UI.roundRect(ctx, btnX, btnPlusY, btnSize, btnSize, 3);
        ctx.fillStyle = isPlusHover ? 'rgba(32, 44, 64, 0.96)' : 'rgba(8, 14, 24, 0.9)';
        ctx.fill();
        ctx.strokeStyle = isPlusHover ? 'rgba(247, 210, 126, 0.95)' : 'rgba(212, 160, 62, 0.65)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isPlusHover ? '#fde047' : '#ffffff';
        ctx.fillText('+', btnX + btnSize / 2, btnPlusY + btnSize / 2);

        UI.roundRect(ctx, btnX, btnMinusY, btnSize, btnSize, 3);
        ctx.fillStyle = isMinusHover ? 'rgba(32, 44, 64, 0.96)' : 'rgba(8, 14, 24, 0.9)';
        ctx.fill();
        ctx.strokeStyle = isMinusHover ? 'rgba(247, 210, 126, 0.95)' : 'rgba(212, 160, 62, 0.65)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = isMinusHover ? '#fde047' : '#ffffff';
        ctx.fillText('−', btnX + btnSize / 2, btnMinusY + btnSize / 2);
        ctx.restore();

        ctx.restore(); // Fim do clip do viewport

        // Borda Interna do Viewport com acabamento dourado
        ctx.strokeStyle = 'rgba(212, 160, 62, 0.4)';
        ctx.lineWidth = 1;
        UI.roundRect(ctx, vx, vy, vw, vh, 4);
        ctx.stroke();

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

    // Desativar botão de menu touch padrão na tela do mapa
    Scene_Map.prototype.createMenuButton = function() {};

    // Desativar abertura do menu por qualquer tecla (X, ESC, etc.), clique ou touch
    Scene_Map.prototype.isMenuCalled = function() {
        return false;
    };
    Scene_Map.prototype.isMenuEnabled = function() {
        return false;
    };
    Scene_Map.prototype.updateCallMenu = function() {
        this.menuCalling = false;
    };

    // Desativar corrida / dash com Shift
    Game_Player.prototype.updateDashing = function() {
        this._dashing = false;
    };
    Game_Player.prototype.isDashButtonPressed = function() {
        return false;
    };
    Game_Player.prototype.isDashing = function() {
        return false;
    };

    // =========================================================================
    // PHASE 2: NAMEPLATES & FOOT BARS (HP VERDE / MP AZUL)
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
        this.anchor.y = 0;
        // Move para debaixo da barra de HP (HP bar fica em y=2 e tem altura 12)
        this.y = 14; 
        this.z = 8;
        this.opacity = 0;
        this.visible = false;
        this._lastName = '';
        this._lastColor = '';
    };

    Sprite_CharacterName.prototype.update = function() {
        Sprite.prototype.update.call(this);
        if (this._character) {
            this.updateHover();
            this.updateBitmap();
        }
    };

    Sprite_CharacterName.prototype.isMouseHovered = function() {
        if (!this._character || !this._character.screenX) return false;
        if (this._character.isTransparent && this._character.isTransparent()) return false;
        const mx = TouchInput.x;
        const my = TouchInput.y;
        if (mx === undefined || my === undefined || mx < 0 || my < 0) return false;
        const sx = this._character.screenX();
        const sy = this._character.screenY();
        const halfW = 24;
        const h = 48;
        return mx >= sx - halfW && mx <= sx + halfW && my >= sy - h && my <= sy + 14;
    };

    Sprite_CharacterName.prototype.updateHover = function() {
        const hovered = this.isMouseHovered();
        const targetOpacity = hovered ? 255 : 0;
        if (this.opacity < targetOpacity) {
            this.opacity = Math.min(255, this.opacity + 45);
        } else if (this.opacity > targetOpacity) {
            this.opacity = Math.max(0, this.opacity - 45);
        }
        this.visible = this.opacity > 0;
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

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.lineWidth = 2.5;
        ctx.strokeText(name, cx, cy);

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
        this.y = 2;
        this.z = 7;
        this.opacity = 0;
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

        // Barra de HP (Verde)
        const hpY = 1;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(barX, hpY, barW, barH);

        const hpRate = Math.min(1, Math.max(0, hp / maxHp));
        const hpFillW = Math.floor(barW * hpRate);
        if (hpFillW > 0) {
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(barX, hpY, hpFillW, barH);
        }

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX - 0.5, hpY - 0.5, barW + 1, barH + 1);

        // Barra de MP (Azul)
        const mpY = 5;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(barX, mpY, barW, barH);

        const mpRate = maxMp > 0 ? Math.min(1, Math.max(0, mp / maxMp)) : 0;
        const mpFillW = Math.floor(barW * mpRate);
        if (mpFillW > 0) {
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(barX, mpY, mpFillW, barH);
        }

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
