//=============================================================================
// RPG Maker MZ - Nythera_RegionControl.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc [Nythera] Controle de Regiões e Encontros de Monstros / Map Region Encounter Control
 * @author Antigravity & Artur Vale
 * @orderAfter NET_BattleBridge
 * 
 * @help Nythera_RegionControl.js
 * 
 * ============================================================================
 * SOBRE / ABOUT
 * ============================================================================
 * Este plugin permite controlar com precisão encontros de batalha baseados em
 * Regiões (Region IDs) desenhadas no mapa do RPG Maker MZ.
 * Integrado à arquitetura multiplayer do NytheraSide com suporte tanto a
 * Tropas pré-cadastradas na Database quanto a Monstros individuais / dinâmicos.
 * 
 * ============================================================================
 * HIERARQUIA DE CONFIGURAÇÃO (Prioridade de leitura):
 * ============================================================================
 * 1. Sobrescritas nos Parâmetros do Plugin (Map Overrides)
 * 2. Notas do Mapa (Map Note-tags): <Region X: ...>
 * 3. Comentários em Eventos do Mapa (Event Comments): <Region X: ...>
 * 4. Regiões Globais nos Parâmetros do Plugin (Global Regions)
 * 5. Padrão Global da Região 1 (Fallback nos Parâmetros)
 * 
 * ============================================================================
 * TAGS DISPONÍVEIS:
 * ============================================================================
 *   <mob: ID>
 *   Inicia batalha contra um monstro específico da aba Inimigos (Enemies).
 *   Exemplo: <mob: 1> (Enfrenta 1 Goblin)
 * 
 *   <mob: ID1,ID2,ID3>
 *   Cria uma batalha contra um grupo personalizado desses monstros.
 *   Exemplo: <mob: 1,2> (Enfrenta Goblin + Gnome juntos)
 * 
 *   <mobs: ID>
 *   Inicia batalha contra uma Tropa pré-configurada na Database (Troops).
 *   Exemplo: <mobs: 1> (Enfrenta a Tropa ID 1)
 * 
 *   <mobs: ID1,ID2,ID3>
 *   Sorteia aleatoriamente entre uma das Tropas da lista.
 *   Exemplo: <mobs: 1,2,3>
 * 
 *   <rate: Chance>
 *   Chance em % de encontro a cada passo dado sobre o tile da região.
 *   Padrão: 8%.
 *   Exemplo: <rate: 15> (15% de chance por passo)
 * 
 * ============================================================================
 * EXEMPLOS PRÁTICOS NO EDITOR:
 * ============================================================================
 * 1. Em Notas do Mapa (Botão direito no mapa -> Editar -> Notas):
 *      <Region 1: <mob: 1> <rate: 10>>
 *      <Region 2: <mob: 2> <rate: 12>>
 *      <Region 3: <mobs: 3,4> <rate: 20>>
 * 
 * 2. Em um Evento no Mapa (Crie um evento invisível, ex: "Encontros"):
 *      Insira comandos de "Comentário":
 *      <Region 1: <mob: 1> <rate: 10>>
 *      <Region 2: <mob: 2> <rate: 10>>
 * 
 * ============================================================================
 * 
 * @param region1
 * @text Configuração Região 1 / Region 1 Config
 * @desc Configuração global para a Região ID 1. Exemplo: <mob: 1> <rate: 8>
 * @type string
 * @default <mob: 1> <rate: 8>
 * 
 * @param globalRegions
 * @text Regiões Globais / Global Regions
 * @desc Lista de configurações globais para qualquer uma das 255 regiões.
 * @type struct<GlobalRegion>[]
 * @default []
 * 
 * @param mapOverrides
 * @text Sobrescritas por Mapa / Map Overrides
 * @desc Lista de configurações específicas para mapas e regiões específicas.
 * @type struct<MapOverride>[]
 * @default []
 * 
 * @param graceSteps
 * @text Passos de Graça / Grace Steps
 * @desc Quantidade de passos livres de encontros após finalizar uma batalha (Padrão: 5).
 * @type number
 * @min 0
 * @default 5
 */
