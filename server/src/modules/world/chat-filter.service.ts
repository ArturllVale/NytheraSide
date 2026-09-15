import fs from 'fs';
import path from 'path';

export interface ChatFilterConfig {
  bannedWords: string[];
  filterMode: 'censor' | 'block';
  censorReplacement: string;
  repeatMessage: {
    maxRepeats: number;
    windowSeconds: number;
    cooldownSeconds: number;
  };
  flood: {
    maxBurst: number;
    windowSeconds: number;
    cooldownSeconds: number;
  };
}

interface PlayerChatHistory {
  lastMessage: string;
  repeatCount: number;
  lastMessageTime: number;
  burstTimestamps: number[];
  cooldownUntil: number;
}

export class ChatFilterService {
  private config: ChatFilterConfig;
  private playerHistories = new Map<string, PlayerChatHistory>();
  private configPath: string;

  constructor() {
    this.configPath = path.resolve(__dirname, '../../config/chat-filter.json');
    this.config = this.loadConfig();
  }

  public loadConfig(): ChatFilterConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.warn('[ChatFilterService] Falha ao ler chat-filter.json, usando padrão:', err);
    }

    return {
      bannedWords: ['hack', 'cheat', 'bot'],
      filterMode: 'censor',
      censorReplacement: '***',
      repeatMessage: {
        maxRepeats: 3,
        windowSeconds: 10,
        cooldownSeconds: 5,
      },
      flood: {
        maxBurst: 6,
        windowSeconds: 3,
        cooldownSeconds: 4,
      },
    };
  }

  public reloadConfig(): void {
    this.config = this.loadConfig();
  }

  public validateAndFilter(characterId: string, message: string): { allowed: boolean; filteredText: string; reason?: string } {
    const now = Date.now();
    let history = this.playerHistories.get(characterId);
    if (!history) {
      history = {
        lastMessage: '',
        repeatCount: 0,
        lastMessageTime: 0,
        burstTimestamps: [],
        cooldownUntil: 0,
      };
      this.playerHistories.set(characterId, history);
    }

    // 1. Verificação de Cooldown ativo
    if (now < history.cooldownUntil) {
      const waitSeconds = Math.ceil((history.cooldownUntil - now) / 1000);
      return {
        allowed: false,
        filteredText: message,
        reason: `Aguarde ${waitSeconds} segundo(s) antes de enviar outra mensagem.`,
      };
    }

    // 2. Verificação de Flood (Rajada de mensagens)
    const floodWindowMs = (this.config.flood?.windowSeconds || 3) * 1000;
    history.burstTimestamps = history.burstTimestamps.filter((t) => now - t < floodWindowMs);
    history.burstTimestamps.push(now);

    const maxBurst = this.config.flood?.maxBurst || 6;
    if (history.burstTimestamps.length > maxBurst) {
      const cooldownMs = (this.config.flood?.cooldownSeconds || 4) * 1000;
      history.cooldownUntil = now + cooldownMs;
      const waitSec = Math.ceil(cooldownMs / 1000);
      return {
        allowed: false,
        filteredText: message,
        reason: `Você está digitando rápido demais. Aguarde ${waitSec} segundos.`,
      };
    }

    // 3. Verificação de Mensagens Idênticas Repetidas (Anti-Spam)
    const trimmed = message.trim().toLowerCase();
    const repeatWindowMs = (this.config.repeatMessage?.windowSeconds || 10) * 1000;
    const isSameMessage = trimmed === history.lastMessage.toLowerCase();
    const isWithinRepeatWindow = now - history.lastMessageTime < repeatWindowMs;

    if (isSameMessage && isWithinRepeatWindow) {
      history.repeatCount += 1;
      const maxRepeats = this.config.repeatMessage?.maxRepeats || 3;
      if (history.repeatCount >= maxRepeats) {
        const cooldownMs = (this.config.repeatMessage?.cooldownSeconds || 5) * 1000;
        history.cooldownUntil = now + cooldownMs;
        const waitSec = Math.ceil(cooldownMs / 1000);
        return {
          allowed: false,
          filteredText: message,
          reason: `Evite repetir a mesma mensagem. Aguarde ${waitSec} segundos antes de falar novamente.`,
        };
      }
    } else {
      history.lastMessage = trimmed;
      history.repeatCount = 1;
    }
    history.lastMessageTime = now;

    // 4. Filtro de Palavras Proibidas (Banned Words)
    let filteredText = message;
    const banned = this.config.bannedWords || [];
    for (const word of banned) {
      if (!word || word.trim().length === 0) continue;
      // Escapa caracteres especiais de regex
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b|${escaped}`, 'gi');

      if (regex.test(filteredText)) {
        if (this.config.filterMode === 'block') {
          return {
            allowed: false,
            filteredText: message,
            reason: 'Sua mensagem contém palavras proibidas e foi bloqueada.',
          };
        } else {
          // Substitui pela máscara configurada (ex: ***)
          filteredText = filteredText.replace(regex, this.config.censorReplacement || '***');
        }
      }
    }

    return {
      allowed: true,
      filteredText,
    };
  }

  public cleanOldHistories(): void {
    const now = Date.now();
    const expireTime = 60 * 1000; // 1 minuto inativo
    for (const [charId, hist] of this.playerHistories.entries()) {
      if (now - hist.lastMessageTime > expireTime && now > hist.cooldownUntil) {
        this.playerHistories.delete(charId);
      }
    }
  }
}

export const chatFilterService = new ChatFilterService();
