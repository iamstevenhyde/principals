# One-time migration: replace issue tell/spin/bury/detect_base with a fact list. Run once on facts-disclosure.
import json, glob
F = {
 'ammonia_leak': [("An ammonia line at the plant sprang a leak last month.",1),("The floor was cleared for twenty minutes.",2),("Nobody reported it to the regulator.",3),("The cooling system has not been replaced.",2)],
 'grader_bias': [("The AI carcass grader pilot has been downgrading cattle from small ranchers' herds.",2),("Ranchers are paid by grade, so they were paid less for the same animals.",3),("The pilot data shows the pattern clearly.",2),("The plant is still using the grader.",1)],
 'cancel_clause': [("Small-rancher contracts let Heartland cancel on 30 days' notice.",3),("Most ranchers have not read the clause.",2),("The board has now voted on how to use it.",1)],
 'bot_traffic': [("About a fifth of last quarter's traffic was bots.",3),("Advertisers paid for that traffic.",2),("Internal analytics flagged it three weeks ago.",2),("Nobody has told the advertisers.",1)],
 'moderation_gap': [("Human moderators were cut and the model took over.",1),("Flagged content that should have come down within the hour stayed up.",2),("Internal logs count 40,000 pieces in three weeks.",3)],
 'covenant_breach': [("Lumen breached a debt covenant last month.",3),("The lenders have not been told.",2),("Waiver talks go easier if revenue looks steady.",1)],
 'chair7_overdue': [("Chair 7's safety inspection is 14 months overdue.",3),("A cable on the lift showed wear.",2),("Operations knew in March.",2),("The lift stayed open through the holiday peak.",1)],
 'zip_pricing': [("The SnowSense pricing pilot charged Alder Creek zip codes 18% more.",3),("Locals buy late and do not shop around, so the model targeted them.",2),("The pilot ran last spring and the model is still in use.",1)],
 'pension_gap': [("The staff pension is underfunded by $60M.",3),("Skipping the payment is legal.",1),("Workers think the fund is safe.",2)],
 'fake_recycled': [("The recycled line is mostly virgin polyester.",3),("A supplier swapped the material two seasons ago to hit cost targets.",2),("The labels never changed.",2),("Nobody has tested the fabric.",1)],
 'copied_prints': [("The AI design tool produced a spring print that matches an independent designer's portfolio almost line for line.",3),("Her work was in the tool's training set.",2),("She has not noticed yet.",1),("The line is ready to ship.",1)],
 'unpaid_factory': [("Thread & Co. owes the largest Karvan factory $18M in unpaid invoices.",3),("Another quarter without payment will probably close the factory.",2),("About 2,000 people would be out of work.",2)],
 'upcoded_billing': [("Billing codes were bumped up on about one in eight inpatient stays.",3),("It adds roughly $14M a year.",2),("Only the internal review team has seen it.",1),("Nothing the board buys this round removes the problem.",1)],
 'sepsis_miss': [("In testing, the AI triage pilot missed 9 of 40 sepsis cases that nurses caught.",3),("The vendor knows.",1),("The system plans to extend the pilot to the rural clinics next month.",2)],
 'clinic_closure': [("The system plans to close the Marrow Creek rural clinic.",3),("The clinic serves 11,000 people.",2),("The lease ends in March.",1),("Nothing has been announced.",1)],
}
for f in sorted(glob.glob('content/boards/*.json')):
    d = json.load(open(f, encoding='utf8'))
    for r in d['rounds']:
        i = r['issue']
        facts = F[i['id']]
        i['facts'] = [{'id': 'f%d' % (n + 1), 'text': t, 'weight': w} for n, (t, w) in enumerate(facts)]
        for k in ('tell', 'spin', 'bury', 'detect_base'): i.pop(k, None)
    json.dump(d, open(f, 'w', encoding='utf8'), indent=2, ensure_ascii=False)
    open(f, 'a', encoding='utf8').write('\n')
