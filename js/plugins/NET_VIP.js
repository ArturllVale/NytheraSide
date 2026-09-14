//=============================================================================
// RPG Maker MZ - NET_VIP.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc [Nythera] Sistema de VIP e Roles (Normal / VIP / GM / Admin)
 * @author Antigravity & Arthur Vale
 * @orderAfter NET_Auth
 * @orderAfter NET_Client
 *
 * @param vipSwitchId
 * @text ID da Switch VIP
 * @desc Switch do RPG Maker MZ sincronizada com o status VIP do jogador (true = VIP ativo).
 * @type switch
 * @default 10
 *
 * @param vipVariableId
 * @text ID da Variável de Dias VIP
 * @desc Variável do RPG Maker MZ sincronizada com a quantidade de dias VIP restantes.
 * @type variable
 * @default 10
 *
 * @command grantVip
 * @text Conceder / Revogar VIP
 * @desc Concede ou revoga status VIP para a conta do jogador ativo.
 *
 * @arg action
 * @text Ação
 * @desc 1 = Conceder VIP, 0 = Revogar VIP
 * @type select
 * @option Conceder VIP (1)
 * @value 1
 * @option Revogar VIP (0)
 * @value 0
 * @default 1
 *
 * @arg days
 * @text Dias de VIP
 * @desc Quantidade de dias a conceder (padrão: 7)
 * @type number
 * @min 1
 * @default 7
 *
 * @command checkVip
 * @text Verificar VIP
 * @desc Verifica se o jogador é VIP e atualiza a switch configurada.
 *
 * @help NET_VIP.js
 *
 * ============================================================================
 * SISTEMA DE VIP E ROLES - NYTHERA SIDE
 * ============================================================================
 * Este plugin implementa o gerenciamento de Roles (normal, vip, gm, admin) e 
 * privilégios VIP integrados ao servidor NytheraSide.
 *
 * ROLES DISPONÍVEIS:
 * - normal : Jogador padrão (4 slots de heróis base).
 * - vip    : Jogador VIP (+2 slots de criação = 6 slots, acesso a NPCs/áreas VIP).
 * - gm     : Game Master (mesmos privilégios de VIP/Admin).
 * - admin  : Administrador (acesso irrestrito e VIP permanente).
 *
 * REGRA DOS SLOTS DE PERSONAGENS (+2 SLOTS):
 * - Jogadores normais têm 4 slots.
 * - Jogadores VIP/GM/Admin têm 6 slots.
 * - SE O VIP EXPIRAR: Os personagens já criados nos slots 5 e 6 NÃO são 
 *   desativados nem excluídos. O jogador continua jogando normalmente com eles!
 *   Apenas se um herói for deletado e o jogador não for mais VIP o slot volta
 *   a ficar bloqueado para novas criações.
 *
 * ============================================================================
 * COMANDOS EM COMENTÁRIOS DE EVENTOS:
 * ============================================================================
 * 1. Conceder VIP em um Evento/NPC/Item:
 *    Adicione um Comentário com:
 *      <vip: 1, 7>
 *    -> Concede 7 dias de VIP para a conta do jogador.
 *      <vip: 0, 0>
 *    -> Revoga o VIP da conta do jogador.
 *
 * 2. Condição de Acesso em NPC / Área / Baú:
 *    Coloque no início dos comandos do evento um Comentário com:
 *      <vip>
 *    -> Se o jogador NÃO for VIP/GM/Admin, o evento é interrompido 
 *       imediatamente, toca um som de buzzer e exibe a mensagem:
 *       "[Acesso VIP] Este conteúdo é exclusivo para membros VIP!"
 *    -> Se o jogador FOR VIP, o evento continua normalmente.
 *
 * ============================================================================
 * CONDIÇÕES NATIVAS DO RPG MAKER MZ (SWITCH 10):
 * ============================================================================
 * A Switch 10 (configurável no parâmetro 'vipSwitchId') é sincronizada 
 * automaticamente com o status VIP do jogador.
 * - Você pode criar uma Página 2 no Evento com a Condição: "Switch 0010 está ON"
 *   para diálogos, lojas ou recompensas exclusivas de VIPs!
 * - Você pode usar o comando de evento "Condição (Se / Senão) -> Switch 10 ON".
 *
 * ============================================================================
 * CHAMADAS DE SCRIPT (SCRIPT CALLS):
 * ============================================================================
 * - NET.isVip()            -> Retorna true se a conta for VIP, GM ou Admin.
 * - NET.isAdmin()          -> Retorna true se a role for admin.
 * - NET.isGm()             -> Retorna true se a role for gm ou admin.
 * - NET.userRole()         -> Retorna 'normal', 'vip', 'gm' ou 'admin'.
 * - NET.vipDaysRemaining() -> Retorna o número de dias VIP restantes (ex: 7).
 * - NET.grantVip(1, 7)     -> Concede 7 dias de VIP via script.
 * - NET.grantVip(0, 0)     -> Revoga VIP via script.
 * ============================================================================
 */

