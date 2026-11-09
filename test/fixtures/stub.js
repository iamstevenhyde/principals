// Tiny stub content, used only when content/ is empty. Generic text on purpose.
const seats = ['attorney', 'labor', 'fund', 'founder_friend', 'community'];
const mk = (id, name, industry) => ({
  id, name, industry, blurb: name + ' stub board.',
  directors: seats.map(seat => ({ seat, name: seat + ' ' + id, title: 'Director', home: 'Home', motive: 'A private motive for ' + seat + '.' })),
  briefing: { intro: 'Setting for ' + name + '.', facts: ['First fact.', 'Second fact.'] },
  decision: { lead: 'Pick one.', options: [1, 2, 3, 4].map(n => ({ n, title: 'Option ' + n, text: 'Text of option ' + n + '.' })) },
  reveal: { case: 'A real case', text: 'What happened.' }, questions: ['Question one?'],
});
export const STUB = { boards: [mk('heartland', 'Heartland Beef', 'Beef'), mk('summit', 'Summit Peaks', 'Ski'), mk('valley', 'Valley Health', 'Health'), mk('thread', 'Thread & Co.', 'Apparel'), mk('lumen', 'Lumen Search', 'Search')], game: { title: 'The Board Meeting', text: 'Read, talk, vote.' } };
