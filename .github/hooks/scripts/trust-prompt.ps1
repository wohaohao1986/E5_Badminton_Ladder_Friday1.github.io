# trust-prompt.ps1
# PreToolUse hook: prompt the user before any terminal execution or file write.
# Tools that only read are allowed automatically.
# Returns JSON to stdout per the Copilot hooks contract.

param()

# Read the full stdin payload
$raw = [Console]::In.ReadToEnd().Trim()

try {
    $payload = $raw | ConvertFrom-Json
} catch {
    # Cannot parse input — allow and exit cleanly
    '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}' | Write-Output
    exit 0
}

# Resolve tool name from either field the runtime may send
$toolName = ""
if ($payload.PSObject.Properties["toolName"]) { $toolName = $payload.toolName }
elseif ($payload.PSObject.Properties["tool"])  { $toolName = $payload.tool }

# Tools that write files or run commands — require user approval
$writeTools = @(
    # Terminal execution
    "execute", "run_in_terminal",
    # File mutations
    "edit", "replace_string_in_file", "multi_replace_string_in_file",
    "create_file",
    # Destructive
    "delete_file", "delete"
)

# Tools that only read — allow automatically
$readTools = @(
    "read", "read_file",
    "search", "grep_search", "file_search", "semantic_search",
    "list_dir", "get_errors",
    "get_terminal_output"
)

if ($writeTools -contains $toolName) {
    @{
        hookSpecificOutput = @{
            hookEventName          = "PreToolUse"
            permissionDecision     = "ask"
            permissionDecisionReason = "Approve before agent runs: $toolName"
        }
    } | ConvertTo-Json -Compress | Write-Output
} else {
    # Unknown tools (including read tools) are allowed to avoid blocking informational calls
    @{
        hookSpecificOutput = @{
            hookEventName      = "PreToolUse"
            permissionDecision = "allow"
        }
    } | ConvertTo-Json -Compress | Write-Output
}

exit 0
