// Verbindliche IDs aus 15.5 (ASCII, kleingeschrieben).

export const CLASS_IDS = ['krieger', 'magier', 'waldlaeufer', 'schurke', 'kleriker', 'runenweber'] as const;
export const ELEMENT_IDS = ['physisch', 'feuer', 'eis', 'blitz', 'erde', 'licht', 'schatten'] as const;
export const STAT_IDS = ['leb', 'kra', 'rue', 'res', 'tmp', 'krt', 'ksd', 'ele'] as const;
export const ITEM_STAT_IDS = ['leb', 'kra', 'rue', 'res', 'tmp', 'krt'] as const;
export const SLOT_IDS = ['waffe', 'ruestung', 'nebenhand', 'helm', 'handschuhe', 'umhang', 'stiefel'] as const;
export const RARITY_IDS = ['gewoehnlich', 'ungewoehnlich', 'selten', 'episch', 'legendaer'] as const;
export const ENEMY_IDS = [
  'scherge', 'hetzer', 'schuetze', 'schwarmling', 'brecher', 'priester', 'kultist', 'bomber', 'waechter',
] as const;
export const BOSS_IDS = ['ignarch', 'glaciara', 'voltrax', 'gorthul', 'solaris', 'nyxhara'] as const;
export const GEM_IDS = ['granat', 'rubin', 'onyx', 'aquamarin', 'topas', 'saphir', 'smaragd'] as const;
export const STATUS_IDS = [
  'verbrennung', 'frost', 'eingefroren', 'schock', 'ruestungsbruch', 'blendung', 'verderbnis',
  'gift', 'blutung', 'betaeubung', 'wurzel', 'furcht', 'runenbruch', 'verspottet',
  'angriffstempo_malus', 'bewegung_malus',
  'schild', 'regeneration', 'raserei', 'kraftrune', 'schutzrune', 'runensturm', 'adlerauge',
  'tarnung', 'bollwerk', 'spott_schutz', 'unverwundbar',
] as const;
export const HANDLER_IDS = [
  'taunt', 'pierce', 'trap', 'barrage', 'conditionalBonus', 'teleportBehind', 'channelSpin',
  'groundDelayed', 'cleanse', 'revive', 'overhealShield', 'cooldownResetOnSwap',
  'buffedDamageReduction', 'rollCooldown', 'modifyValue',
  'boss_glutmantel', 'boss_eispanzer', 'boss_statische_ladung', 'boss_steinhaut',
  'boss_sonnenschild', 'boss_schattenhuelle',
  'sig_glutregen', 'sig_frostnova', 'sig_kettenblitz', 'sig_beben', 'sig_strahlenbuendel', 'sig_stille',
  'enemy_priest_heal', 'enemy_bomber', 'enemy_guardian_shield', 'enemy_cultist_orb', 'elite_slam',
  'affix_schild', 'affix_rasend', 'affix_blutsauger', 'affix_regenerierend',
  'hazard_feuersaeule', 'hazard_eisbrocken', 'hazard_blitz', 'hazard_wurzel',
  'hazard_lichtstrahl', 'hazard_schattenzone',
] as const;
export const ARTIFACT_SLOTS = ['amulett', 'ring', 'relikt'] as const;
export const SKILL_SLOTS = ['auto', 's1', 's2', 's3', 'ult', 'passive'] as const;
/** Ausrüstungsplätze eines Helden (15.1, Spalte equip_slot). */
export const EQUIP_SLOTS = [
  'Waffe_A', 'Waffe_B', 'Ruestung', 'Nebenhand', 'Helm', 'Handschuhe', 'Umhang', 'Stiefel',
] as const;

export type ClassId = (typeof CLASS_IDS)[number];
export type ElementId = (typeof ELEMENT_IDS)[number];
export type StatId = (typeof STAT_IDS)[number];
export type ItemStatId = (typeof ITEM_STAT_IDS)[number];
export type SlotId = (typeof SLOT_IDS)[number];
export type RarityId = (typeof RARITY_IDS)[number];
export type EnemyId = (typeof ENEMY_IDS)[number];
export type BossId = (typeof BOSS_IDS)[number];
export type GemId = (typeof GEM_IDS)[number];
export type StatusId = (typeof STATUS_IDS)[number];
export type HandlerId = (typeof HANDLER_IDS)[number];
export type ArtifactSlot = (typeof ARTIFACT_SLOTS)[number];
export type SkillSlot = (typeof SKILL_SLOTS)[number];
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

/** Zuordnung Item-Slot (15.5) zu Ausrüstungsplatz (15.1). Waffen haben zwei Plätze (8.6). */
export const EQUIP_SLOT_OF: Record<Exclude<SlotId, 'waffe'>, EquipSlot> = {
  ruestung: 'Ruestung',
  nebenhand: 'Nebenhand',
  helm: 'Helm',
  handschuhe: 'Handschuhe',
  umhang: 'Umhang',
  stiefel: 'Stiefel',
};
