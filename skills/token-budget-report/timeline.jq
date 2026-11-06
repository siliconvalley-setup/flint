# One line per tool call and per result, in transcript order: input or first chars of output.
select(.message.content | type == "array") | .message.content[]
| if .type == "tool_use" then "CALL \(.name): \((.input.command // .input.file_path // .input.description // "") | tostring | gsub("\n"; " ") | .[0:140])"
  elif .type == "tool_result" then "  -> \((.content | if type == "array" then map(.text? // "") | join("") else (. // "") end) | gsub("\n"; " ") | .[0:110])"
  else empty end