/*~struct~GlobalRegion:
 * @param regionId
 * @text ID da Região / Region ID
 * @desc A região a ser configurada (1 a 255).
 * @type number
 * @min 1
 * @max 255
 * @default 1
 * 
 * @param config
 * @text Configuração / Config
 * @desc Tags de configuração (ex: <mob: 2> <rate: 10>)
 * @type string
 * @default <mob: 1> <rate: 8>
 */
/*~struct~MapOverride:
 * @param mapId
 * @text ID do Mapa / Map ID
 * @desc O ID do mapa onde esta sobrescrita será aplicada (0 para todos os mapas).
 * @type number
 * @min 0
 * @default 1
 * 
 * @param regionId
 * @text ID da Região / Region ID
 * @desc A região do mapa a ser configurada (1 a 255).
 * @type number
 * @min 1
 * @max 255
 * @default 1
 * 
 * @param config
 * @text Configuração / Config
 * @desc Tags de configuração (ex: <mob: 1,2> <rate: 12>)
 * @type string
 * @default <mob: 1> <rate: 8>
 */

(() => {
    'use strict';

    const pluginName = "Nythera_RegionControl";
    
    // Inicialização do Namespace
    window.Nythera = window.Nythera || {};
    Nythera.RegionControl = Nythera.RegionControl || {};

    // Leitura segura dos Parâmetros do Plugin
    const parameters = PluginManager.parameters(pluginName) || {};
    Nythera.RegionControl.region1Config = parameters["region1"] || "<mob: 1> <rate: 8>";
    Nythera.RegionControl.graceSteps = parseInt(parameters["graceSteps"] || "5", 10);
    
    // Parse de Regiões Globais
    Nythera.RegionControl.globalRegions = [];
    try {
        const globalRegionsRaw = parameters["globalRegions"];
        if (globalRegionsRaw) {
            const parsedArray = JSON.parse(globalRegionsRaw);
            Nythera.RegionControl.globalRegions = parsedArray.map(itemStr => {
                const item = typeof itemStr === "string" ? JSON.parse(itemStr) : itemStr;
                return {
                    regionId: parseInt(item.regionId || "1", 10),
                    config: item.config || ""
                };
            });
        }
    } catch (e) {
        console.error("[Nythera_RegionControl] Failed to parse Global Regions:", e);
    }
    
    // Parse de Sobrescritas por Mapa
    Nythera.RegionControl.mapOverrides = [];
    try {
        const overridesRaw = parameters["mapOverrides"];
        if (overridesRaw) {
            const parsedArray = JSON.parse(overridesRaw);
            Nythera.RegionControl.mapOverrides = parsedArray.map(itemStr => {
                const item = typeof itemStr === "string" ? JSON.parse(itemStr) : itemStr;
                return {
                    mapId: parseInt(item.mapId || "0", 10),
                    regionId: parseInt(item.regionId || "1", 10),
                    config: item.config || ""
                };
            });
        }
    } catch (e) {
        console.error("[Nythera_RegionControl] Failed to parse Map Overrides:", e);
    }

    // Parser das tags de configuração
    Nythera.RegionControl.parseConfig = function(configStr) {
        if (!configStr || typeof configStr !== "string") return null;

        // <rate: X>
        let rate = 8;
        const rateMatch = configStr.match(/<rate:\s*(\d+)>/i);
        if (rateMatch) {
            rate = parseInt(rateMatch[1], 10);
        }

        // <mobs: ID1,ID2,...> (Tropas da Database)
        let troopIds = null;
        const mobsMatch = configStr.match(/<mobs\s*:\s*([\d\s,]+)>/i);
        if (mobsMatch) {
            troopIds = mobsMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(id => !isNaN(id));
        }

        // <mob: ID1,ID2,...> (Inimigos avulsos / dinâmicos)
        let enemyIds = null;
        const mobMatch = configStr.match(/<mob(?![s])\s*:\s*([\d\s,]+)>/i);
        if (mobMatch) {
            enemyIds = mobMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(id => !isNaN(id));
        }

        // Se não houver monstros ou tropas válidas, ignora
        if ((!troopIds || troopIds.length === 0) && (!enemyIds || enemyIds.length === 0)) {
            return null;
        }

        return {
            rate: rate,
            troopIds: troopIds,
            enemyIds: enemyIds
        };
    };

    // Extrator balanceado de tags aninhadas (<Region X: ...>)
    Nythera.RegionControl.extractConfig = function(text, regionId) {
        if (!text || typeof text !== "string") return null;
        
        const prefix = `<Region ${regionId}:`;
        const index = text.toLowerCase().indexOf(prefix.toLowerCase());
        if (index === -1) return null;

        let braceCount = 1;
        let content = "";
        for (let i = index + prefix.length; i < text.length; i++) {
            const char = text[i];
            if (char === '<') {
                braceCount++;
            } else if (char === '>') {
                braceCount--;
            }
            if (braceCount === 0) {
                return content.trim();
            }
            content += char;
        }
        return null;
    };

    // Obtém a configuração ativa para uma dada Região segundo a hierarquia
    Nythera.RegionControl.getConfig = function(regionId) {
        const mapId = $gameMap ? $gameMap.mapId() : 0;

        // 1. Sobrescritas do Plugin (Map Overrides)
        if (Nythera.RegionControl.mapOverrides && Nythera.RegionControl.mapOverrides.length > 0) {
            let override = Nythera.RegionControl.mapOverrides.find(o => o.mapId === mapId && o.regionId === regionId);
            if (!override) {
                override = Nythera.RegionControl.mapOverrides.find(o => o.mapId === 0 && o.regionId === regionId);
            }
            if (override && override.config) {
                const parsed = Nythera.RegionControl.parseConfig(override.config);
                if (parsed) return parsed;
            }
        }

        // 2. Notas do Mapa (Map Note-tags)
        if ($dataMap && $dataMap.note) {
            const extracted = Nythera.RegionControl.extractConfig($dataMap.note, regionId);
            if (extracted) {
                const parsed = Nythera.RegionControl.parseConfig(extracted);
                if (parsed) return parsed;
            }
        }

        // 3. Comentários em Eventos do Mapa
        if ($dataMap && $dataMap.events) {
            for (const ev of $dataMap.events) {
                if (!ev || !ev.pages) continue;
                for (const page of ev.pages) {
                    if (!page || !page.list) continue;
                    for (let i = 0; i < page.list.length; i++) {
                        const cmd = page.list[i];
                        if (cmd.code === 108) { // Início de comentário
                            let commentText = cmd.parameters[0] || "";
                            let nextIdx = i + 1;
                            while (page.list[nextIdx] && page.list[nextIdx].code === 408) {
                                commentText += "\n" + (page.list[nextIdx].parameters[0] || "");
                                nextIdx++;
                            }
                            const extracted = Nythera.RegionControl.extractConfig(commentText, regionId);
                            if (extracted) {
                                const parsed = Nythera.RegionControl.parseConfig(extracted);
                                if (parsed) return parsed;
                            }
                        }
                    }
                }
            }
        }

        // 4. Regiões Globais do Plugin
        if (Nythera.RegionControl.globalRegions && Nythera.RegionControl.globalRegions.length > 0) {
            const globalRegion = Nythera.RegionControl.globalRegions.find(r => r.regionId === regionId);
            if (globalRegion && globalRegion.config) {
                const parsed = Nythera.RegionControl.parseConfig(globalRegion.config);
                if (parsed) return parsed;
            }
        }

        // 5. Padrão Global da Região 1 (Fallback)
        if (regionId === 1 && Nythera.RegionControl.region1Config) {
            const parsed = Nythera.RegionControl.parseConfig(Nythera.RegionControl.region1Config);
            if (parsed) return parsed;
        }

        return null;
    };

    // Criação dinâmica de Tropas para monstros avulsos com suporte ao NET_BattleBridge
    Nythera.RegionControl.createDynamicTroop = function(enemyIds) {
        if (!enemyIds || enemyIds.length === 0) return null;

        const nextId = $dataTroops.length;
        const members = enemyIds.map((enemyId, index) => {
            const staggerX = index * 60;
            const staggerY = (index % 2 === 0 ? 40 : -40) + (index * 15);
            
            const x = 200 + staggerX;
            const y = 420 + staggerY;
            
            return {
                enemyId: enemyId,
                x: x,
                y: y,
                hidden: false
            };
        });

        const name = enemyIds.map(id => {
            const enemy = $dataEnemies[id];
            return enemy ? enemy.name : `Enemy ${id}`;
        }).join(", ");

        const troop = {
            id: nextId,
            name: `Region Encounter (${name})`,
            members: members,
            _dynamicEnemyIds: enemyIds,
            pages: [{
                conditions: {
                    actorHp: 50, actorId: 1, actorValid: false,
                    enemyHp: 50, enemyIndex: 0, enemyValid: false,
                    switchId: 1, switchValid: false,
                    turnA: 0, turnB: 0, turnEnding: false, turnValid: false
                },
                list: [{ code: 0, indent: 0, parameters: [] }],
                span: 0
            }]
        };

        $dataTroops.push(troop);
        return nextId;
    };

    // Inicialização da Batalha
    Nythera.RegionControl.triggerBattle = function(config) {
        let troopId = null;

        // 1. Encontro por Tropas configuradas
        if (config.troopIds && config.troopIds.length > 0) {
            const idx = Math.floor(Math.random() * config.troopIds.length);
            troopId = config.troopIds[idx];
        } 
        // 2. Encontro por Monstros avulsos (Cria Tropa dinâmica com _dynamicEnemyIds)
        else if (config.enemyIds && config.enemyIds.length > 0) {
            troopId = Nythera.RegionControl.createDynamicTroop(config.enemyIds);
        }

        if (troopId && $dataTroops[troopId]) {
            console.log(`[Nythera RegionControl] Battle triggered! Troop ID: ${troopId}`);
            
            if ($gamePlayer) {
                $gamePlayer._inBattle = true;
                if ($gameTemp) {
                    $gameTemp.requestBalloon($gamePlayer, 1); // Balão de Exclamação (!)
                }
            }

            // Inicia batalha
            BattleManager.setup(troopId, true, true);
            SceneManager.push(Scene_Battle);
        }
    };

    // Inicializa os passos de graça no jogador
    const _Game_Player_initialize = Game_Player.prototype.initialize;
    Game_Player.prototype.initialize = function() {
        _Game_Player_initialize.call(this);
        this._regionEncounterGraceSteps = Nythera.RegionControl.graceSteps;
    };

    // Validação se o jogador pode encontrar inimigos
    Game_Player.prototype.canRegionEncounter = function() {
        return (
            !$gameMap.isEventRunning() &&
            !$gamePlayer._inBattle &&
            !$gamePlayer.isThrough() &&
            $gameSystem.isEncounterEnabled() &&
            SceneManager._scene instanceof Scene_Map
        );
    };

    // Hook no incremento de passos do jogador
    const _Game_Player_increaseSteps = Game_Player.prototype.increaseSteps;
    Game_Player.prototype.increaseSteps = function() {
        _Game_Player_increaseSteps.call(this);
        
        if (this.canRegionEncounter()) {
            const regionId = this.regionId();
            
            // Período de graça após uma batalha
            if (this._regionEncounterGraceSteps > 0) {
                this._regionEncounterGraceSteps--;
                if (regionId > 0 && Nythera.RegionControl.getConfig(regionId)) {
                    console.log(`[Nythera RegionControl] Stepped on region ${regionId}, grace period: ${this._regionEncounterGraceSteps} remaining.`);
                }
                return;
            }

            if (regionId > 0) {
                const config = Nythera.RegionControl.getConfig(regionId);
                if (config) {
                    const roll = Math.random() * 100;
                    console.log(`[Nythera RegionControl] Stepped on region ${regionId}. Rate: ${config.rate}%. Roll: ${roll.toFixed(2)}%`);
                    if (roll < config.rate) {
                        this._regionEncounterGraceSteps = Nythera.RegionControl.graceSteps;
                        Nythera.RegionControl.triggerBattle(config);
                    }
                }
            }
        }
    };
})();
