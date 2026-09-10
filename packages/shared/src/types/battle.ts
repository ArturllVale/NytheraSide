export interface Battler {
  id: string; // unique instance id
  templateId: number; // class or enemy id
  isEnemy: boolean;
  name: string;
  hp: number;
  mp: number;
  mhp: number; // max hp
  mmp: number; // max mp
  atk: number;
  def: number;
  mat: number;
  mdf: number;
  agi: number;
  luk: number;
  isDead: boolean;
  // RM MV stats map: 0:hp, 1:mp, 2:atk, 3:def, 4:mat, 5:mdf, 6:agi, 7:luk
}

export interface BattleState {
  id: string;
  turn: number;
  party: Battler[];
  troop: Battler[];
  status: 'ACTIVE' | 'WON' | 'LOST' | 'FLEED';
}
