# Start Here

AgentSquad: build a squad of AI coding agents like a 2K MyPlayer, deploy them into Claude Code, and watch them work in a live scene.

This vault is the source of truth. Humans edit it in Obsidian. Coding agents read it before writing code.

## Read in this order

1. [[How It Works]] — the full technical flow, start to finish
2. [[Contracts]] — the shared data shapes every stream builds against
3. [[Decisions]] — what's decided and what's still open
4. Your stream brief in `streams/`
5. [[Status]] — what everyone else is doing right now
6. [[References]] — mockups of every screen and the art style

## Streams

| Stream | Brief | Owns |
|---|---|---|
| Bridge | [[Bridge]] | `/server`, `/hooks`, `/demo` |
| Arena | [[Arena]] | `/web/src/arena`, `/web/src/report` |
| Builder | [[Builder]] | `/web/src/builder` |
| Art | [[Art]] | `/assets`, `/web/public/art` |

Phase 0 comes first and is done by one session only. See [[Phase 0 Kickoff]].

## Rules for every agent

- Read your brief and [[Contracts]] before coding.
- Only edit folders your stream owns. `/shared` is read-only after Phase 0.
- Need a contract change? Write it in [[Decisions]] under "Requests" and stop. A human approves it.
- Build against mock data (`npm run mock`) until integration checkpoint 1.
- Simple flat code. No abstractions for things that happen once. No comments that restate the code.
- When you finish a task, run the app, look at it, then tick the box in your brief and add a line to [[Status]].
