export type StageId = "morning" | "dusk" | "night";
export type BeneficialType = "cicada" | "dragonfly" | "beetle";
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
    description: "茜の空とトンボが舞う、静かな宵。",
    titleAction: "夕暮れを守る",
    background: "/manus-storage/naika-room-background-dusk-tatami-wide_086167ff.png",
    overlay: "linear-gradient(rgba(146, 55, 35, .18), rgba(39, 29, 70, .48))",
    gameplayBgm: "/manus-storage/naika-dusk-stage-bgm_ed66c60d.wav",
    beneficial: "dragonfly",
    beneficialLabel: "トンボ",
    skillMotif: "fujin",
    skillLabel: "風神の突風",
  },
  night: {
    id: "night",
    label: "月夜の防衛",
    shortLabel: "夜",
    description: "満月と行灯に誘われ、カブトムシが訪れる夜。",
    titleAction: "夜を守る",
    background: "/manus-storage/naika-room-background-night-tatami-wide_07b8a0e5.png",
    overlay: "linear-gradient(rgba(10, 24, 45, .35), rgba(10, 24, 45, .72))",
    gameplayBgm: "/manus-storage/naika-night-defense-loop-no-bell_33ace5a3.mp3",
    beneficial: "beetle",
    beneficialLabel: "カブトムシ",
    skillMotif: "raijin",
    skillLabel: "雷神の雷撃",
  },
};

export const BENEFICIAL_CELL: Record<BeneficialType, number> = { cicada: 0, dragonfly: 1, beetle: 2 };
export const SKILL_CELL: Record<SkillMotif, number> = { buddha: 0, fujin: 1, raijin: 2 };
