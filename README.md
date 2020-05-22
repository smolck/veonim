![](https://veonim.github.io/veonim/header.png)

Veonim is a simple modal IDE built on Neovim and VSCode extensions. The goal is to create my ideal programming environment

![](https://veonim.github.io/veonim/smart.png)

## features
- Superfast with things like WebGL GPU rendering and multithreading
- Support VSCode extensions (work in progress, but can try today in 0.22.0+)
- Aims to be 100% compatible with Neovim (see [#9421](https://github.com/neovim/neovim/issues/9421))
- All configuration done via vimrc with vimscript/Lua/remote plugins
- All Veonim features opt-in. Use as much or as little of the IDE features as you want and customize your workflow
- Fuzzy search files, buffers, buffer text, project text search (powered by ripgrep)
- Multiple concurrent Neovim instances (like tmux sessions)
- Fully keyboard driven (no mouse support)
- But wait, there's more! See the [User Guide](docs/readme.md)

## getting started

Build from source. See the "build" section at the bottom of this readme

### Using
See the [User Guide](docs/readme.md)

## project status
Veonim is in heavy development. Alpha status at best.

Currently in progress:
- fix/polish VSCode language extension support
- support VSCode debug adapter extensions
- explore removing electron
- inventory menu (spacemacs-like mapping menu guides)
- `ext_windows` support

## show & tell

### auto completion
Auto complete with documentation powered by VSCode extensions. If you want autocompletion, make sure `completefunc` is not overridden in your vimrc
![](https://veonim.github.io/veonim/completion.png)

### fuzzy file finder
Fuzzy search to open any file in the current working directory
- `:Veonim files`
![](https://veonim.github.io/veonim/files.png)

### find in project
Fuzzy project text search and filter - powered by Ripgrep
- `:Veonim grep`
- `:Veonim grep-word`
- `:Veonim grep-selection`
- `:Veonim grep-resume`
![](https://veonim.github.io/veonim/grep.png)

### symbol search
Fuzzy menu for all current symbols in buffer or workspace. Requires a relevant VSCode language extension
- `:Veonim symbols`
- `:Veonim workspace-symbols`
![](https://veonim.github.io/veonim/symbols.png)

### signature hint
Show function signature help and documentation when using Veonim autocompletion. Requires a relevant VSCode language extension. Requires `completefunc` to not be overridden
![](https://veonim.github.io/veonim/hint.png)

### hover information
Show hover information and documentation about the current symbol under the cursor. Requires a relevant VSCode language extension
- `:Veonim hover`
![](https://veonim.github.io/veonim/hover.png)

### problems
Underline problems, view error details, navigate between errors, and apply refactoring fixes as reported by a VSCode language extension
- `:Veonim show-problem`
- `:Veonim next-problem`
- `:Veonim prev-problem`
- `:Veonim code-action`
![](https://veonim.github.io/veonim/problems.png)

### explorer
Fuzzy find and navigate files and directories
- `:Veonim explorer`
![](https://veonim.github.io/veonim/explorer.png)

### references
Find all references, jump between references, goto definition/implementation/typedef, and highlight document symbols. Requires a relevant VSCode language extension
- `:Veonim references`
- `:Veonim next-usage`
- `:Veonim prev-usage`
- `:Veonim definition`
- `:Veonim implementation`
- `:Veonim type-definition`
- `:Veonim highlight`
- `:Veonim highlight-clear`
![](https://veonim.github.io/veonim/references.png)

### buffer search
Fuzzy search current buffer text
- `:Veonim buffer-search`
![](https://veonim.github.io/veonim/buffer-search.png)

### nyan cat
Currently the only Neovim GUI that has nyan cat
- `:Veonim nc`
![](https://veonim.github.io/veonim/nyan.png)

## other cool projects you should check out

- [oni](https://github.com/onivim/oni) / [oni2](https://github.com/onivim/oni2)
- [gonvim](https://github.com/akiyosi/gonvim)
- [gnvim](https://github.com/vhakulinen/gnvim)
- [coc.nvim](https://github.com/neoclide/coc.nvim)

## build

Install the following things:
- node/npm
- latest neovim

Then run:
- `npm install` - standard issue download 5 million node_modules
- `npm run build` - release build of the code
- `npm run start:release` (optional) - run the release code without packaging
- `npm run package` - use electron-builder to create a binary package

Binaries available in `dist`

### development neovim configuration

when starting the development build of veonim (via `npm start`) the app is configured to load configurations from a local folder instead of the default `XDG_CONFIG_HOME` location. in other words, pretend this is your `~/.config` folder when running veonim in dev mode.

for example, place/copy your neovim configurations **relative to the veonim source folder**
- `./xdg_config/nvim/init.vim` - init.vim
- `./xdg_config/nvim/colors/gruvbox.vim` - colors

veonim will also download and install vim plugins and vscode extensions to this local dev config folder.

if the folder does not exist, an empty one will be created. the default veonim configurations will be used (same configurations that would apply if no `~/.config`/`XDG_CONFIG_HOME` folder existed)
