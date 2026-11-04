# BLAINE PROTOCOL

Claude Code mods inspired by Stephen King's *The Dark Tower*. They only change how Claude Code looks.

`blaine-mono` puts an 8-bit pink monorail above the prompt. Blaine leaves Lud on the left and heads for Topeka on the right as the context window fills. The number over the train is the tokens in context now, and the number after TOPEKA is the size of the window: the model's, or a smaller `autoCompactWindow` if you set one. His windows go pink once he is 80 percent of the way there. `/blaine` shows or hides him.

When Blaine reaches Topeka he blows up. Every compaction, the automatic one and the one you ask for with `/compact`, is the riddling. While the summary is written, Jake, Susannah, Eddie and Roland take turns asking him riddles under his route map, and each one he answers takes him closer to Topeka. Once the summary is back, Eddie asks the one joke he cannot answer. Blaine stalls, glitches, laughs, his engines quit, and he crashes at Topeka. Then the end of the line: the wreck smoking by the station with its clock at 4:14, the old token count down to the new one, and the ka-tet walking off past the highway sign, before the next train leaves Lud. A compaction that a `PreCompact` hook holds back leaves him whole. With reduced motion on, he holds one riddle still while the summary is written, then the blast.

`gunslinger` puts an 8-bit Mohaine Desert above the prompt. Roland walks right as the context window fills, with the tokens in context over his head. The man in black waits at the right edge, under a sign with the window size. When compaction runs before the window is full, a skull marks the golgotha where it runs. The signs go red at 80 percent of the way there. Roland draws and fires when a tool returns an error (a slow mutant pops up for him to drop) and every so often while Claude works (the round kicks up dust short of the man in black). When the conversation compacts, night falls on the golgotha: the two of them sit across a fire while the man in black deals the tarot (the Sailor, the Prisoner, the Lady of Shadows, Death, the Tower), one card every few seconds while the summary is written and the rest quickly once it is done. Then the long night, and dawn over his bones, and Roland is back on the trail. While his band shows, the spinner talks like him (Following, Reading the ash, Counting shells), and at the golgotha it speaks a four-line verse, a line per card. Parked, he leaves the spinner its own words, or whatever set `spinnerVerbs` in your settings holds. `/gunslinger` shows or hides him.

Each band needs a terminal at least 40 columns wide. Both can run at once; `/blaine` or `/gunslinger` parks either one. They draw in the terminal only, not in the desktop app.

## Install

At the prompt of a terminal session:

```
/plugin install blaine-mono --marketplace Chaos-dwg/blaine-mono
```

From a shell:

```
claude plugin install blaine-mono --marketplace Chaos-dwg/blaine-mono
```

Use `gunslinger` in place of `blaine-mono` for Roland.

Answer `y` to add the marketplace, then pick a scope. If you added the marketplace before Roland joined it, run `claude plugin marketplace update blaine-protocol` first.

## Check

```
claude plugin test blaine-mono
claude plugin test gunslinger
```
