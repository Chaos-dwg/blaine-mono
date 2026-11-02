# BLAINE PROTOCOL

A Claude Code mod, inspired by Stephen King's *The Dark Tower*. It only changes how Claude Code looks.

`blaine-mono` puts an 8-bit pink monorail above the prompt. Blaine leaves Lud on the left and pulls into Topeka on the right as the context window fills, and Topeka is compaction. The number over the train is the tokens in context now, and the number after TOPEKA is where compaction runs. His windows go pink once he is 80 percent of the way there. `/blaine` shows or hides him.

The train needs a terminal at least 40 columns wide.

## Install

At the prompt of a terminal session:

```
/plugin install blaine-mono --marketplace Chaos-dwg/blaine-mono
```

From a shell:

```
claude plugin install blaine-mono --marketplace Chaos-dwg/blaine-mono
```

Answer `y` to add the marketplace, then pick a scope. Blaine draws in the terminal only, not in the desktop app.

## Check

```
claude plugin test blaine-mono
```
