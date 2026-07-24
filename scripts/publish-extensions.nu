#!/usr/bin/env nu

# Build selected harness extensions as standalone Pi packages and publish them
# as Gists. The checked-in manifest is the release allowlist and stores the
# stable Gist id used for updates.

const REPO_ROOT = path self ..
const MANIFEST_PATH = path self extension-gists.json
const DIST_ROOT = path self ../dist/extensions

const PI_PEERS = [
  "@earendil-works/pi-coding-agent"
  "@earendil-works/pi-agent-core"
  "@earendil-works/pi-ai"
  "@earendil-works/pi-tui"
  "typebox"
]

const UNSUPPORTED_RUNTIME_PATTERNS = [
  {
    needle: "DEFAULT_SUBAGENT_EXTENSION_PATHS"
    reason: "loads a repository-relative subagent extension at runtime"
  }
  {
    needle: "getHarnessPackageRoot("
    reason: "resolves repository-relative resources at runtime"
  }
  {
    needle: "extensionPaths:"
    reason: "loads other extensions by runtime path"
  }
  {
    needle: "import.meta.url"
    reason: "resolves a runtime file relative to source code"
  }
  {
    needle: "createRequire"
    reason: "loads modules dynamically at runtime"
  }
]

def fail [message: string] {
  error make { msg: $message }
}

def load-manifest [] {
  let manifest = open $MANIFEST_PATH
  if $manifest.version != 1 {
    fail $"Unsupported extension Gist manifest version: ($manifest.version)"
  }
  $manifest
}

def normalize-extension-path [extension: string] {
  let absolute = ([ $REPO_ROOT $extension ] | path join | path expand --strict)
  let relative = ($absolute | path relative-to $REPO_ROOT)
  if ($relative | str starts-with "..") {
    fail $"Extension path is outside the repository: ($extension)"
  }
  $relative
}

def validate-manifest-entry-path [extension: string] {
  if ($extension | str contains "\\") {
    fail $"Manifest extension path must use forward slashes: ($extension)"
  }
  let segments = ($extension | split row "/")
  if ($segments | any {|segment| $segment in ["" "." ".."] }) {
    fail $"Manifest extension path is not canonical: ($extension)"
  }
  let normalized = (normalize-extension-path $extension | str replace --all "\\" "/")
  if $normalized != $extension {
    fail $"Manifest extension path must be repository-relative and canonical: ($extension)"
  }
}

def select-entries [manifest: record, extension?: string] {
  if $extension == null {
    return $manifest.extensions
  }

  let normalized = normalize-extension-path $extension
  let selected = ($manifest.extensions | where path == $normalized)
  if ($selected | is-empty) {
    fail $"Extension is not listed in ($MANIFEST_PATH): ($normalized)"
  }
  $selected
}

def package-root [specifier: string] {
  let parts = ($specifier | split row "/")
  if ($specifier | str starts-with "@") {
    $parts | first 2 | str join "/"
  } else {
    $parts | first
  }
}

def is-allowed-external [specifier: string, local_files: list<string>] {
  if ($specifier | str starts-with "node:") {
    return true
  }
  if ($specifier | str starts-with "./") {
    return (($specifier | str substring 2..) in $local_files)
  }
  let root = package-root $specifier
  $root in $PI_PEERS
}

def assert-bundle-inputs [metadata: record] {
  for input in ($metadata.inputs | columns) {
    let resolved = ([ $REPO_ROOT $input ] | path join | path expand --strict)
    let in_repo = (
      $resolved == $REPO_ROOT or
      ($resolved | str starts-with $"($REPO_ROOT)/")
    )
    if not $in_repo {
      fail $"Bundle includes source outside this repository: ($resolved)"
    }
    if ($resolved | str contains "/node_modules/") {
      fail $"Bundle includes a third-party package: ($resolved)"
    }

    let source = open --raw $resolved
    for pattern in $UNSUPPORTED_RUNTIME_PATTERNS {
      if ($source | str contains $pattern.needle) {
        fail $"Cannot publish ($input): ($pattern.reason) [($pattern.needle)]"
      }
    }
    let dynamic_imports = ($source | parse --regex '(?s)(?<dynamic>\bimport(?:\s|/\*.*?\*/|//[^\n]*(?:\n|$))*\()')
    if ($dynamic_imports | is-not-empty) {
      fail $"Cannot publish ($input): uses a dynamic import that cannot be dependency-audited"
    }
    let runtime_requires = ($source | parse --regex '(?s)(?<dynamic>\brequire(?:\s|/\*.*?\*/|//[^\n]*(?:\n|$))*\()')
    if ($runtime_requires | is-not-empty) {
      fail $"Cannot publish ($input): uses require() which cannot be dependency-audited safely"
    }
  }
}

