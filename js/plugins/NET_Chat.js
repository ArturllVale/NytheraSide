/*:
 * @target MZ
 * @plugindesc NytheraSide - MMO Chat Overlay com Abas, Emojis, Minimizar e Transparência Dinâmica
 * @author Nythera
 *
 * @help NET_Chat.js
 * Interface de Chat MMORPG com:
 * - 4 Abas especializadas (Local, Global, Privado, Sistema)
 * - Botão de Emoji no final da barra de digitação com paleta gráfica
 * - Botão de Minimizar (— / ▲) na barra de cabeçalho
 * - Botão de Modo Fantasma 👻 (Transparência automática ao caminhar)
 * - Atalhos de teclado e balões de fala sobre os heróis
 */

(function() {
    'use strict';

    var currentTab = 'local'; // 'local' | 'global' | 'whisper' | 'system'
    var unreadCounts = { local: 0, global: 0, whisper: 0, system: 0 };
    var isMinimized = false;
    var ghostMode = false;
    try {
        ghostMode = (localStorage.getItem('nythera_chat_ghost') === 'true');
    } catch (e) {}
    var isMouseOverChat = false;
    var isChatFocused = false;

    // Mapa de atalhos de emoticons para Unicode Emojis
    var EMOJI_MAP = {
        ':)': '😊',
        ':-)': '😊',
        ':D': '😄',
        ':-D': '😄',
        ':(': '😢',
        ':-(': '😢',
        ';)': '😉',
        ';-)': '😉',
        ':p': '😛',
        ':P': '😛',
        ':-p': '😛',
        ':-P': '😛',
        'xD': '😆',
        'XD': '😆',
        '<3': '❤️',
        ':fire:': '🔥',
        ':sword:': '⚔️',
        ':shield:': '🛡️',
        ':bow:': '🏹',
        ':mage:': '🧙',
        ':gold:': '💰',
        ':gem:': '💎',
        ':skull:': '💀',
        ':crown:': '👑',
        ':star:': '⭐',
        ':potion:': '🧪',
        ':heart:': '❤️',
        ':like:': '👍',
        ':+1:': '👍',
        ':-1:': '👎',
        ':eyes:': '👀',
        ':party:': '🎉',
        ':trophy:': '🏆',
        ':gg:': '🏆',
        ':target:': '🎯',
        ':muscle:': '💪'
    };

    function parseEmojis(text) {
        if (!text) return text;
        var result = text;
        for (var key in EMOJI_MAP) {
            if (Object.prototype.hasOwnProperty.call(EMOJI_MAP, key)) {
                result = result.split(key).join(EMOJI_MAP[key]);
            }
        }
        return result;
    }

    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        if (!document.getElementById('nythera-chat-container')) {
            createChatUI();
        } else {
            document.getElementById('nythera-chat-container').style.display = 'flex';
        }
        
        if (window.NET && NET.Client) {
            NET.Client.off('CHAT_MSG_RES', onChatMessage);
            NET.Client.on('CHAT_MSG_RES', onChatMessage);
        }
    };

    var _Scene_Map_terminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function() {
        _Scene_Map_terminate.call(this);
        var chat = document.getElementById('nythera-chat-container');
        if (chat) chat.style.display = 'none';
    };

    function createChatUI() {
        var container = document.createElement('div');
        container.id = 'nythera-chat-container';
        container.style.position = 'absolute';
        container.style.left = '10px';
        container.style.bottom = '10px';
        container.style.width = '395px';
        container.style.height = '235px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.backgroundColor = 'rgba(8, 12, 20, 0.78)';
        container.style.borderRadius = '6px';
        container.style.border = '1px solid rgba(212, 160, 62, 0.4)';
        container.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.6), inset 0 0 12px rgba(212, 160, 62, 0.08)';
        container.style.backdropFilter = 'blur(6px)';
        container.style.pointerEvents = 'auto';
        container.style.zIndex = '1000';
        container.style.fontFamily = 'sans-serif, "Segoe UI Emoji", "Apple Color Emoji"';
        container.style.textShadow = '1px 1px 2px rgba(0,0,0,0.9)';
        container.style.overflow = 'hidden';
        container.style.transition = 'opacity 0.25s ease, height 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

        // ==================== TABS BAR & ACTIONS ====================
        var tabsBar = document.createElement('div');
        tabsBar.id = 'nythera-chat-tabs';
        tabsBar.style.display = 'flex';
        tabsBar.style.alignItems = 'center';
        tabsBar.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        tabsBar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.12)';
        tabsBar.style.padding = '2px 4px 0 4px';
        tabsBar.style.gap = '2px';
        tabsBar.style.userSelect = 'none';
        tabsBar.style.height = '28px';
        tabsBar.style.boxSizing = 'border-box';

        var tabsConfig = [
            { id: 'local', label: 'Local' },
            { id: 'global', label: 'Global' },
            { id: 'whisper', label: 'Privado' },
            { id: 'system', label: 'Sistema' }
        ];

        tabsConfig.forEach(function(tab) {
            var btn = document.createElement('div');
            btn.id = 'nythera-tab-' + tab.id;
            btn.className = 'nythera-chat-tab';
            btn.style.padding = '4px 10px';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = 'bold';
            btn.style.cursor = 'pointer';
            btn.style.borderRadius = '4px 4px 0 0';
            btn.style.transition = 'all 0.15s ease';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.gap = '4px';

            var labelSpan = document.createElement('span');
            labelSpan.innerText = tab.label;
            btn.appendChild(labelSpan);

            var badge = document.createElement('span');
            badge.id = 'nythera-badge-' + tab.id;
            badge.style.display = 'none';
            badge.style.width = '7px';
            badge.style.height = '7px';
            badge.style.borderRadius = '50%';
            badge.style.backgroundColor = '#f59e0b';
            badge.style.boxShadow = '0 0 6px #f59e0b';
            btn.appendChild(badge);

            btn.onclick = function() {
                if (isMinimized) {
                    toggleMinimizeChat();
                }
                switchTab(tab.id);
            };

            tabsBar.appendChild(btn);
        });

        // Barra de Ações (Direita do Cabeçalho): Ghost Mode e Minimizar
        var actionsBar = document.createElement('div');
        actionsBar.id = 'nythera-chat-actions';
        actionsBar.style.marginLeft = 'auto';
        actionsBar.style.display = 'flex';
        actionsBar.style.alignItems = 'center';
        actionsBar.style.gap = '4px';
        actionsBar.style.paddingRight = '2px';

        // 1. Botão de Transparência ao Mover (Ghost Mode)
        var ghostBtn = document.createElement('button');
        ghostBtn.type = 'button';
        ghostBtn.id = 'nythera-chat-ghost-btn';
        ghostBtn.innerText = '👻';
        ghostBtn.title = ghostMode ? 'Transparência ao Mover: Ativada' : 'Transparência ao Mover: Desativada';
        ghostBtn.style.backgroundColor = ghostMode ? 'rgba(212, 160, 62, 0.28)' : 'transparent';
        ghostBtn.style.border = ghostMode ? '1px solid rgba(255, 215, 0, 0.6)' : '1px solid transparent';
        ghostBtn.style.borderRadius = '3px';
        ghostBtn.style.cursor = 'pointer';
        ghostBtn.style.fontSize = '12px';
        ghostBtn.style.padding = '2px 5px';
        ghostBtn.style.lineHeight = '1';
        ghostBtn.style.opacity = ghostMode ? '1' : '0.5';
        ghostBtn.style.outline = 'none';
        ghostBtn.style.transition = 'all 0.15s ease';
        ghostBtn.onclick = function(e) {
            e.stopPropagation();
            toggleGhostMode();
        };

        // 2. Botão de Minimizar / Restaurar Chat
        var minBtn = document.createElement('button');
        minBtn.type = 'button';
        minBtn.id = 'nythera-chat-min-btn';
        minBtn.innerText = isMinimized ? '▲' : '—';
        minBtn.title = isMinimized ? 'Expandir Chat' : 'Minimizar Chat';
        minBtn.style.backgroundColor = 'transparent';
        minBtn.style.color = '#ffd700';
        minBtn.style.border = 'none';
        minBtn.style.cursor = 'pointer';
        minBtn.style.fontSize = '13px';
        minBtn.style.fontWeight = 'bold';
        minBtn.style.padding = '2px 6px';
        minBtn.style.lineHeight = '1';
        minBtn.style.opacity = '0.75';
        minBtn.style.outline = 'none';
        minBtn.style.transition = 'all 0.15s ease';
        minBtn.onmouseover = function() { minBtn.style.opacity = '1'; };
        minBtn.onmouseout = function() { minBtn.style.opacity = '0.75'; };
        minBtn.onclick = function(e) {
            e.stopPropagation();
            toggleMinimizeChat();
        };

        actionsBar.appendChild(ghostBtn);
        actionsBar.appendChild(minBtn);
        tabsBar.appendChild(actionsBar);

        container.appendChild(tabsBar);

        // ==================== HISTORIES (PAINÉIS) ====================
        var panelsContainer = document.createElement('div');
        panelsContainer.id = 'nythera-chat-panels';
        panelsContainer.style.flex = '1';
        panelsContainer.style.position = 'relative';
        panelsContainer.style.overflow = 'hidden';

        tabsConfig.forEach(function(tab) {
            var box = document.createElement('div');
            box.id = 'nythera-chat-history-' + tab.id;
            box.className = 'nythera-chat-history-box';
            box.style.position = 'absolute';
            box.style.inset = '0';
            box.style.overflowY = 'auto';
            box.style.padding = '6px 8px';
            box.style.display = 'none';
            box.style.flexDirection = 'column';
            box.style.gap = '3px';
            box.style.fontSize = '13px';
            box.style.lineHeight = '1.25';
            panelsContainer.appendChild(box);
        });

        container.appendChild(panelsContainer);

        // ==================== EMOJI PICKER POPUP ====================
        var emojiPicker = document.createElement('div');
        emojiPicker.id = 'nythera-emoji-picker';
        emojiPicker.style.position = 'absolute';
        emojiPicker.style.bottom = '36px';
        emojiPicker.style.right = '6px';
        emojiPicker.style.width = '245px';
        emojiPicker.style.maxHeight = '130px';
        emojiPicker.style.backgroundColor = 'rgba(12, 16, 26, 0.95)';
        emojiPicker.style.border = '1px solid rgba(212, 160, 62, 0.5)';
        emojiPicker.style.borderRadius = '6px';
        emojiPicker.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.85)';
        emojiPicker.style.backdropFilter = 'blur(8px)';
        emojiPicker.style.display = 'none';
        emojiPicker.style.flexWrap = 'wrap';
        emojiPicker.style.gap = '4px';
        emojiPicker.style.padding = '6px';
        emojiPicker.style.overflowY = 'auto';
        emojiPicker.style.zIndex = '1001';
        emojiPicker.style.userSelect = 'none';

        var emojiList = [
            '😊', '😄', '😆', '😎', '🤔', '😱', '😢', '😡', '😴', '🥳',
            '⚔️', '🛡️', '🏹', '🧙', '💰', '💎', '👑', '💀', '🧪', '🔥',
            '⚡', '❄️', '❤️', '💔', '👍', '👎', '⭐', '✨', '🎯', '🏆',
            '🎉', '👀', '🤝', '👋', '💪', '🍀'
        ];

        emojiList.forEach(function(emoji) {
            var item = document.createElement('span');
            item.innerText = emoji;
            item.style.cursor = 'pointer';
            item.style.fontSize = '18px';
            item.style.padding = '3px';
            item.style.borderRadius = '4px';
            item.style.transition = 'transform 0.1s ease, background 0.1s ease';
            item.onmouseover = function() {
                item.style.backgroundColor = 'rgba(255, 215, 0, 0.25)';
                item.style.transform = 'scale(1.25)';
            };
            item.onmouseout = function() {
                item.style.backgroundColor = 'transparent';
                item.style.transform = 'scale(1)';
            };
            item.onclick = function(e) {
                e.stopPropagation();
                insertEmoji(emoji);
            };
            emojiPicker.appendChild(item);
        });

        container.appendChild(emojiPicker);

        // ==================== INPUT FORM ====================
        var inputForm = document.createElement('form');
        inputForm.id = 'nythera-chat-form';
        inputForm.style.display = 'flex';
        inputForm.style.alignItems = 'center';
        inputForm.style.borderTop = '1px solid rgba(255, 255, 255, 0.12)';
        inputForm.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
        inputForm.style.height = '32px';
        inputForm.style.boxSizing = 'border-box';
        inputForm.style.padding = '0 4px';
        inputForm.onsubmit = function(e) {
            e.preventDefault();
            sendChatMessage();
        };

        var typeSelect = document.createElement('select');
        typeSelect.id = 'nythera-chat-type';
        typeSelect.style.flexShrink = '0';
        typeSelect.style.backgroundColor = 'transparent';
        typeSelect.style.color = '#ffd700';
        typeSelect.style.fontWeight = 'bold';
        typeSelect.style.border = 'none';
        typeSelect.style.padding = '4px 6px';
        typeSelect.style.outline = 'none';
        typeSelect.style.cursor = 'pointer';
        typeSelect.style.fontSize = '12px';

        var optLocal = document.createElement('option');
        optLocal.value = 'local';
        optLocal.innerText = '[Local]';
        optLocal.style.color = '#000';

        var optGlobal = document.createElement('option');
        optGlobal.value = 'global';
        optGlobal.innerText = '[Global]';
        optGlobal.style.color = '#000';

        var optWhisper = document.createElement('option');
        optWhisper.value = 'whisper';
        optWhisper.innerText = '[Privado]';
        optWhisper.style.color = '#000';

        typeSelect.appendChild(optLocal);
        typeSelect.appendChild(optGlobal);
        typeSelect.appendChild(optWhisper);

        typeSelect.onchange = function() {
            var selected = typeSelect.value;
            if (selected === 'whisper') {
                switchTab('whisper');
            } else if (selected === 'global') {
                switchTab('global');
            } else {
                switchTab('local');
            }
        };

        var inputField = document.createElement('input');
        inputField.id = 'nythera-chat-input';
        inputField.type = 'text';
        inputField.placeholder = 'Pressione Enter para falar...';
        inputField.style.flex = '1';
        inputField.style.minWidth = '0'; // Garante que não estoure no flexbox
        inputField.style.backgroundColor = 'transparent';
        inputField.style.color = '#fff';
        inputField.style.border = 'none';
        inputField.style.padding = '4px 6px';
        inputField.style.outline = 'none';
        inputField.style.fontSize = '13px';

        inputField.addEventListener('keydown', function(e) {
            e.stopPropagation();
        });
        inputField.addEventListener('keyup', function(e) {
            e.stopPropagation();
        });

        // Botão de Emoji 😀 no final absoluto da barra
        var emojiBtn = document.createElement('button');
        emojiBtn.type = 'button';
        emojiBtn.id = 'nythera-chat-emoji-btn';
        emojiBtn.innerText = '😀';
        emojiBtn.title = 'Selecionar Emoji';
        emojiBtn.style.flexShrink = '0';
        emojiBtn.style.width = '28px';
        emojiBtn.style.height = '28px';
        emojiBtn.style.display = 'flex';
        emojiBtn.style.alignItems = 'center';
        emojiBtn.style.justifyContent = 'center';
        emojiBtn.style.backgroundColor = 'transparent';
        emojiBtn.style.border = 'none';
        emojiBtn.style.borderRadius = '4px';
        emojiBtn.style.cursor = 'pointer';
        emojiBtn.style.fontSize = '16px';
        emojiBtn.style.padding = '0';
        emojiBtn.style.marginLeft = 'auto';
        emojiBtn.style.outline = 'none';
        emojiBtn.style.transition = 'all 0.15s ease';
        emojiBtn.onmouseover = function() {
            emojiBtn.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
            emojiBtn.style.transform = 'scale(1.15)';
        };
        emojiBtn.onmouseout = function() {
            emojiBtn.style.backgroundColor = 'transparent';
            emojiBtn.style.transform = 'scale(1)';
        };
        emojiBtn.onclick = function(e) {
            e.stopPropagation();
            toggleEmojiPicker();
        };

        inputForm.appendChild(typeSelect);
        inputForm.appendChild(inputField);
        inputForm.appendChild(emojiBtn);
        container.appendChild(inputForm);

        // Controle de Mouse Hover e Foco para o Modo Fantasma (Ghost Mode)
        container.addEventListener('mouseenter', function() {
            isMouseOverChat = true;
            if (ghostMode) {
                container.style.opacity = '1';
                container.style.pointerEvents = 'auto';
            }
        });

        container.addEventListener('mouseleave', function() {
            isMouseOverChat = false;
        });

        inputField.addEventListener('focus', function() {
            isChatFocused = true;
            if (ghostMode) {
                container.style.opacity = '1';
                container.style.pointerEvents = 'auto';
            }
        });

        inputField.addEventListener('blur', function() {
            isChatFocused = false;
        });

        // Fecha emoji picker ao clicar fora
        container.addEventListener('click', function(e) {
            var picker = document.getElementById('nythera-emoji-picker');
            var btn = document.getElementById('nythera-chat-emoji-btn');
            if (picker && picker.style.display === 'flex') {
                if (!picker.contains(e.target) && e.target !== btn) {
                    picker.style.display = 'none';
                }
            }
        });

        document.body.appendChild(container);

        // Define a aba inicial como Local
        switchTab('local');

        // Mensagens Iniciais do Sistema
        addLogMessage('system', 'Sistema', 'Conectado a Nythera! Digite /help para comandos ou use emojis 😊 ⚔️', '#38bdf8');
        addLogMessage('local', 'Sistema', 'Você entrou no chat Local do mapa.', '#fcd34d');
    }

    function toggleMinimizeChat() {
        var container = document.getElementById('nythera-chat-container');
        var panels = document.getElementById('nythera-chat-panels');
        var inputForm = document.getElementById('nythera-chat-form');
        var minBtn = document.getElementById('nythera-chat-min-btn');
        var picker = document.getElementById('nythera-emoji-picker');
        if (!container) return;

        isMinimized = !isMinimized;
        if (picker) picker.style.display = 'none';

        if (isMinimized) {
            container.style.height = '28px';
            if (panels) panels.style.display = 'none';
            if (inputForm) inputForm.style.display = 'none';
            if (minBtn) {
                minBtn.innerText = '▲';
                minBtn.title = 'Expandir Chat';
            }
        } else {
            container.style.height = '235px';
            if (panels) panels.style.display = 'block';
            if (inputForm) inputForm.style.display = 'flex';
            if (minBtn) {
                minBtn.innerText = '—';
                minBtn.title = 'Minimizar Chat';
            }
            switchTab(currentTab);
        }
    }

    function toggleGhostMode() {
        ghostMode = !ghostMode;
        try {
            localStorage.setItem('nythera_chat_ghost', ghostMode ? 'true' : 'false');
        } catch (e) {}

        var ghostBtn = document.getElementById('nythera-chat-ghost-btn');
        if (ghostBtn) {
            ghostBtn.style.backgroundColor = ghostMode ? 'rgba(212, 160, 62, 0.28)' : 'transparent';
            ghostBtn.style.border = ghostMode ? '1px solid rgba(255, 215, 0, 0.6)' : '1px solid transparent';
            ghostBtn.style.opacity = ghostMode ? '1' : '0.5';
            ghostBtn.title = ghostMode ? 'Transparência ao Mover: Ativada' : 'Transparência ao Mover: Desativada';
        }

        var container = document.getElementById('nythera-chat-container');
        if (container && !ghostMode) {
            container.style.opacity = '1';
            container.style.pointerEvents = 'auto';
        }
    }

    function toggleEmojiPicker() {
        var picker = document.getElementById('nythera-emoji-picker');
        if (!picker) return;
        if (picker.style.display === 'none' || !picker.style.display) {
            picker.style.display = 'flex';
        } else {
            picker.style.display = 'none';
        }
    }

    function insertEmoji(emoji) {
        var input = document.getElementById('nythera-chat-input');
        if (!input) return;
        input.value += emoji;
        input.focus();
    }

    function switchTab(tabId) {
        currentTab = tabId;

        // Atualiza botões das abas
        var tabs = ['local', 'global', 'whisper', 'system'];
        tabs.forEach(function(id) {
            var btn = document.getElementById('nythera-tab-' + id);
            var box = document.getElementById('nythera-chat-history-' + id);
            var badge = document.getElementById('nythera-badge-' + id);

            if (id === tabId) {
                if (btn) {
                    btn.style.color = '#ffd700';
                    btn.style.backgroundColor = 'rgba(212, 160, 62, 0.22)';
                    btn.style.borderBottom = '2px solid #ffd700';
                }
                if (box) {
                    box.style.display = 'flex';
                    box.scrollTop = box.scrollHeight;
                }
                // Limpa notificações desta aba
                unreadCounts[id] = 0;
                if (badge) badge.style.display = 'none';
            } else {
                if (btn) {
                    btn.style.color = '#94a3b8';
                    btn.style.backgroundColor = 'transparent';
                    btn.style.borderBottom = '2px solid transparent';
                }
                if (box) box.style.display = 'none';
            }
        });

        // Sincroniza o seletor de envio e o placeholder
        var typeSel = document.getElementById('nythera-chat-type');
        var input = document.getElementById('nythera-chat-input');
        if (!typeSel || !input) return;

        if (tabId === 'local') {
            typeSel.style.display = 'block';
            typeSel.value = 'local';
            input.disabled = false;
            input.placeholder = 'Falar no mapa local...';
        } else if (tabId === 'global') {
            typeSel.style.display = 'block';
            typeSel.value = 'global';
            input.disabled = false;
            input.placeholder = 'Falar no canal global...';
        } else if (tabId === 'whisper') {
            typeSel.style.display = 'block';
            typeSel.value = 'whisper';
            input.disabled = false;
            input.placeholder = 'Ex: /w Nome mensagem ou Nome: mensagem...';
        } else if (tabId === 'system') {
            typeSel.style.display = 'none';
            input.disabled = true;
            input.placeholder = 'Canal de Sistema (somente leitura)';
        }
    }

    function sendChatMessage() {
        var input = document.getElementById('nythera-chat-input');
        var typeSel = document.getElementById('nythera-chat-type');
        if (!input || !typeSel) return;

        // Fecha o seletor de emojis se aberto
        var picker = document.getElementById('nythera-emoji-picker');
        if (picker) picker.style.display = 'none';

        var rawText = input.value.trim();
        if (!rawText) return;

        // Converte atalhos como :) em emojis reais
        var text = parseEmojis(rawText);

        var channel = typeSel.value;
        var targetPlayer = null;

        // Comandos de Barra (Slash Commands): /w ou /whisper ou /g ou /l
        if (text.startsWith('/w ') || text.startsWith('/whisper ') || text.startsWith('/tell ')) {
            var parts = text.split(' ');
            if (parts.length >= 3) {
                channel = 'whisper';
                targetPlayer = parts[1];
                text = parts.slice(2).join(' ');
            } else {
                addLogMessage('whisper', 'Sistema', 'Uso: /w NomeDoJogador Mensagem', '#ff6b6b');
                input.value = '';
                return;
            }
        } else if (text.startsWith('/g ')) {
            channel = 'global';
            text = text.substring(3).trim();
        } else if (text.startsWith('/l ')) {
            channel = 'local';
            text = text.substring(3).trim();
        } else if (text.startsWith('/help')) {
            addLogMessage(currentTab, 'Ajuda', 'Comandos: /w [Nome] [Mensagem], /g [Mensagem], /l [Mensagem]. Atalhos de emoji: :), :D, <3, :fire:, :sword:, :shield:, :gold:', '#38bdf8');
            input.value = '';
            return;
        } else if (channel === 'whisper') {
            // Se estiver na aba privado e digitar "Nome: Mensagem"
            var colonIdx = text.indexOf(':');
            if (colonIdx > 0) {
                targetPlayer = text.substring(0, colonIdx).trim();
                text = text.substring(colonIdx + 1).trim();
            } else {
                addLogMessage('whisper', 'Sistema', 'Para sussurrar use: /w Nome Mensagem ou Nome: Mensagem', '#ff6b6b');
                return;
            }
        }

        if (window.NET && NET.Client) {
            var payload = {
                type: 'CHAT_MSG_REQ',
                channel: channel,
                message: text
            };
            if (targetPlayer) {
                payload.target = targetPlayer;
            }
            NET.Client.send(payload);
        }

        input.value = '';
        input.blur();
    }

    function onChatMessage(data) {
        var cleanMessage = parseEmojis(data.message);

        var roleColor = '#ffffff';
        if (data.role === 'admin') roleColor = '#ff6b6b';
        else if (data.role === 'vip') roleColor = '#69db7c';

        var myName = (window.NET && NET.Client && NET.Client.character && NET.Client.character.name) || '';

        if (data.channel === 'whisper') {
            // Mensagem Privada
            var isFromMe = (data.sender === myName);
            var label = isFromMe ? ('[Para ' + (data.target || 'Desconhecido') + ']') : ('[De ' + data.sender + ']');
            addLogMessage('whisper', label, cleanMessage, '#f472b6', isFromMe ? '#fbcfe8' : roleColor);
        } else if (data.channel === 'system') {
            // Mensagem de Sistema
            addLogMessage('system', '[Sistema]', cleanMessage, '#38bdf8', '#ffd700');
        } else if (data.channel === 'global') {
            // Mensagem Global
            addLogMessage('global', '[Global] ' + data.sender, cleanMessage, '#ffedd5', roleColor);
        } else {
            // Mensagem Local
            addLogMessage('local', '[Local] ' + data.sender, cleanMessage, '#ffffff', roleColor);
        }

        // --- Adicionar Balão de Fala sobre o personagem (Apenas no mapa local) ---
        if (data.channel === 'local' && SceneManager._scene instanceof Scene_Map && data.characterId) {
            var targetChar = null;
            if (window.NET && window.NET.Client && window.NET.Client.character && window.NET.Client.character.id === data.characterId) {
                targetChar = $gamePlayer;
            } else if (window.getNetPlayer) {
                targetChar = window.getNetPlayer(data.characterId);
            }

            if (targetChar && SceneManager._scene._spriteset && SceneManager._scene._spriteset._tilemap) {
                if (targetChar._currentChatBubble && targetChar._currentChatBubble.parent) {
                    targetChar._currentChatBubble.parent.removeChild(targetChar._currentChatBubble);
                }
                var bubble = new Sprite_ChatBubble(targetChar, cleanMessage, data.sender, data.role);
                targetChar._currentChatBubble = bubble;
                SceneManager._scene._spriteset._tilemap.addChild(bubble);
            }
        }
    }

    function addLogMessage(destTab, senderPrefix, text, textColor, senderColor) {
        var box = document.getElementById('nythera-chat-history-' + destTab);
        if (!box) return;

        var line = document.createElement('div');
        line.style.lineHeight = '1.3';
        line.style.wordBreak = 'break-word';

        var senderSpan = document.createElement('strong');
        senderSpan.innerText = senderPrefix + ': ';
        senderSpan.style.color = senderColor || '#ffd280';

        var textSpan = document.createElement('span');
        textSpan.innerText = text;
        textSpan.style.color = textColor || '#ffffff';

        line.appendChild(senderSpan);
        line.appendChild(textSpan);
        box.appendChild(line);

        // Rolagem automática
        box.scrollTop = box.scrollHeight;

        // Notificação não lida se a mensagem for para uma aba inativa
        if (currentTab !== destTab) {
            unreadCounts[destTab] = (unreadCounts[destTab] || 0) + 1;
            var badge = document.getElementById('nythera-badge-' + destTab);
            if (badge) badge.style.display = 'inline-block';
        }
    }

    // Atalhos e Loop Principal do Mapa
    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);

        // Atualização da Transparência Dinâmica (Modo Fantasma 👻)
        if (ghostMode && !isMouseOverChat && !isChatFocused) {
            var isMoving = $gamePlayer && $gamePlayer.isMoving && $gamePlayer.isMoving();
            var container = document.getElementById('nythera-chat-container');
            if (container) {
                if (isMoving) {
                    container.style.opacity = '0.15';
                    container.style.pointerEvents = 'none';
                } else {
                    container.style.opacity = '1';
                    container.style.pointerEvents = 'auto';
                }
            }
        }

        // Pressionar Enter abre/expande o chat e foca a digitação
        if (Input.isTriggered('ok')) {
            var chatInput = document.getElementById('nythera-chat-input');
            if (isMinimized) {
                toggleMinimizeChat();
            }
            if (chatInput && document.activeElement !== chatInput && !chatInput.disabled) {
                chatInput.focus();
            }
        }
    };

    // =========================================================================
    // Sprite_ChatBubble (Balão na cabeça do personagem)
    // =========================================================================
    function Sprite_ChatBubble() {
        this.initialize.apply(this, arguments);
    }
    
    Sprite_ChatBubble.prototype = Object.create(Sprite.prototype);
    Sprite_ChatBubble.prototype.constructor = Sprite_ChatBubble;
    
    Sprite_ChatBubble.prototype.initialize = function(character, text, sender, role) {
        Sprite.prototype.initialize.call(this);
        this._character = character;
        this._text = text;
        this._sender = sender || '';
        this._role = role || 'normal';
        this._life = 300; // 5 segundos
        this.createBitmap();
    };
    
    Sprite_ChatBubble.prototype.createBitmap = function() {
        var tempBmp = new Bitmap(1, 1);
        tempBmp.fontSize = 13;
        
        var senderText = this._sender ? (this._sender + ': ') : '';
        var messageText = this._text;
        
        var senderWidth = senderText ? tempBmp.measureTextWidth(senderText) : 0;
        var messageWidth = tempBmp.measureTextWidth(messageText);
        var totalTextWidth = senderWidth + messageWidth;
        
        // Espaço extra para renderização segura de emojis
        var w = Math.min(Math.max(totalTextWidth + 30, 52), 430);
        var h = 28;
        
        this.bitmap = new Bitmap(w, h + 10);
        this.bitmap.fontSize = 13;
        this.anchor.x = 0.5;
        this.anchor.y = 1;
        this.z = 10;
        
        var ctx = this.bitmap.context;
        
        // Fundo estilo Dark Glassmorphism com acento dourado
        ctx.fillStyle = 'rgba(15, 20, 30, 0.9)';
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.45)';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(0, 0, w, h, 6);
        } else {
            ctx.rect(0, 0, w, h);
        }
        ctx.fill();
        ctx.stroke();
        
        // Ponta do balão apontando para o herói
        ctx.beginPath();
        ctx.moveTo(w / 2 - 5, h);
        ctx.lineTo(w / 2, h + 7);
        ctx.lineTo(w / 2 + 5, h);
        ctx.fill();
        ctx.stroke();
        
        var availableMessageWidth = Math.max(10, w - 26 - senderWidth);
        var startX = Math.max(12, Math.round((w - totalTextWidth) / 2));
        
        if (senderText) {
            var sColor = '#ffd280';
            if (this._role === 'admin') sColor = '#ff6b6b';
            else if (this._role === 'vip') sColor = '#69db7c';
            
            this.bitmap.textColor = sColor;
            this.bitmap.drawText(senderText, startX, -2, senderWidth, h, 'left');
        }
        
        this.bitmap.textColor = '#ffffff';
        this.bitmap.drawText(messageText, startX + senderWidth, -2, availableMessageWidth, h, 'left');
    };
    
    Sprite_ChatBubble.prototype.update = function() {
        Sprite.prototype.update.call(this);
        this._life--;
        if (this._life <= 0) {
            this.opacity -= 10;
            if (this.opacity <= 0 && this.parent) {
                if (this._character && this._character._currentChatBubble === this) {
                    this._character._currentChatBubble = null;
                }
                this.parent.removeChild(this);
            }
        }
        if (this._character) {
            this.x = this._character.screenX();
            this.y = this._character.screenY() - 56;
        }
    };
})();
