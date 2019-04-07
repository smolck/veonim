# User Guide

This user guide is guaranteed to be accurate for the latest release. For previous releases, please checkout the `docs/readme.md` guide under the relevant release tag.

## quick start copypasta config

Below is a copypasta config to quickly get a feel for Veonim. It is highly recommended to personalize the settings according to your workflow (especially the keybindings!). See the rest of this guide for more info.

```vim
if exists('veonim')

" built-in plugin manager
Plug 'sheerun/vim-polyglot'
Plug 'tpope/vim-surround'

" extensions for web dev
let g:vscode_extensions = [
  \'vscode.typescript-language-features',
  \'vscode.css-language-features',
  \'vscode.html-language-features',
\]

" multiple nvim instances
nno <silent> <c-t>c :Veonim vim-create<cr>
nno <silent> <c-g> :Veonim vim-switch<cr>
nno <silent> <c-t>, :Veonim vim-rename<cr>

" workspace functions
nno <silent> ,f :Veonim files<cr>
nno <silent> ,e :Veonim explorer<cr>
nno <silent> ,b :Veonim buffers<cr>
nno <silent> ,d :Veonim change-dir<cr>
"or with a starting dir: nno <silent> ,d :Veonim change-dir ~/proj<cr>

" searching text
nno <silent> <space>fw :Veonim grep-word<cr>
vno <silent> <space>fw :Veonim grep-selection<cr>
nno <silent> <space>fa :Veonim grep<cr>
nno <silent> <space>ff :Veonim grep-resume<cr>
nno <silent> <space>fb :Veonim buffer-search<cr>

" language features
nno <silent> sr :Veonim rename<cr>
nno <silent> sd :Veonim definition<cr>
nno <silent> si :Veonim implementation<cr>
nno <silent> st :Veonim type-definition<cr>
nno <silent> sf :Veonim references<cr>
nno <silent> sh :Veonim hover<cr>
nno <silent> sl :Veonim symbols<cr>
nno <silent> so :Veonim workspace-symbols<cr>
nno <silent> sq :Veonim code-action<cr>
nno <silent> sk :Veonim highlight<cr>
nno <silent> sK :Veonim highlight-clear<cr>
nno <silent> ,n :Veonim next-usage<cr>
nno <silent> ,p :Veonim prev-usage<cr>
nno <silent> sp :Veonim show-problem<cr>
nno <silent> <c-n> :Veonim next-problem<cr>
nno <silent> <c-p> :Veonim prev-problem<cr>

endif
```

## look & feel
By default Veonim is bundled with its own custom vim colorscheme and the Roboto Mono font.

### colors
Any vim colorscheme is supported. Of course since this is a GUI program, true color colorschemes are supported. See `:h colorscheme` for more info.

Right now Veonim derives its colors from the colorscheme. Perhaps in the future we will allow the ability for users to customize specific parts of the UI with additional highlight groups.

### fonts
Roboto Mono is bundled and included with Veonim. This allows for a consistent out-of-the-box experience across platforms. You can of course use your own font.

To use a custom font and line height use `guifont` and `linespace`. See `:h guifont` and `:h linespace`

For example:
```vim
set guifont=SF\ Mono:h16
set linespace=10
```

### cursor
You can change the shape, size, and color of the cursor for each Vim mode. See `:h guicursor` for more info.

Blinking cursor is currently not supported.

This is the default cursor configuration for Veonim:

```vim
set guicursor=n:block-CursorNormal,i:hor10-CursorInsert,v:block-CursorVisual
hi! CursorNormal guibg=#f3a082
hi! CursorInsert guibg=#f3a082
hi! CursorVisual guibg=#6d33ff
```

## vscode extensions

VSCode extensions are installed by adding them to the `g:vscode_extensions` list. Example:
```vim
let g:vscode_extensions = [
  \'vscode.typescript-language-features',
  \'vscode.json-language-features',
  \'vscode.css-language-features',
  \'vscode.markdown-language-features',
  \'vscode.html-language-features',
  \'vscode.php-language-features',
  \'rust-lang.rust',
  \'ms-vscode.go',
  \'ms-python.python',
\]
```

VSCode ships with a number of built-in extensions. We have a daily CI job that extracts these out to the Veonim org. You can specify the following built-in VSCode extensions to be downloaded and installed:

- TypeScript/JavaScript - `vscode.typescript-language-features`
- CSS - `vscode.css-language-features`
- HTML - `vscode.html-language-features`
- JSON - `vscode.json-language-features`
- Markdown - `vscode.markdown-language-features`
- PHP - `vscode.php-language-features`

