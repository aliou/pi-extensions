# Meta Extension

This extension provides introspection tools for the currently running Pi instance.

## Structure

```
extensions/meta/
├── index.ts                    # Extension entry point
├── tools/
│   ├── index.ts               # Tool registration hub
│   ├── utils.ts               # Shared utilities (findPiInstallation)
│   ├── version-tool.ts        # pi_version tool
│   ├── docs-tool.ts          # pi_docs tool
│   └── changelog-tool.ts     # pi_changelog tool
└── README.md
```

## Tools

### `pi_version`

Get the version of the currently running Pi instance.

**Parameters:** None

**Example:**
```
pi_version
```

### `pi_docs`

Get paths to Pi documentation files (README.md, docs/, examples/).

**Parameters:** None

**Example:**
```
pi_docs
```

### `pi_changelog`

Get changelog entries from the Pi installation.

**Parameters:**
- `version` (optional): Specific version to get changelog for. If not provided, returns latest version.

**Examples:**

Get the latest changelog entry:
```
pi_changelog
```

Get changelog for a specific version:
```
pi_changelog version=0.37.8
```

## Implementation

The extension uses `require.resolve()` to find the actual running Pi installation directory, ensuring it gets information from the currently executing Pi binary rather than any local project dependencies.

For version information, it reads the `package.json` from the Pi installation.

For documentation paths, it returns the locations of:
- Main documentation (README.md)
- Additional docs directory (docs/)
- Examples directory (examples/)

For changelog information, it:
- Searches for changelog files (CHANGELOG.md, HISTORY.md, etc.)
- Parses markdown headers to identify version sections
- Returns the latest version by default or a specific version if requested
- Provides a list of all available versions
- Explicitly marks empty changelog entries to prevent confusion