def bundle-externals [metadata: record] {
  $metadata.outputs
  | values
  | each {|output| $output.imports? | default [] }
  | flatten
  | where external == true
  | get path
  | uniq
}

def assert-bundle-externals [externals: list<string>, local_files: list<string>] {
  for external in $externals {
    if not (is-allowed-external $external $local_files) {
      fail $"Bundle leaves a non-Pi package external: ($external)"
    }
  }
}

def peer-dependencies [externals: list<string>] {
  let peers = (
    $externals
    | where {|external| not ($external | str starts-with "node:") and not ($external | str starts-with "./") }
    | each {|external| package-root $external }
    | uniq
  )

  mut result = {}
  for peer in $peers {
    $result = ($result | upsert $peer "*")
  }
  $result
}

def optional-peer-dependencies [peers: record] {
  mut result = {}
  for peer in ($peers | columns) {
    $result = ($result | upsert $peer { optional: true })
  }
  $result
}

def extension-marker [entry: record] {
  $"[pi-harness:($entry.path)]"
}

def gist-description [entry: record] {
  $"($entry.description) (extension-marker $entry)"
}

def validate-workspace-bundles [bundles: list<record>] {
  let files = ($bundles | get file)
  if ($files | length) != ($files | uniq | length) {
    fail "workspaceBundles contains duplicate output filenames"
  }
  for bundle in $bundles {
    let file = $bundle.file
    if ($file | path basename) != $file or not ($file | str ends-with ".js") {
      fail $"Workspace bundle output must be a flat .js filename: ($file)"
    }
    if $file in ["index.js" "package.json"] {
      fail $"Workspace bundle output uses a reserved filename: ($file)"
    }
    if not ($bundle.package | str starts-with "@harness/") or (package-root $bundle.package) != $bundle.package {
      fail $"Workspace bundle must declare an @harness package root: ($bundle.package)"
    }
    for specifier in $bundle.imports {
      if (package-root $specifier) != $bundle.package {
        fail $"Workspace import ($specifier) does not belong to ($bundle.package)"
      }
    }
  }

  let imports = ($bundles | get imports | flatten)
  if ($imports | length) != ($imports | uniq | length) {
    fail "workspaceBundles contains duplicate import specifiers"
  }
}

def build-unit [
  source: string
  output: string
  external_args: list<string>
  local_files: list<string>
  label: string
] {
  let metadata_file = (mktemp --suffix .json)
  let args = [
    "exec"
    "esbuild"
    $source
    "--bundle"
    "--format=esm"
    "--platform=node"
    "--target=node22"
    "--tree-shaking=true"
    "--legal-comments=none"
    "--log-level=warning"
    $"--outfile=($output)"
    $"--metafile=($metadata_file)"
    ...$external_args
  ]

  let build = (do {
    cd $REPO_ROOT
    ^pnpm ...$args
  } | complete)
  if $build.exit_code != 0 {
    rm --force $metadata_file
    fail $"esbuild failed for ($label):\n($build.stderr)"
  }

  let metadata = open $metadata_file
  rm --force $metadata_file
  assert-bundle-inputs $metadata
  let externals = bundle-externals $metadata
  assert-bundle-externals $externals $local_files
  $externals
}

