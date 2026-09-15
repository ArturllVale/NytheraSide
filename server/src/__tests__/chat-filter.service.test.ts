import { describe, it, expect, beforeEach } from 'vitest';
import { ChatFilterService } from '../modules/world/chat-filter.service';

describe('ChatFilterService', () => {
  let service: ChatFilterService;

  beforeEach(() => {
    service = new ChatFilterService();
  });

  it('permite mensagens normais', () => {
    const result = service.validateAndFilter('char-1', 'Olá mundo, bom dia a todos!');
    expect(result.allowed).toBe(true);
    expect(result.filteredText).toBe('Olá mundo, bom dia a todos!');
  });

  it('censura palavras proibidas configuradas', () => {
    const result = service.validateAndFilter('char-1', 'Alguém tem hack ou bot?');
    expect(result.allowed).toBe(true);
    expect(result.filteredText).toContain('***');
    expect(result.filteredText).not.toContain('hack');
    expect(result.filteredText).not.toContain('bot');
  });

  it('bloqueia flood de mensagens repetidas idênticas após o limite', () => {
    const charId = 'char-repeat';
    // 1ª vez: ok
    expect(service.validateAndFilter(charId, 'vende-se espada').allowed).toBe(true);
    // 2ª vez: ok
    expect(service.validateAndFilter(charId, 'vende-se espada').allowed).toBe(true);
    // 3ª vez: atinge limite configurado (3)
    const third = service.validateAndFilter(charId, 'vende-se espada');
    expect(third.allowed).toBe(false);
    expect(third.reason).toContain('Evite repetir');
  });

  it('bloqueia rajada de flood rápido', () => {
    const charId = 'char-flood';
    // Envia 6 mensagens em sequência rápida
    for (let i = 0; i < 6; i++) {
      expect(service.validateAndFilter(charId, `Mensagem rápida ${i}`).allowed).toBe(true);
    }
    // A 7ª mensagem no mesmo segundo estoura o burst (máx 6)
    const blocked = service.validateAndFilter(charId, 'Mensagem rápida 7');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('digitando rápido demais');
  });
});
