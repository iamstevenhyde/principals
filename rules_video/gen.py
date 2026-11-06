import asyncio, edge_tts, json, subprocess
L=["Principals. You are a director on a company's board. Your card tells you three things: who you answer to, what you could lose, and a secret goal that only you know.",
"One director is the Chair. Only the Chair can call a vote, and everyone votes on their own device. Afterward, the board sees how each person voted.",
"Each round, the board has a budget. Motions cost money, and the board can pass as many as the budget covers.",
"Each round, the company also has a problem, with a short list of facts behind it. The board votes on which facts to admit, and writes one shared statement. Any fact you leave out, the Street may find.",
"Outside the board sits the Street. They watch the projector, and each round, one of them can sit in on your meeting.",
"The projector shows only the stock price. Everything else stays hidden until the end, when we reveal who gained and who paid.",
"There is no single winner. Your card will tell you the rest. Let's play."]
async def main():
    D=[]
    for i,t in enumerate(L,1):
        p=f"public/audio/r_{i}.mp3"
        await edge_tts.Communicate(t,"en-US-AndrewNeural",rate="+5%").save(p)
        D.append(float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]).decode().strip()))
    json.dump(D,open("src/durs.json","w")); print(D,sum(D))
asyncio.run(main())
