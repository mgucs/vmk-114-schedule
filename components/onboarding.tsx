const onboardedKey = 'vmk-onboarded';
export const needsOnboarding = () => { try { return !localStorage.getItem(onboardedKey) && !localStorage.getItem('vmk-group'); } catch { return false; } };
export const markOnboarded = () => { try { localStorage.setItem(onboardedKey, '1'); } catch {} };
// The first visit asks one thing, the group, in the same group window (circles) as the group button in the header
// (page.tsx): it opens by itself and closes once a group is picked. Subgroups, style and colours wait in the settings.
