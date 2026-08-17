export type StageId = "morning" | "dusk" | "night";
export type BeneficialType = "cicada" | "firefly" | "moth";
export type SkillMotif = "buddha" | "fujin" | "raijin";

export type StagePresentation = {
  id: StageId;
  label: string;
  shortLabel: string;
  description: string;
  titleAction: string;
  background: string;
  overlay: string;
  gameplayBgm: string;
  beneficial: BeneficialType;
  beneficialLabel: string;
  skillMotif: SkillMotif;
  skillLabel: string;
};

export const STAGE_PRESENTATIONS: Record<StageId, StagePresentation> = {
  morning: {
    id: "morning",
    label: "朝の猛暑",
    shortLabel: "朝",
    description: "照りつける日差しと蝉が満ちる、真夏の朝。",
    titleAction: "朝を守る",
    background: "/manus-storage/naika-room-background-morning-tatami-wide_b31d6bd6.png",
    overlay: "linear-gradient(rgba(255, 247, 205, .12), rgba(64, 105, 74, .38))",
    gameplayBgm: "/manus-storage/naika-morning-stage-bgm_df86c38d.wav",
    beneficial: "cicada",
    beneficialLabel: "蝉",
    skillMotif: "buddha",
    skillLabel: "仏手の挟撃",
  },
  dusk: {
    id: "dusk",
    label: "夕暮れの縁側",
    shortLabel: "夕暮れ",
    description: "茜の空と蛍の光が畳を照らす、静かな宵。",
    titleAction: "夕暮れを守る",
    background: "/manus-storage/naika-room-background-dusk-tatami-ratio-props_ca945533.png",
    overlay: "linear-gradient(rgba(255, 128, 58, .08), rgba(39, 29, 70, .40))",
    gameplayBgm: "/manus-storage/naika-dusk-stage-bgm_ed66c60d.wav",
    beneficial: "firefly",
    beneficialLabel: "蛍",
    skillMotif: "fujin",
    skillLabel: "風神の突風",
  },
  night: {
    id: "night",
    label: "月夜の防衛",
    shortLabel: "夜",
    description: "満月と行灯に誘われ、蛾が舞い込む夜。",
    titleAction: "夜を守る",
    background: "/manus-storage/naika-room-background-night-tatami-ratio-props_59bda6b7.png",
    overlay: "linear-gradient(rgba(7, 18, 42, .24), rgba(8, 20, 48, .58))",
    gameplayBgm: "/manus-storage/naika-night-defense-loop-no-bell_33ace5a3.mp3",
    beneficial: "moth",
    beneficialLabel: "蛾",
    skillMotif: "raijin",
    skillLabel: "雷神の雷撃",
  },
};

export const BENEFICIAL_CELL: Record<BeneficialType, number> = { cicada: 0, firefly: 1, moth: 2 };
export const SKILL_CELL: Record<SkillMotif, number> = { buddha: 0, fujin: 1, raijin: 2 };
