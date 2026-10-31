# BLAINE PROTOCOL

Two Claude Code mods, inspired by Stephen King's *The Dark Tower*. They only change how Claude Code looks.

| Mod | What it does | Command |
| --- | --- | --- |
| `blaine-mono` | An 8-bit pink monorail crosses the waste lands above the prompt while Claude works. | `/blaine` shows or hides it |
| `agent-office` | A pixel-art office beside the chat. Each agent gets a desk and a paper stack, and you can read what they hand each other. Blaine rides the wall from Lud to Topeka as context fills, and Topeka is compaction. | `/office` opens it |

The train needs the terminal. The office draws its room in the terminal, and other surfaces show its words only.

## Install

At the prompt of a terminal session:

```
/plugin install blaine-mono --marketplace Chaos-dwg/blaine-protocol
/plugin install agent-office --marketplace Chaos-dwg/blaine-protocol
```

From a shell:

```
claude plugin install blaine-mono --marketplace Chaos-dwg/blaine-protocol
claude plugin install agent-office --marketplace Chaos-dwg/blaine-protocol
```

Answer `y` to add the marketplace, then pick a scope. This repository is private, so you need read access on GitHub and a git credential for github.com on your machine (an SSH key, or `gh auth login` then `gh auth setup-git`).

## Check

```
claude plugin test blaine-mono
claude plugin test agent-office
```