def build-entry [entry: record] {
  validate-manifest-entry-path $entry.path
  let entrypoint = ([ $REPO_ROOT $entry.path "index.ts" ] | path join)
  if not ($entrypoint | path exists) {
    fail $"Missing extension entrypoint: ($entrypoint)"
  }

  let slug = ($entry.path | str replace --all "/" "--")
  let output_dir = ([ $DIST_ROOT $slug ] | path join)
  mkdir $DIST_ROOT
  let staging_dir = (mktemp --directory --tmpdir-path $DIST_ROOT $".($slug).XXXXXX")
  let output_file = ([ $staging_dir "index.js" ] | path join)
  let workspace_bundles = ($entry.workspaceBundles? | default [])
  validate-workspace-bundles $workspace_bundles
  let local_files = ($workspace_bundles | get file)

  let pi_external_args = (
    $PI_PEERS
    | each {|peer| [ $"--external:($peer)" $"--external:($peer)/*" ] }
    | flatten
  )
  let workspace_args = (
    $workspace_bundles
    | each {|bundle|
      let aliases = ($bundle.imports | each {|specifier| $"--alias:($specifier)=./($bundle.file)" })
      [ ...$aliases $"--external:./($bundle.file)" ]
    }
    | flatten
  )
  let external_args = [ ...$pi_external_args "--external:@harness/*" ...$workspace_args ]

  try {
    mut externals = (build-unit $entrypoint $output_file $external_args $local_files $entry.path)
    for bundle in $workspace_bundles {
      let source = ([ $REPO_ROOT $bundle.entry ] | path join | path expand --strict)
      let output = ([ $staging_dir $bundle.file ] | path join)
      let bundle_externals = (build-unit $source $output $external_args $local_files $bundle.package)
      $externals = ([ ...$externals ...$bundle_externals ] | uniq)
    }
    let peers = peer-dependencies $externals
    let optional_peers = optional-peer-dependencies $peers

    let package = {
      name: $entry.packageName
      version: "0.0.0"
      description: $entry.description
      type: "module"
      keywords: ["pi-package"]
      peerDependencies: $peers
      peerDependenciesMeta: $optional_peers
      pi: {
        extensions: ["./index.js"]
      }
    }
    let staging_package_file = ([ $staging_dir "package.json" ] | path join)
    $"($package | to json --indent 2)\n" | save --force $staging_package_file

    if ($output_dir | path exists) {
      rm --recursive --force $output_dir
    }
    mv $staging_dir $output_dir
  } catch {|error|
    rm --recursive --force $staging_dir
    fail $error.msg
  }

  let final_output_file = ([ $output_dir "index.js" ] | path join)
  let package_file = ([ $output_dir "package.json" ] | path join)
  let workspace_files = ($workspace_bundles | each {|bundle| [ $output_dir $bundle.file ] | path join })
  print $"Built ($entry.path) -> ($output_dir)"
  {
    entry: $entry
    outputDir: $output_dir
    indexFile: $final_output_file
    packageFile: $package_file
    files: [ $final_output_file ...$workspace_files $package_file ]
  }
}

def gh-api [method: string, endpoint: string, payload?: record] {
  let response = if $payload == null {
    do { ^gh api --method $method $endpoint } | complete
  } else {
    let body = ($payload | to json)
    do { $body | ^gh api --method $method $endpoint --input - } | complete
  }

  if $response.exit_code != 0 {
    fail $"GitHub API request failed: ($method) ($endpoint)\n($response.stderr)"
  }
  $response.stdout | from json
}

def list-authenticated-gists [] {
  let response = (do {
    ^gh api --method GET --paginate --slurp "gists?per_page=100"
  } | complete)
  if $response.exit_code != 0 {
    fail $"GitHub API request failed: GET gists\n($response.stderr)"
  }
  $response.stdout | from json | flatten
}

def assert-authenticated-owner [manifest: record] {
  let user = gh-api GET user
  if $user.login != $manifest.owner {
    fail $"Authenticated gh user is ($user.login); expected ($manifest.owner)"
  }
}

