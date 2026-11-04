# BLAINE PROTOCOL

Claude Code mods inspired by Stephen King's *The Dark Tower*. `blaine-mono` and `gunslinger` only change how Claude Code looks; `touchstone` and `oy` are working tools and say below what they write and send.

`blaine-mono` puts an 8-bit pink monorail above the prompt. Blaine leaves Lud on the left and heads for Topeka on the right as the context window fills. The number over the train is the tokens in context now, and the number after TOPEKA is the size of the window: the model's, or a smaller `autoCompactWindow` if you set one. His windows go pink once he is 80 percent of the way there. Between Lud and Topeka on the top row he shows what the session has cost, how much of your 5 hour limit is spent, and how long until it resets (`$3.50 5H 62% 2h05m`), pink from 80 percent; they show only where the account reports them. A cable under the rail lights up as far as the 5 hour limit is spent. `/blaine` shows or hides him.

When Blaine reaches Topeka he blows up. Every compaction, the automatic one and the one you ask for with `/compact`, is the riddling. While the summary is written, Jake, Susannah, Eddie and Roland take turns asking him riddles under his route map, and each one he answers takes him closer to Topeka. Once the summary is back, Eddie asks the one joke he cannot answer. Blaine stalls, glitches, laughs, his engines quit, and he crashes at Topeka. Then the end of the line: the wreck smoking by the station with its clock at 4:14, the old token count down to the new one, and the ka-tet walking off past the highway sign, before the next train leaves Lud. A compaction that a `PreCompact` hook holds back leaves him whole. With reduced motion on, he holds one riddle still while the summary is written, then the blast.

`gunslinger` puts an 8-bit Mohaine Desert above the prompt. Roland walks right as the context window fills, with the tokens in context over his head. The man in black waits at the right edge, under a sign with the window size. When compaction runs before the window is full, a skull marks the golgotha where it runs. The signs go red at 80 percent of the way there. Roland draws and fires when a tool returns an error (a slow mutant pops up for him to drop) and every so often while Claude works (the round kicks up dust short of the man in black). When the conversation compacts, night falls on the golgotha: the two of them sit across a fire while the man in black deals the tarot (the Sailor, the Prisoner, the Lady of Shadows, Death, the Tower), one card every few seconds while the summary is written and the rest quickly once it is done. Then the long night, and dawn over his bones, and Roland is back on the trail. While his band shows, the spinner talks like him (Following, Reading the ash, Counting shells), and at the golgotha it speaks a four-line verse, a line per card. Parked, he leaves the spinner its own words, or whatever set `spinnerVerbs` in your settings holds. `/gunslinger` shows or hides him.

He keeps your local time. Dusk goes down from eight to nine at night and dawn comes up from five to six, and from about 8:40 pm to 5:20 am he does not walk: he sits at his own fire with the stars out, the man in black only a far-off fire at the window's edge. Out of the dark, what you would meet as a slow mutant is a lobstrosity. The top left of the band shows what the session has cost and how much of your 5 hour limit is spent (red from 80 percent), and the camp fire is that limit: big while it is fresh, down to embers as it runs out. The harder the limit is pressed, the harder he fights: from 50 percent two things come at him at once, from 80 percent three, and he draws on idle twice as often. When the limit resets, his fire leaps up and throws sparks. The limit and cost show only where the account reports them.

`touchstone` keeps a session's facts through a compaction. Just before any compaction of the main conversation (and once when the context passes 70 percent, or when you run `/touchstone`) it reads git for the branch, HEAD, ahead and behind, and every uncommitted file, and writes a record and a patch of the whole uncommitted work to `~/.claude/handoffs/touchstone/<project>__<session>.md` and `.patch`, with your last eight messages verbatim. Files whose names look like keys, tokens or passwords are listed but never copied into the patch. After a compaction it adds a short section to the system prompt that points at that record, and warns the model when the preserve note it was handed (`~/.claude/handoffs/preserve/<project>.md`) is three days old, or a day old with commits since. It writes only under `~/.claude/handoffs/touchstone` and runs only read-only git commands.

`oy` is the billy-bumbler who repeats your words back, cleaned up. Type `/oy` and then a rough thought, typos and all, and Oy puts a clear prompt in the box: the goal first, then each ask in the order you want it done, your strong rules kept in your own words. A last line, `Oy checks:`, names up to three things to confirm: a guess it made, a word that could mean two things (a typo that would flip the meaning is raised, never fixed silently), or a reference like "option 1" it resolved from the conversation. You read it, change it, delete the check line and send it yourself; Oy never sends. To do this it sends your rough thought, your last two messages and Claude's last reply to the `sonnet` model on your account, the same as any other message would go. It stores nothing and writes no files.

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

Use `gunslinger` in place of `blaine-mono` for Roland, `touchstone` for the session record, or `oy` for the prompt cleaner.

Answer `y` to add the marketplace, then pick a scope. If you added the marketplace before Roland joined it, run `claude plugin marketplace update blaine-protocol` first.

## Check

```
claude plugin test blaine-mono
claude plugin test gunslinger
claude plugin test touchstone
claude plugin test oy
```