window.NET = window.NET || {};

(function() {
  'use strict';

  var pluginParams = PluginManager.parameters('NET_VIP') || {};
  var VIP_SWITCH_ID = parseInt(pluginParams.vipSwitchId || '10', 10);
  var VIP_VARIABLE_ID = parseInt(pluginParams.vipVariableId || '10', 10);

  // Estado interno de Roles e VIP
  NET._role = NET._role || 'normal';
  NET._isVip = NET._isVip || false;
  NET._vipUntil = NET._vipUntil || null;

  // Sincroniza Switch e Variável do RPG Maker MZ
  NET.syncGameSwitches = function() {
    var isVip = NET.isVip();
    if (window.$gameSwitches && VIP_SWITCH_ID > 0) {
      $gameSwitches.setValue(VIP_SWITCH_ID, isVip);
    }
    if (window.$gameVariables && VIP_VARIABLE_ID > 0) {
      $gameVariables.setValue(VIP_VARIABLE_ID, NET.vipDaysRemaining());
    }
  };

  // Helper centralizado para atualizar dados de usuário e VIP
  NET.setUserInfo = function(userData, vipData) {
    var role = (userData && userData.role) || (vipData && vipData.role) || NET._role || 'normal';
    var isVip = false;

    if (userData && typeof userData.isVip === 'boolean') {
      isVip = userData.isVip;
    } else if (vipData && typeof vipData.isVip === 'boolean') {
      isVip = vipData.isVip;
    } else {
      isVip = (role === 'admin' || role === 'gm' || role === 'vip');
    }

    var vipUntil = (userData && userData.vipUntil) || (userData && userData.vip_until) ||
                   (vipData && vipData.vipUntil) || (vipData && vipData.vip_until) || NET._vipUntil;

    NET._role = role;
    NET._isVip = isVip;
    NET._vipUntil = vipUntil;

    NET.syncGameSwitches();
  };

  // Métodos Globais para Script Calls
  NET.isVip = function() {
    if (NET._role === 'admin' || NET._role === 'gm') return true;
    if (NET._isVip) {
      if (!NET._vipUntil) return true; // VIP permanente
      return new Date(NET._vipUntil).getTime() > Date.now();
    }
    return false;
  };

  NET.isAdmin = function() {
    return NET._role === 'admin';
  };

  NET.isGm = function() {
    return NET._role === 'gm' || NET._role === 'admin';
  };

  NET.userRole = function() {
    return NET._role || 'normal';
  };

  NET.vipDaysRemaining = function() {
    if (NET.isAdmin() || NET._role === 'gm') return 999;
    if (!NET._vipUntil) return NET.isVip() ? 999 : 0;
    var diff = new Date(NET._vipUntil).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Conceder ou revogar VIP comunicando com o servidor
  NET.grantVip = function(action, days, callback) {
    action = parseInt(action, 10);
    days = parseInt(days || '7', 10);

    // 1. Tentar envio por WebSocket via NET.Client se conectado
    if (NET.Client && NET.Client.isConnected && NET.Client.send) {
      NET.Client.send({
        type: 'CMD_VIP_REQ',
        action: action,
        days: days
      });
      if (typeof callback === 'function') callback({ success: true, pendingWs: true });
      return;
    }

    // 2. Fallback via requisição HTTP POST /user/vip
    var token = (NET.Client && NET.Client.token) || localStorage.getItem('nythera_auth_token');
    var apiHost = NET.apiHost || 'http://localhost:3000';

    fetch(apiHost + '/user/vip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ action: action, days: days })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data && data.success) {
        NET.setUserInfo(data);
        if (action === 1) {
          AudioManager.playSe({ name: 'Chime2', volume: 90, pitch: 100, pan: 0 });
          if (window.$gameMessage) {
            $gameMessage.add('\\C[3][VIP ATIVADO!]\\C[0] Você recebeu ' + days + ' dias de acesso VIP!');
          }
        } else {
          if (window.$gameMessage) {
            $gameMessage.add('\\C[7][VIP]\\C[0] O status VIP foi revogado.');
          }
        }
      }
      if (typeof callback === 'function') callback(data);
    })
    .catch(function(err) {
      console.error('[NET_VIP] Erro ao atualizar status VIP:', err);
      if (typeof callback === 'function') callback({ success: false, error: err });
    });
  };

  // Registrar Plugin Commands do RPG Maker MZ
  PluginManager.registerCommand('NET_VIP', 'grantVip', function(args) {
    var action = parseInt(args.action || '1', 10);
    var days = parseInt(args.days || '7', 10);
    NET.grantVip(action, days);
  });

  PluginManager.registerCommand('NET_VIP', 'checkVip', function() {
    NET.syncGameSwitches();
  });

  // Interceptar Comentários de Eventos (command108 e continuações)
  var _Game_Interpreter_command108 = Game_Interpreter.prototype.command108;
  Game_Interpreter.prototype.command108 = function(params) {
    var result = _Game_Interpreter_command108.apply(this, arguments);
    var fullComment = (this._comments || [params[0]]).join('\n');

    // 1. Tag de comando: <vip: action, days>
    var cmdMatch = fullComment.match(/<vip\s*:\s*(\d+)\s*,\s*(\d+)\s*>/i);
    if (cmdMatch) {
      var act = parseInt(cmdMatch[1], 10);
      var d = parseInt(cmdMatch[2], 10);
      NET.grantVip(act, d);
    }

    // 2. Tag de condição: <vip> ou <vip: require>
    if (/<vip>/i.test(fullComment) || /<vip\s*:\s*require>/i.test(fullComment)) {
      if (!NET.isVip()) {
        SoundManager.playBuzzer();
        if (window.$gameMessage) {
          $gameMessage.add('\\C[2][Acesso VIP]\\C[0] Este conteúdo é exclusivo para membros VIP!');
        }
        // Interrompe a execução dos comandos desta página de evento
        this._index = this._list.length;
        return true;
      }
    }

    return result;
  };

  // Sincronizar Switch ao inicializar Game_System e ao entrar no Mapa
  var _Game_System_initialize = Game_System.prototype.initialize;
  Game_System.prototype.initialize = function() {
    _Game_System_initialize.call(this);
    NET.syncGameSwitches();
  };

  var _Scene_Map_start = Scene_Map.prototype.start;
  Scene_Map.prototype.start = function() {
    _Scene_Map_start.call(this);
    NET.syncGameSwitches();
  };

  // Escutar eventos do WebSocket no NET.Client
  function setupWebSocketListeners() {
    if (!window.NET || !NET.Client || !NET.Client.on) {
      setTimeout(setupWebSocketListeners, 200);
      return;
    }

    // Ao conectar / autenticar
    NET.Client.on('AUTH_RES', function(data) {
      if (data && data.user) {
        NET.setUserInfo(data.user);
      }
    });

    // Ao receber resposta de comando VIP
    NET.Client.on('CMD_VIP_RES', function(data) {
      if (data && data.success) {
        NET.setUserInfo(data);
        AudioManager.playSe({ name: 'Chime2', volume: 90, pitch: 100, pan: 0 });
        if (window.$gameMessage) {
          var msg = data.message || (data.isVip ? '\\C[3][VIP ATIVADO!]\\C[0] Parabéns! Você agora é um membro VIP.' : '\\C[7][VIP]\\C[0] Seu status VIP foi encerrado.');
          $gameMessage.add(msg);
        }
      }
    });
  }

  setupWebSocketListeners();

})();
