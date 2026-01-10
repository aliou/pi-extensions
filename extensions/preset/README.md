# Preset Extension

Configure named presets for model and subagent gateway selection.

## Features

- **Command**: `/preset` - interactive selector or direct preset switch
- **CLI Flag**: `--preset <name>` - start session with a preset
- **Gateway**: Writes gateway config to session state for subagent routing

## Configuration

Create presets in JSON config files:

- `~/.pi/agent/presets.json` - global presets
- `.pi/presets.json` - project-local presets (takes precedence)

### Example

```json
{
  "$schema": "https://raw.githubusercontent.com/aliou/pi-extensions/main/extensions/preset/schema.json",
  "default": {
    "provider": "anthropic",
    "model": "claude-opus-4-5",
    "thinking": "medium",
    "gateway": "default"
  },
  "opencode": {
    "provider": "opencode",
    "model": "claude-opus-4-5",
    "thinking": "medium",
    "gateway": "zen"
  }
}
```

### Preset Options

| Field | Description |
|-------|-------------|
| `provider` | Model provider (e.g., "anthropic", "google", "openai") |
| `model` | Model ID (e.g., "claude-sonnet-4-5") |
| `thinking` | Thinking level: "off", "minimal", "low", "medium", "high", "xhigh" |
| `gateway` | Subagent gateway: "default", "zen", or "openrouter" |

All fields are optional. Omitted fields keep current values.

## Usage

### Start with preset

```sh
pi --preset fast
```

### Switch preset mid-session

```
/preset smart
```

### Interactive selector

```
/preset
```

## Gateway Integration

The extension writes gateway config to session state with type `preset-gateway`:

```typescript
{
  type: "custom",
  customType: "preset-gateway",
  data: { gateway: "zen" }
}
```

Other extensions (e.g., amp) can read this to configure subagent model routing.
