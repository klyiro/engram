---
title: Adopt a markdown-native second brain
type: decision
tags: [decision, infra]
status: active
created: 2026-01-15
related:
  - "[[projects/engram]]"
---

# Adopt a markdown-native second brain

## Context
We wanted one knowledge base that both people and AI agents could read and write, without
locking anything into a proprietary database.

> [!abstract] Decision
> Keep knowledge as **plain markdown in git**. Put a dashboard on top for humans and an
> **MCP server** on top for agents. See [[engram]].

> [!warning] Non-goal
> Not building a database-backed app. The files win; any index is rebuildable.

## Connected to
- [[engram]] — the implementation
