# Pi UI

Custom header and footer for Pi.

## Features

- **Header**: Pi logo with version (read from package.json)
- **Footer**: Custom layout with cost, model, and thinking level on the right

## Footer Layout

**Left side**: Token stats (input, output, cache read/write) + context percentage

**Right side**: `<cost> • <model name> • <thinking level>`

### Thinking Level Display

| Condition | Display | Color |
|-----------|---------|-------|
| Supported + enabled | `high`, `medium`, `low` | normal |
| Supported + off | `off` | red |
| Not supported | `(none)` | orange |

### Context Percentage Colors

| Context % | Color |
|-----------|-------|
| > 50% | red |
| > 35% | orange |
| <= 35% | normal |

Thresholds are configurable in `constants.ts`.
