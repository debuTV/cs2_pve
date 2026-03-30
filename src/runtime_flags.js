export const TEMP_DISABLE = Object.freeze({
    monsterSkills: true,
    monsterBuffs: true,
    playerBuffs: true,
});

export function getActiveTempDisableKeys() {
    return Object.entries(TEMP_DISABLE)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);
}
