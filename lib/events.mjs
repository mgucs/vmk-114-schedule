// Control works and colloquia a group's teachers announced in class: they are not in VMK's PDF, the students tell
// them. Only what was said: a date, what it is and the subject; no time or room unless it was announced too.
// kind: 'test' (контрольная) | 'colloquium' (коллоквиум).
export const EVENTS = [
  {group:'114', date:'2026-10-17', kind:'test', title:'Контрольная по матанализу', subject:'Математический анализ'},
  {group:'114', date:'2026-11-11', kind:'colloquium', title:'Коллоквиум по матанализу', subject:'Математический анализ'},
  {group:'114', date:'2026-11-28', kind:'colloquium', title:'Коллоквиум по линейной алгебре', subject:'Алгебра и геометрия'},
];

/** @param {string} group @returns {{group:string,date:string,kind:'test'|'colloquium',title:string,subject:string}[]} */
export const eventsOf = group => EVENTS.filter(e => e.group === group).sort((a, b) => a.date.localeCompare(b.date));
/** @param {string} group @param {string} date */
export const eventsOn = (group, date) => EVENTS.filter(e => e.group === group && e.date === date);
