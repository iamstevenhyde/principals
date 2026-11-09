import json
G = '../test/gallery/'
S = [
dict(kicker='Catch-back · Sunday Nov 8', head='Six things on the table', points=['1 Bede overnight', '2 JMP review podcast', '3 Principals game', '4 Design audit', '5 Tuesday slides', '6 What research is next'], imgs=[],
 say="Good morning. This is your catch-back for this session. Six things. Each one ends with a numbered choice in a dark box. Pause anytime and type your answer with its number, like three: yes. Or answer them all at the end."),
dict(kicker='1 · Bede overnight', head='Three useful, three stuck', points=['Done: JMP review draft', 'Done: CEO paper idea list', 'Done: poem art pairing', 'Stuck: edu-book needs your coding'], imgs=[],
 decide='1. Code the 38-item edu-book sheet this week, or park it?',
 say="Bede overnight. Three jobs worked: the JMP referee report draft, a ranked list of improvements for the CEO characteristics paper, and the poem art pairing, which gave art to one hundred six of one hundred sixty one poems. The Principals job failed, but that's fine: the work was already done here on the laptop and is live. The cloister split stopped partway. The edu-book job is waiting on you: thirty eight items to code by hand on a blind sheet. Choice one: code it this week, or park it."),
dict(kicker='2 · JMP review', head='In tomorrow morning\'s podcast', points=['Bede drafted it in your review style', 'MP3 is in the morning folder', 'Due about Nov 13'], imgs=[],
 decide='2. After you listen: send it as is, or edit together?',
 say="Two, the JMP review. Manuscript twelve sixty eight, on CEO promotion focus and AI talk at Chinese firms. The draft says the question is timely, but raises serious concerns about measurement, identification and theory. It's in tomorrow's podcast. One flag: the page numbers follow the PDF, and the printed footer runs one lower. It's due around November thirteenth. Choice two, after you listen: send as is, or edit it together."),
dict(kicker='3 · Principals', head='Built, live, and on video', points=['Every-screen page', 'Three-views page', 'Walkthrough video, 7 minutes'], imgs=[dict(src=G+'027_projector.png', w='wide')],
 decide='3. Rehearse Monday on two phones? (needs Supabase set up first)',
 say="Three, Principals. The fact voting version is live. You have two pages: every screen on one sheet, and the three views side by side: team phone, outside player, projector. And a seven minute walkthrough video using a real test game. Still not done: the Supabase table setup and a rehearsal on two real phones. That's the first live test of the online mode, so it matters. Choice three: rehearse Monday?"),
dict(kicker='4 · Design audit', head='Ten fixes; the phone is the big one', points=['Phone scrolls ~3,000 pixels', 'Motions: icons, not sentences', 'Facts: severity bars', 'Reveal: slides, not a wall'], imgs=[dict(src=G+'004_team.png', y=50)],
 decide='4. Before Tuesday, fix the phone screen only? Or all ten after class?',
 say="Four, the design audit. Ten fixes, all in the spirit of your Bull Market pass: less text, more pictures. The biggest: the director's phone is about three thousand pixels of scroll. Split it into three steps, facts, statement, motions. Turn the motions into one line each with stakeholder icons. Show fact severity as bars. And turn the reveal wall into host-driven slides. One note: I couldn't find a written Bull Market audit, so it used your Bull Market notes and the board audit as the model. Choice four: fix just the phone before Tuesday, or all ten after class?"),
dict(kicker='5 · Tuesday slides', head='Not touched yet', points=['Week12_Governance.pptx', 'King portraits already placed', 'Game slot needs to match the new rules'], imgs=[],
 decide='5. Check the deck today, or Monday?',
 say="Five, Tuesday's slides. The governance deck exists, with the king portraits already set. I haven't touched it this session. It probably needs the game section updated to the fact voting rules, since the old deck may still say tell, spin, bury. Choice five: check the deck today, or Monday."),
dict(kicker='6 · Research next', head='Kristen\'s JMP R&R', points=['H2 is fragile: drop it', 'The A x N result holds', 'Open: the DV versus Gentry', 'Meeting with Kristen this week'], imgs=[],
 decide='6. Prep for the Kristen meeting: settle the DV question first?',
 say="Six, research. Your instinct was Kristen's JMP revise and resubmit, and that fits: you replied on November sixth and the ball is with her, with a meeting this week. What we know: H2 is fragile and should go; the A by N interaction holds up. The open question is the dependent variable versus Gentry's. Choice six: make the meeting prep about settling that DV question first?"),
dict(kicker='About this format', head='Was this easier?', points=['Numbered choices', 'Pause and answer', 'One project per chapter'], imgs=[],
 decide='7. Keep catch-back videos? Every session, or only when asked?',
 say="Last one, about this format itself. If this worked better than a long chat message, I'll keep doing it. Choice seven: a catch-back video at the end of every working session, or only when you ask. That's everything. Thanks."),
]
json.dump(dict(slides=S), open('catchback.json', 'w', encoding='utf-8'), indent=1)
