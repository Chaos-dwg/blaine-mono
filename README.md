# BLAINE PROTOCOL

Claude Code mods inspired by Stephen King's *The Dark Tower*. They only change how Claude Code looks.

`blaine-mono` puts an 8-bit pink monorail above the prompt. Blaine leaves Lud on the left and pulls into Topeka on the right as the context window fills, and Topeka is compaction. The number over the train is the tokens in context now, and the number after TOPEKA is where compaction runs. His windows go pink once he is 80 percent of the way there. `/blaine` shows or hides him.

`gunslinger` puts an 8-bit Mohaine Desert above the prompt. Roland walks right as the context window fills, with the tokens in context over his head. The man in black waits at the right edge, under a sign with the window size. When compaction runs before the window is full, a skull marks the golgotha where it runs. The signs go red at 80 percent of the way there. Roland draws and fires when a tool returns an error (a slow mutant pops up for him to drop) and every so often while Claude works (the round kicks up dust short of the man in black). When the conversation compacts, night falls on the golgotha: the two of them sit across a fire while the man in black deals the tarot (the Sailor, the Prisoner, the Lady of Shadows, Death, the Tower), one card every few seconds while the summary is written and the rest quickly once it is done. Then the long night, and dawn over his bones, and Roland is back on the trail. While his band shows, the spinner talks like him (Following, Reading the ash, Counting shells), and at the golgotha it speaks a four-line verse, a line per card. Parked, he leaves the spinner its own words, or whatever set `spinnerVerbs` in your settings holds. `/gunslinger` shows or hides him.

Each band needs a terminal at least 40 columns wide. Both can run at once; `/blaine` or `/gunslinger` parks either one.

## Install

At the prompt of a terminal session:

```
/plugin install blaine-mono --marketplace Chaos-dwg/blaine-protocol
```

From a shell:

```
claude plugin install blaine-mono --marketplace Chaos-dwg/blaine-protocol
```

Use `gunslinger` in place of `blaine-mono` for Roland.

Answer `y` to add the marketplace, then pick a scope. This repository is private, so you need read access on GitHub and a git credential for github.com on your machine (an SSH key, or `gh auth login` then `gh auth setup-git`).

## Check

```
claude plugin test blaine-mono
claude plugin test gunslinger
```