def find-existing-gist [entry: record] {
  let marker = extension-marker $entry
  let matches = (
    list-authenticated-gists
    | where {|gist| ($gist.description | default "" | str contains $marker) }
  )
  if ($matches | length) > 1 {
    fail $"Multiple Gists contain marker ($marker); set gistId manually"
  }
  $matches | first 1 | get 0?
}

def gist-payload [build: record] {
  let entry = $build.entry
  mut files = {}
  for file in $build.files {
    let filename = ($file | path basename)
    $files = ($files | upsert $filename { content: (open --raw $file) })
  }
  {
    description: (gist-description $entry)
    public: $entry.public
    files: $files
  }
}

def assert-existing-gist [manifest: record, entry: record, gist: record] {
  if $gist.owner.login != $manifest.owner {
    fail $"Refusing to update Gist owned by ($gist.owner.login); expected ($manifest.owner)"
  }
  let marker = extension-marker $entry
  if not ($gist.description | default "" | str contains $marker) {
    fail $"Refusing to update Gist ($entry.gistId): missing marker ($marker)"
  }
}

def save-gist-id [manifest: record, extension_path: string, gist_id: string] {
  let extensions = ($manifest.extensions | each {|entry|
    if $entry.path == $extension_path {
      $entry | upsert gistId $gist_id
    } else {
      $entry
    }
  })
  let updated = ($manifest | upsert extensions $extensions)
  let manifest_dir = ($MANIFEST_PATH | path dirname)
  let temporary = (mktemp --tmpdir-path $manifest_dir "extension-gists.json.XXXXXX")
  try {
    $"($updated | to json --indent 2)\n" | save --force $temporary
    mv --force $temporary $MANIFEST_PATH
  } catch {|error|
    if ($temporary | path exists) {
      rm --force $temporary
    }
    fail $error.msg
  }
  $updated
}

def publish-entry [manifest: record, build: record, dry_run: bool] {
  let entry = $build.entry
  let payload = gist-payload $build

  if $dry_run {
    let action = if $entry.gistId == null { "create" } else { $"update ($entry.gistId)" }
    print $"Would ($action) Gist for ($entry.path)"
    return { manifest: $manifest, gistId: $entry.gistId }
  }

  if $entry.gistId == null {
    let existing = find-existing-gist $entry
    if $existing != null {
      let recovered_entry = ($entry | upsert gistId $existing.id)
      let recovered_build = ($build | upsert entry $recovered_entry)
      let recovered_manifest = save-gist-id $manifest $entry.path $existing.id
      print $"Recovered existing Gist ($existing.html_url)"
      return (publish-entry $recovered_manifest $recovered_build false)
    }

    let gist = gh-api POST gists $payload
    let updated = save-gist-id $manifest $entry.path $gist.id
    print $"Created ($gist.html_url)"
    return { manifest: $updated, gistId: $gist.id }
  }

  let current = gh-api GET $"gists/($entry.gistId)"
  assert-existing-gist $manifest $entry $current
  mut files = $payload.files
  let expected_files = ($payload.files | columns)
  for filename in ($current.files | columns) {
    if $filename not-in $expected_files {
      $files = ($files | upsert $filename null)
    }
  }
  let update_payload = {
    description: $payload.description
    files: $files
  }
  let gist = gh-api PATCH $"gists/($entry.gistId)" $update_payload
  print $"Updated ($gist.html_url)"
  { manifest: $manifest, gistId: $entry.gistId }
}

def "main build" [extension?: string] {
  let manifest = load-manifest
  let entries = select-entries $manifest $extension
  for entry in $entries {
    build-entry $entry | ignore
  }
}

def "main publish" [
  extension?: string
  --dry-run
] {
  mut manifest = load-manifest
  let entries = select-entries $manifest $extension
  if not $dry_run {
    assert-authenticated-owner $manifest
  }
  for entry in $entries {
    let build = build-entry $entry
    let result = publish-entry $manifest $build $dry_run
    $manifest = $result.manifest
  }
}

def main [] {
  print "Usage:"
  print "  nu scripts/publish-extensions.nu build [extension]"
  print "  nu scripts/publish-extensions.nu publish [extension] [--dry-run]"
}
