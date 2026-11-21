// Group 114's December announcement. A missing end time means only the start was given.
const december = [
  {date:'2026-12-21', time:'10:00', end:'12:00', subject:'Линейная алгебра', note:'1-я попытка'},
  {date:'2026-12-21', time:'14:00', end:'16:00', subject:'ЭВМ'},
  {date:'2026-12-22', time:'10:00', end:'15:00', subject:'Математический анализ'},
  {date:'2026-12-23', time:'14:00', end:'16:00', subject:'БЖД'},
  {date:'2026-12-24', time:'11:00', subject:'ЭВМ'},
  {date:'2026-12-25', time:'09:00', end:'14:00', subject:'Математический анализ'},
  {date:'2026-12-25', time:'15:00', end:'17:00', subject:'Линейная алгебра', note:'2-я попытка'},
  {date:'2026-12-26', time:'10:00', end:'12:00', subject:'Линейная алгебра', retake:true},
  {date:'2026-12-26', time:'14:00', subject:'ЭВМ'},
];

export function announcedCredits(group, year, officialCredits = []) {
  if (group !== '114' || year !== 2026) return [];
  return officialCredits.length ? december.filter(entry => entry.retake) : december;
}

export const announcedType = entry => entry.retake ? 'Пересдача коллоквиума' : 'Зачёт';
export const announcedTime = entry => entry.end ? `${entry.time}–${entry.end}` : entry.time;