To download and install other VSCode extensions you can search for extensions on the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/vscode). The extension id to use for `g:vscode_extensions` is the `Unique-Identifier` found under the `More Info` section on the extension page.

![](https://veonim.github.io/veonim/extuid.png)

For example:
- Rust - `rust-lang.rust`
- Go - `ms-vscode.go`
- Python - `ms-python.python`

## configure vscode extensions

Configuring VSCode extensions can be done with `g:vscode_config` variable.

```vim
let g:vscode_config = {
  \'tsserver.trace.server': 'verbose',
  \'typescript.tsserver.trace': 'verbose'
\}
```

## keep vimrc compatible with neovim/vim

It is recommended to wrap all Veonim configuration in `exists('veonim')` block(s) so that your vimrc remains compatible when loaded in neovim/vim or other GUIs

```vim
if exists('veonim')
"config lol
endif
```

## nvim plugin manager

Veonim will download and install any nvim plugins defined with `Plug 'github-user-or-org/repo-name'` in your vimrc. At this time plugins are downloaded from Github - this may change to allow additional sources. The built-in nvim plugin manager is used for loading plugins - see `:h packages`

Example:
```
Plug 'sheerun/vim-polyglot'
Plug 'tpope/vim-surround'
Plug 'tpope/vim-commentary'
```

## recommended nvim plugins
Syntax highlighting and formatting is done by Neovim, thus you will need additional syntax files for languages not already shipped with Neovim. I would recommend [vim-polygot](https://github.com/sheerun/vim-polyglot) which is a mega bundle of all vim language plugins supporting syntax highlighting, indentation, filetypes, etc. Each language plugin is of course lazy loaded only as needed.

```vim
Plug 'sheerun/vim-polyglot'
```

## recommended project workspace workflow
VSCode extensions work on the concept of folders/workspaces. Thus it is a good idea to limit your current working directory to the current project you are working on. Otherwise extensions could be processing more files than needed.

See `:h :cd` and `:h :pwd`

Also checkout `:Veonim change-dir` and `:Veonim explorer`

To open up multiple projects you can run multiple Neovim instances. See `:Veonim vim-create`, `:Veonim vim-switch`, and `:Veonim vim-rename`

## veonim features
Veonim features are accessible under the `:Veonim` command or `Veonim()` function call. For example, this is how you would use the file fuzzy find with a keybinding:
```
nnoremap <silent> ,f :Veonim files<cr>
```

The same thing with the function signature:
```
nnoremap <silent> ,f :call Veonim('files')<cr>
```

You can always explore/run all available Veonim features in the command line with `:Veonim` and browse the wildmenu list results.

### workspace features
- `files` - fuzzy file finder (powered by ripgrep)
  - best if used when vim current working directory (`:pwd`) is set to your current project (see `change-dir` or `:cd`). this limits the search scope to the current working directory
- `explorer` - directory/file browser. see [fuzzy menu keybindings](#fuzzy-menu-keybindings)
- `change-dir` (dir?) - a fuzzy version of `:cd`
  - optionally accepts a directory path to start from. e.g. `:Veonim change-dir ~/proj`
- `vim-create-dir` (dir?) - like `change-dir` but create a new multiplexed instance of vim with a directory selected from the fuzzy menu
  - optionally accepts a directory path to start from. e.g. `:Veonim vim-create-dir ~/proj`

### multiple concurrent neovim instances
Veonim supports the ability to run multiple instances of Neovim at a time. In my development workflow I prefer to maintain one project per Neovim instance. To switch between projects I simply switch to the respective Neovim instance that has that project loaded. This way I maintain all tabs, windows, buffers, settings, colorschemes, etc. with its respective project.

When switching between instances the "background" instances are still running, but they are not wired up the user interface.

This feature is analogous to tmux sessions, i3 workspaces, MacOS spaces, etc.

- `vim-create` - create a new vim instance with the given name
- `vim-rename` - rename the current vim instance
- `vim-switch` - switch between vim instances with a fuzzy menu
- `vim-create-dir` - create a new vim instance with a directory selected from the fuzzy menu
  - optionally accepts a directory path to start from. e.g. `:Veonim vim-create-dir ~/proj`

### search features
Realtime fuzzy search in the current project workspace using Ripgrep

- `grep` - open up grep search menu
- `grep-word` - grep search the current word under the cursor
- `grep-selection` - grep search the current visual selection
- `grep-resume` - open up grep search menu with the previous search query
- `buffer-search` - fuzzy search lines in the current buffer

### buffer features
- `buffer-search` - fuzzy search lines in the current buffer
- `buffer-prev` - jump to previous visited buffer. this is similar to `<C-O>` except it does not include any intermediary jumps
- `buffer-next` - jump to next visited buffer. this is similar to `<C-I>` except it does not include any intermediary jumps

### language features
The following features require a VSCode language extension to be installed and activated for the current filetype. Activation is done automatically if you have a matching filetype for the current buffer. For example, when entering a `.ts` file, if you have a vim plugin that sets that filetype (or you set it manually) to `typescript` then the VSCode Typescript extension will be activated.

Autocomplete is triggered automatically if you have **not** overridden `completefunc`. Veonim will set `completefunc` on startup, but you can of course opt-out of autocomplete and use your own completion engines by setting `completefunc` in your vimrc.

Choosing completions can be done with `Tab` and `Shift-Tab`. Matching is done with a fuzzy-search engine. Keybinds and auto-trigger will be changed soon to be opt-in and configurable.

Autocompletion has two data sources for completion candidates:
- current buffer keywords (available in any buffer)
- intellisense provided by VSCode extensions

Signature help (provides an overlay tooltip for function parameters and documentation) is triggered automatically (if supported and `completefunc` has not been overridden)

- `definition` - jump to definition
- `implementation` - jump to implementation
- `type-definition` - jump to type definition
- `references` - find references
  - opens up side menu similar to the grep menu. see [fuzzy menu keybindings](#fuzzy-menu-keybindings)
- `rename` - rename current symbol under cursor
- `hover` - show symbol information (and docs) in an overlay
- `symbols` - bring up a fuzzy menu to choose a symbol in the current buffer to jump to
- `workspace-symbols` - like `symbols` but across the entire project workspace. this can be pretty slow on large projects, especially on first usage
- `highlight` - highlight the current symbol in the buffer
- `highlight-clear` - clear symbol highlight
- `next-usage` - jump to the next usage of the symbol under the cursor
- `prev-usage` - jump to the previous usage of the symbol under the cursor
- `code-action` - open an overlay menu displaying code action/quick-fix refactorings at the current position. e.g. remove unused declaration, etc.
- `show-problem` - bring up an overlay describing the problem with the highlighted (underlined) text
- `next-problem` - jump to the next problem in the current file. if there are no problems in the current file, jump to another file
- `prev-problem` - jump to the previous problem in the current file. if there are no problems in the current file, jump to another file

### bonus ~~meme~~ features
- `devtools` - open up the devtools if ur an U83R1337H4XX0R
- `nc` - sadly it does not play the song...

### experimental/wip features
- `viewport-search` - fuzzy search in the current buffer viewport only. on search completion, display jump-to labels like easymotion (`divination-search`). useful for quickly jumping to another place currently visible in the viewport
- `pick-color` - open a color picker and change the current value under the cursor

## fuzzy menu keybindings
In general all fuzzy menus share the same keybindings. These are hardcoded right now, but they will be configurable in the future (once I figure out a good way to do it)

- `escape` - close menu
- `enter` - close menu and perform action on the currently selected item (e.g. open file in the `files` fuzzy menu)
- `tab` - if there are multiple input fields, switch focus between inputs (e.g. `grep` menu)
- `ctrl/cmd + w` - delete word backwards
- `ctrl/cmd + j` - select next item
- `ctrl/cmd + k` - select previous item
- `ctrl/cmd + n` - select next group (usually items grouped by files like in `grep` menu or `problems` menu)
- `ctrl/cmd + p` - select previous group
- `ctrl/cmd + d` - scroll and select an item further down the list
- `ctrl/cmd + u` - scroll and select an item further up the list
- `ctrl/cmd + o` - jump up a directory in any explorer menu (`explorer`, `change-dir`, etc.)

## create your own fuzzy menu
You like all these fuzzy menus? Why not make your own? Veonim lets you build your own. Call `VeonimMenu` with an input list and a completion handler that will receive the selected item.

`VeonimMenu(placeholderDescription: string, listItems: string[], onItemSelectHandler: Function)`

Here is an example of a "task runner" fuzzy menu:

```vim
let g:tasks = {
\'test': {->jobstart('npm test')},
\'start': {->jobstart('npm start')},
\'devtools': {->execute('Veonim devtools')},
\'fullscreen': {->execute('Veonim fullscreen')}
\}

fun! RunTask(name)
  if has_key(g:tasks, a:name)
    let Func = g:tasks[a:name]
    call Func()
  endif
endfun

nno <silent> <c-'> :call VeonimMenu('run task', keys(g:tasks), {m->RunTask(m)})<cr>
```

![](https://veonim.github.io/veonim/tasks.png)

## create your own overlay fuzzy menu
Create your own overlay fuzzy menu. Works like `VeonimMenu` but displays an overlay menu at the current cursor position.

Here is an example of a "search current word on the selected website" fuzzy overlay menu:

```vim
let g:destinations = {
\'google': '',
\'node': 'site:nodejs.org',
\'mdn': 'site:developer.mozilla.org',
\'stackoverlow': 'site:stackoverflow.com',
\'devdocs': 'site:devdocs.io',
\}

fun! OpenBrowser(url) range
  "reference: https://stackoverflow.com/questions/8708154/open-current-file-in-web-browser-in-vim
  if has('mac') | let cmd = 'open' | endif
  if has('unix') | let cmd = 'xdg-open' | endif
  if has('win32') | let cmd = 'google-chrome' | endif
  call jobstart(cmd . " '" . a:url . "'")
endfun

fun! SearchWeb(dest, visual) range
  if has_key(g:destinations, a:dest)
    let base = 'https://www.google.com/search?q='
    let query = a:visual ?  getline("'<")[getpos("'<")[2]-1:getpos("'>")[2]] : expand('<cword>')
    let url = base . g:destinations[a:dest] . '%20' . query . '&btnI'
    call OpenBrowser(url)
  endif
endfun

nno <silent> gd :call VeonimOverlayMenu('search on', keys(g:destinations), {m->SearchWeb(m,0)})<cr>
vno <silent> gd :call VeonimOverlayMenu('search on', keys(g:destinations), {m->SearchWeb(m,1)})<cr>
```

![](https://veonim.github.io/veonim/user-menu.png)

## open file from terminal in current window

When you are in `:term` you can open a file in the current window with the `vvim` executable - it is included and configured for Veonim terminals.

Like this:
```
$ ls
new-js-framework.js    npm-is-a-meme.js    me-gusta.js
$ vvim new-js-framework.js
```

## remapping input keys

### remap modifiers
It is possible to change keyboard modifiers with `g:veonim_remap_modifiers`. For example to swap `ctrl` and `meta`:
```vim
let g:veonim_remap_modifiers = [
  \{"from": "C", "to": "D"},
  \{"from": "D", "to": "C"}
\]
```

### transform key events

If you are familar with key remapping in karabiner/xmodmap/xfb then this concept will be straightforward. Basically since we are in a GUI we have access to both `keydown` + `keyup` keyboard events. This allows us to implement some clever remappings. For example:

Remap 'Command' to be 'Command' or 'Escape'. If 'Command' is pressed with another key, send 'Command'. If 'Command' is pressed alone, send 'Escape'.
```vim
let g:veonim_key_transforms = [
  \{'mode': 'all', 'event': 'up', 'match': {'key': 'Meta', 'metaKey': 'true'}, 'transform': "e=>({key:'<Esc>'})"}
\]
```

Turn `;` key into an extra modifier key. When `;` is being held down, send `semicolon` + the typed key. This allows us to create a mapping like `nno ;n :Veonim next-problem<cr>` and then we can hold down `;` and spam `n` to jump between problems.
```vim
let g:veonim_key_transforms = [
  \{'mode': 'all', 'event': 'hold', 'match': {'key': ';'}, 'transform': "e=>({key:';'+e.key})"},
\]
```

Currently nvim mode is not supported but is planned. That means in the future you can specifiy remapping granularity on keyup/keydown events and conditions on keys and nvim modes (normal, insert, visual, etc.)

## statusline

Currently the statusline is not customizable. Neovim does not yet provide a way to externalize the statusline, but it is planned. See Neovim issue [#9421](https://github.com/neovim/neovim/issues/9421)

### left section
- current working directory `:pwd` relative to `g:vn_project_root`
- current git branch
- git additions / git deletions
- language server enabled & activated

### center section
- macro recording indicator

### right section
- problem count / warning count
- cursor line number / column number
- list of vim tabs (only tab number displayed to condense space - think of it like i3 workspaces)

## how to ignore files and directories in grep
Grep is powered by Ripgrep, so ignore behavior will be deferred to Ripgrep. I believe by default it ignores any paths from `.gitignore` and `.ignore`
