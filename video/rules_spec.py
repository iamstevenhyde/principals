import json
G = '../test/shots/'
S = [
dict(kicker='Principals · the rules', head='Welcome to Principals', points=['One decision', 'Five company boards', 'Played on your phone'], imgs=[dict(src=G+'1_projector_lobby.png', w='wide')],
 say="Welcome to Principals. You will sit on the board of a company facing a decision, and your whole board makes that one decision together on your phones."),
dict(kicker='Step 1', head='Join and wait for a seat', points=['Open the link or scan the code', 'Type your name', 'Your professor seats you'], imgs=[dict(src=G+'2_phone0_waiting.png')],
 say="To join, open the link or scan the code and type your name, and once your professor seats you, your phone shows your board and role."),
dict(kicker='Step 2', head='Read your briefing and card', points=['A one-screen briefing', 'A private role card', 'Your card is yours alone'], imgs=[dict(src=G+'4_phone0_briefing.png'), dict(src=G+'5_phone0_card.png')],
 say="You get a one-screen briefing and a private role card only you can see, and the card shows what you personally have at stake, which may differ from the company's interest."),
dict(kicker='Step 3', head='Talk it out loud', points=['Face to face with your board', 'Share what you choose to share'], imgs=[dict(src=G+'3_projector_meeting.png', w='wide')],
 say="Then you talk it through with your board, face to face, and you decide how much of your card to share."),
dict(kicker='Step 4', head='Vote for one option', points=['Four options, pick one', 'Change it until the Chair locks', 'A tie follows the Chair'], imgs=[dict(src=G+'7_phone0_vote.png'), dict(src=G+'8_projector_locked.png', w='wide')],
 say="Each director votes for one of four options and can change that vote until the Chair locks it in, and a tie goes the way the Chair chooses."),
dict(kicker='Step 5', head='The morning after', points=['A newspaper story', 'A stock move', 'Then the real case'], imgs=[dict(src=G+'10a_projector_newspaper.png', w='wide')],
 say="The projector then shows the morning after, a newspaper story and a move on the stock screen, and then we reveal the real company behind your board and what it did."),
dict(kicker='The end', head='Four short questions', points=['What would you do differently', 'We talk it through together'], imgs=[dict(src=G+'11_projector_questions.png', w='wide')],
 say="We finish with four questions for each board and talk through them together as a class."),
]
json.dump(dict(slides=S), open('rules.json','w',encoding='utf-8'), indent=1)
