local uivonim = {}
local util = vim.lsp.util

-- @glepnir
-- local params = lsp.util.make_position_params()
-- local result = vim.lsp.buf_request(0,requestmethod,params,timeout_ms or 1000)
-- (or buf_request_sync, but only if needed accord. @norcalli, otherwise isn't
-- recommended by him)

function uivonim.signature_help(_, method, result)
  if not (result and result.signatures and result.signatures[1]) then
    print('No signature help available')
    return
  end

  local lines = util.convert_signature_help_to_markdown_lines(result)
  lines = util.trim_empty_lines(lines)

  if vim.tbl_isempty(lines) then
    print('No signature help available')
    return
  end

  local pos = vim.api.nvim_win_get_cursor(0)
  vim.fn.Uivonim('signature-help', method, result, pos[1] - 1, pos[2])
  -- util.focusable_preview(method, function()
  --   return lines, util.try_trim_markdown_code_blocks(lines)
  -- end)
end

uivonim.lsp_callbacks = {
  ['textDocument/signatureHelp'] = uivonim.signature_help;
}

return uivonim
