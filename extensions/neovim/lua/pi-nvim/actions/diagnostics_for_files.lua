--- Get LSP errors for specific files
local M = {}

---@class pi.FileDiagnostic
---@field line number
---@field col number
---@field message string
---@field source? string

---@class pi.DiagnosticsForFilesParams
---@field type "diagnostics_for_files"
---@field files string[]

---@alias pi.DiagnosticsForFilesResult table<string, pi.FileDiagnostic[]>

--- Find buffer number for a file path
---@param path string
---@return number? bufnr
local function find_buffer(path)
  local bufnr = vim.fn.bufnr(path)
  if bufnr == -1 then
    return nil
  end
  -- Check if buffer is actually loaded
  if not vim.api.nvim_buf_is_loaded(bufnr) then
    return nil
  end
  return bufnr
end

--- Get ERROR diagnostics for a buffer
---@param bufnr number
---@return pi.FileDiagnostic[]
local function get_errors(bufnr)
  local diagnostics = vim.diagnostic.get(bufnr, {
    severity = vim.diagnostic.severity.ERROR,
  })

  ---@type pi.FileDiagnostic[]
  local result = {}
  for _, d in ipairs(diagnostics) do
    table.insert(result, {
      line = d.lnum + 1,
      col = d.col + 1,
      message = d.message,
      source = d.source,
    })
  end

  return result
end

---@param params pi.DiagnosticsForFilesParams
---@return pi.DiagnosticsForFilesResult
function M.execute(params)
  ---@type pi.DiagnosticsForFilesResult
  local result = {}

  for _, path in ipairs(params.files or {}) do
    local bufnr = find_buffer(path)
    if bufnr then
      local errors = get_errors(bufnr)
      if #errors > 0 then
        result[path] = errors
      end
    end
  end

  return result
end

return M
