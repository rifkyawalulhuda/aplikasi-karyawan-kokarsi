<!-- engram:start -->
# Engram

Engram memory may arrive through hooks and MCP.

Use MCP tools when present: `engram_load`, `engram_search`, `engram_save`,
`engram_save_session`, `engram_verify`, `engram_status`.

If no Engram context is injected and memory matters, run:
`engram load --for-agents "<task>"`.

Never save memory silently. Use `--accept-all` only when the human typed it, or after the human approved exact displayed memory candidates in chat.

Full guide: `.agents/engram.md`. Read it only for save/session/conflict/install/debug flows or when hooks/MCP are unavailable.
<!-- engram:end -->
