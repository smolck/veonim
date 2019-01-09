![](https://veonim.github.io/veonim/header.png)

veonim is a simple modal IDE built on neovim. the goal is to create my ideal programming environment

![](https://veonim.github.io/veonim/smart.png)

## project status

veonim is still very early alpha and experimental. nothing is guaranteed. UX is lacking.

if you are feeling brave, maybe checkout the [User Guide](docs/readme.md)

Discord chat: https://discord.gg/sawWpMr

## currently in progress
- WebGL renderer (~30-60ms canvas render -> under 1ms webgl render lolololololol)
- super fast custom msgpack decoder (faster render, less GC/memory pressure)
- implement neovim `ext_multigrid` API (much faster render/more accurate than previous window splits logic) - https://github.com/neovim/neovim/pull/8455

## coming soon
- built-in debugger via debug adapter protocol & vscode extensions
- advanced neovim-native window management
- vscode extension api <-> neovim/veonim api bridge

## features

- rich language integration built on language servers (any language supporting LSP can work - see http://langserver.org)
    - auto completion
    - go to definition
    - go to type definition
    - go to implementation
    - find references
    - symbol search
    - show hover information
    - provide signature hint info
    - diagnostics (errors/warnings)
    - refactoring (rename, quick fix, code actions, etc.)
    - highlight symbols
- multiple concurrent multiplexed vim instances (kinda like tmux sessions/windows. in fact this feature originated from the desire to use a neovim gui with the same workflow as tmux)
- built-in vim plugin manager
- (limited) vscode extension support - should support language server extensions - more api support can be added as needed
- rich key mapping support with support for keyup + keydown events (think karabiner) - for example:
  - remap caps lock to escape
  - map commands to all modifiers such as ctrl + shift + alt + key
  - swap modifiers -> switch command and control
  - create additional modifiers with custom key transforms (e.g. create layers: mappings like `<c-s>` `<c-m>` but with another key `;s` `;m`)
- project find based on ripgrep
- fuzzy find for files and buffers
- fuzzy viewport search
- fuzzy buffer search
- improved vim search UI
- high performance optimized GPU rendering
- keyboard driven fuzzy file/directory explorer
- built-in "easymotion-style" jump to labels and jump to search results
- graphical neovim ui including windows, tabs, command line, status line, messages, cursor, cursorline, colorscheme adaptable interface etc.
- project/workspace/cd management
- reload vim buffers when modified (e.g. when edited in another program)
- open file from :terminal in current vim window
- everything configured via vim config file (init.vim) and scriptable from vimscript or remote plugins (any language)
- create fuzzy overlay menus and floating overlay menus with user defined options (built-in FZF.vim alternative)
- built-in statusline (displays current project, git branch, git changes, warning/problem count, cursor position, and tabpages)
- color picker + live vim colorscheme editing
- (experimental) parse :term compiler output and display problems in editor
    - the idea is that you may have an incremental compiler build script (i.e. npm scripts + typescript watch mode) that is running in the background, and you want to parse the compiler output and add it to IDE problems. compiler output may be different than language server diagnostics (and the compiler is the source of truth). also there may be other tasks that are happening in the incremental build script that would not occur with langserv diagnostics.
- and more!

## screenshots

### auto completion
![](https://veonim.github.io/veonim/completion.png)

### fuzzy file finder
![](https://veonim.github.io/veonim/files.png)

### find in project
![](https://veonim.github.io/veonim/grep.png)

### symbol search
![](https://veonim.github.io/veonim/symbols.png)

### signature hint
![](https://veonim.github.io/veonim/hint.png)

### hover information
![](https://veonim.github.io/veonim/hover.png)

### problems
![](https://veonim.github.io/veonim/problems.png)

### explorer
![](https://veonim.github.io/veonim/explorer.png)

### references
![](https://veonim.github.io/veonim/references.png)

### user defined menus
![](https://veonim.github.io/veonim/user-menu.png)

### custom task menus
![](https://veonim.github.io/veonim/tasks.png)

### color support
![](https://veonim.github.io/veonim/colors.png)

### vim command line
![](https://veonim.github.io/veonim/cmdline.png)

### notifications
![](https://veonim.github.io/veonim/echo.png)

### nyan cat
![](https://veonim.github.io/veonim/nyan.png)

## similar projects

the great neovim team have allowed the community to build some kick-ass projects. some of the more interesting ones that i'm excited about are:

- [oni](https://github.com/onivim/oni)
- [gonvim](https://github.com/akiyosi/gonvim)

## development

install dependencies and start automagic watch build and live reload instance

```
npm i
npm start
```

### neovim configuration

when starting the development build of veonim (via `npm start`) the app is configured to load configurations from a local folder instead of the default `XDG_CONFIG_HOME` location. in other words, pretend this is your `~/.config` folder when running veonim in dev mode.

for example, place/copy your neovim configurations **relative to the veonim source folder**
- `./xdg_config/nvim/init.vim` - init.vim
- `./xdg_config/nvim/colors/gruvbox.vim` - colors

veonim will also download and install neovim plugins and veonim extensions to this local dev config folder.

if the folder does not exist, an empty one will be created. the default veonim configurations will be used (same configurations that would apply if no `~/.config`/`XDG_CONFIG_HOME` folder existed)

### release build

build with release configuration

```
npm run build
```

test it out
```
npm run start:release
```

### creating releases

travis/appveyor will publish new github releases on tags

you can use npm to upversion package.json and create a tag:
- `npm version patch`
- `npm version minor`
- `npm version major`

or manually create tag (note that the package release version is lifted from package.json)

`git tag v0.8.0-alpha.1`

then push the git tag

`git push origin v0.8.0-alpha.1`

to create a local release package for your current operating system:

`npm run package`

you will find various binaries available for testing under `dist` folder
