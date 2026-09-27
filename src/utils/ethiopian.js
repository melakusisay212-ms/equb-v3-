export const ethMonths = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'
];

export const ethWeekdays = ['እሁድ', 'ሰኞ', 'ማክሰ', 'ረቡዕ', 'ሐሙስ', 'አርብ', 'ቅዳሜ'];

/** Approximate Ethiopian date from current Gregorian date */
export function getEthiopianToday() {
  const now = new Date();
  const gYear = now.getFullYear();
  const gMonth = now.getMonth() + 1;
  const gDay = now.getDate();

  let ethYear = gYear - 8;
  if (gMonth > 9 || (gMonth === 9 && gDay >= 11)) {
    ethYear = gYear - 7;
  }

  // Simplified month mapping (good enough for display)
  const ethMonthIndex = (gMonth + 3) % 13;
  const ethDay = Math.min(gDay, 30);

  return {
    year: ethYear,
    monthIndex: ethMonthIndex,
    day: ethDay,
    formatted: `${ethMonths[ethMonthIndex]} ${ethDay}, ${ethYear}`,
    short: `${ethMonths[ethMonthIndex]} ${ethDay}`
  };
}

export function formatEthDate(eth) {
  if (!eth) return '—';
  if (typeof eth === 'string') return eth;
  return `${ethMonths[eth.monthIndex] || ''} ${eth.day}, ${eth.year}`;
}

/** Rough finish date calculation */
export function estimateFinishDate(start, cycleType, totalMembers) {
  let day = start.day;
  let month = start.monthIndex;
  let year = start.year;

  if (cycleType === 'daily') day += totalMembers;
  else if (cycleType === 'weekly') day += totalMembers * 7;
  else if (cycleType === 'biweekly') day += totalMembers * 14;
  else month += totalMembers; // monthly

  while (day > 30) {
    day -= 30;
    month++;
  }
  while (month > 12) {
    month -= 13;
    year++;
  }

  return {
    year,
    monthIndex: month,
    day: Math.min(day, 30)
  };
}
