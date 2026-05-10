export const BABY_SIZES: Record<number, { size: string; emoji: string; fact: string }> = {
  1: { size: "poppy seed", emoji: "🌱", fact: "Your journey just began — cells are dividing rapidly." },
  2: { size: "sesame seed", emoji: "🌱", fact: "Implantation is happening this week." },
  3: { size: "chia seed", emoji: "🌱", fact: "The neural tube is forming." },
  4: { size: "poppy seed", emoji: "🫘", fact: "Tiny but mighty — the heart begins to form." },
  5: { size: "sesame seed", emoji: "🫘", fact: "Baby's heart starts to beat this week!" },
  6: { size: "lentil", emoji: "🫛", fact: "Facial features are starting to develop." },
  7: { size: "blueberry", emoji: "🫐", fact: "Tiny arm and leg buds are forming." },
  8: { size: "raspberry", emoji: "🍓", fact: "Fingers and toes are beginning to form." },
  9: { size: "cherry", emoji: "🍒", fact: "Baby is officially a fetus now!" },
  10: { size: "strawberry", emoji: "🍓", fact: "Vital organs are functioning." },
  11: { size: "lime", emoji: "🍋", fact: "Baby can hiccup now." },
  12: { size: "plum", emoji: "🍑", fact: "Reflexes are developing." },
  13: { size: "lemon", emoji: "🍋", fact: "Welcome to the second trimester!" },
  14: { size: "peach", emoji: "🍑", fact: "Baby can make facial expressions." },
  15: { size: "apple", emoji: "🍎", fact: "Baby is forming taste buds." },
  16: { size: "avocado", emoji: "🥑", fact: "You may feel first flutters soon." },
  17: { size: "pomegranate", emoji: "🍎", fact: "Baby's skeleton is hardening." },
  18: { size: "bell pepper", emoji: "🫑", fact: "Baby can hear sounds now." },
  19: { size: "mango", emoji: "🥭", fact: "Vernix is forming on baby's skin." },
  20: { size: "banana", emoji: "🍌", fact: "Halfway there! Time for an anatomy scan." },
  21: { size: "carrot", emoji: "🥕", fact: "Baby is swallowing amniotic fluid." },
  22: { size: "papaya", emoji: "🥭", fact: "Eyebrows and eyelids are fully formed." },
  23: { size: "grapefruit", emoji: "🍊", fact: "Baby can hear your voice clearly." },
  24: { size: "ear of corn", emoji: "🌽", fact: "Baby reaches viability milestone." },
  25: { size: "rutabaga", emoji: "🥬", fact: "Baby is responding to your voice." },
  26: { size: "scallion", emoji: "🥬", fact: "Eyes are opening for the first time." },
  27: { size: "cauliflower", emoji: "🥦", fact: "Welcome to the third trimester!" },
  28: { size: "eggplant", emoji: "🍆", fact: "Baby is dreaming (REM sleep)." },
  29: { size: "butternut squash", emoji: "🎃", fact: "Bones are fully developed but soft." },
  30: { size: "cabbage", emoji: "🥬", fact: "Baby's brain is rapidly developing." },
  31: { size: "coconut", emoji: "🥥", fact: "Baby is gaining weight quickly." },
  32: { size: "jicama", emoji: "🥔", fact: "Baby has fingernails and toenails." },
  33: { size: "pineapple", emoji: "🍍", fact: "Baby's immune system is strengthening." },
  34: { size: "cantaloupe", emoji: "🍈", fact: "Lungs are nearly fully developed." },
  35: { size: "honeydew", emoji: "🍈", fact: "Baby is settling head-down." },
  36: { size: "papaya", emoji: "🥭", fact: "Baby is considered early term soon." },
  37: { size: "winter melon", emoji: "🍈", fact: "Baby is considered early term." },
  38: { size: "pumpkin", emoji: "🎃", fact: "Baby's brain is still developing." },
  39: { size: "watermelon", emoji: "🍉", fact: "Full term — baby could come any day!" },
  40: { size: "small pumpkin", emoji: "🎃", fact: "Your due date is here. Hang in there!" },
};

export function babyAt(week: number) {
  const w = Math.max(1, Math.min(40, Math.round(week)));
  return { week: w, ...BABY_SIZES[w] };
}

export function trimesterOf(week: number): 1 | 2 | 3 {
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}
