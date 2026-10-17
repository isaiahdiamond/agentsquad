# Running the Streams

Two ways to run the parallel work. Pick based on how many people are awake and coding.

## Mode 1: one person per stream (recommended)

Each teammate owns a stream, works in its worktree, and runs their own Claude Code session there. This is the most reliable setup: each session has its own full context, and a human is watching each one.

Prompt for each session, swapping in the stream name:

> Read `vault/00 Start Here.md`, `vault/How It Works.md`, `vault/Contracts.md`, `vault/Decisions.md`, and `vault/streams/<Stream>.md`. You own only the folders listed in your brief. Work through the task list in order. After each task: run the app, check it works, tick the box, add one line to the Log section of your brief, and commit. If you need something from another stream or a contract change, write it in `vault/Decisions.md` under Requests and keep going on tasks that don't need it.

Merge each branch into `main` at every checkpoint in [[Status]]. Rebase your worktree after.

## Mode 2: one orchestrator spawning subagents

Use this when only one or two people are coding, like overnight. One Claude Code session in the main repo spawns a subagent per stream, each in its own worktree.

> Read everything in `vault/`. You are the orchestrator. Spawn one subagent per stream in `vault/streams/`, each with `isolation: worktree`, in a single message so they run in parallel. Give each one the Mode 1 prompt from `vault/Running the Streams.md` with its stream name filled in, and tell it to stop after its next unchecked milestone. When they all return, merge their branches into `main`, run the app, fix integration breaks yourself, update `vault/Status.md`, then report what's done and what broke.

Limits to know:

- Subagents stop when their task is done. They don't keep working through the night on their own. Run the orchestrator once per milestone.
- Each subagent only knows what the prompt and vault tell it. If the vault is vague, the work will be vague.
- Nobody is watching subagents mid-task. Review the merge before the next round.

## Checkpoint routine (every merge)

1. Merge all stream branches into `main`.
2. `npm run dev`, `npm run mock`, click through builder → arena → report.
3. Fix breaks on `main`, then everyone rebases.
4. Update [[Status]].
