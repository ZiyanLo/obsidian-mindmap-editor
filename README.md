# Mind map editor · Minimal fork

这是 [vulture039 的 Mind map editor](https://github.com/vulture039/obsidian-mindmap-editor) 的个人改造版。原插件实现了 Markdown 与思维导图的双向编辑；这个 fork 主要调整了阅读界面和画布操作。

## 这个 fork 改了什么

- **更简洁的外观**：可选 CSS 片段去掉节点边框和填充，只保留文字、分支线与选中时的下划线。
- **更长的单行**：节点最大宽度从 300px 增至 520px，减少中文长句换行。
- **触控板操作**：双指滑动可同时横向和纵向移动画布，捏合缩放；常规滚轮缩放更快。`⌘/Ctrl + 滚轮`可强制缩放。
- **适度的画布边界**：缩小空白滚动范围，缩放时仍保持光标附近的内容位置。

Markdown 文件仍是唯一的数据源。你可以在编辑器、导图或其他本地工具（包括 AI）中修改同一份笔记。

## 安装这个 fork

1. 在 Obsidian 中安装并启用原版 **Mind map editor**。
2. 下载此仓库，在项目目录运行 `npm ci` 和 `npm run build`。
3. 把生成的 `main.js`、`styles.css` 和仓库中的 `manifest.json` 复制到笔记库的 `.obsidian/plugins/mindmap-editor/`，然后重新加载插件。
4. 如需极简外观，把 [`extras/mind-map-editor-minimal.css`](extras/mind-map-editor-minimal.css) 复制到笔记库的 `.obsidian/snippets/`，并在 **设置 → 外观 → CSS 代码片段** 中启用。

Obsidian 中手动更新原插件会覆盖此 fork 的程序文件；更新前请先备份。不同设备的滚轮事件可能略有差异，`⌘/Ctrl + 滚轮`始终用于缩放。

本项目沿用原项目的 [MIT 许可证](LICENSE)。感谢原作者 [vulture039](https://github.com/vulture039) 的工作。

---

# Mind map editor

[![Obsidian downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=%24%5B%22mindmap-editor%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=mindmap-editor)

Edit your outline as a mind map, synced to Markdown.
No new file format, no markup to add.

![Demo: reordering and reparenting nodes by drag & drop, checking off a task, and renaming a node - all saved back to the Markdown file live](docs/demo.gif)

## Usage

1. Open a Markdown file.
2. Press Ctrl+P (Cmd+P on macOS) and run `Open mind map for the active file` (or click the ribbon icon).
   Any note's map also opens from `Open mind map linked to this note` on its right-click menu, in the file
   explorer or on its tab.
3. The map opens beside the note on desktop, or in another tab on mobile.

## Features

- **Markdown-native maps** - Headings and lists form the map; edits write back to the same note.
- **Direct editing** - Add, rename, delete, multi-select, and drag nodes with undo/redo support.
- **Tasks and folds** - Add task notes, track and sync subtasks, collapse branches, and optionally hide completed tasks.
- **Rich node text** - Show body text with inline Markdown, links, and image previews.
- **Map/editor sync** - Selection, cursor position, folds, and wikilinks stay in sync.
- **Flexible views** - Zoom, pan, fit, and reopen each map at its saved position.
- **Link and Auto-open** - Link a map to a Markdown tab, or reopen it automatically with a note.
- **Node bookmarks** - Save important nodes and jump back from the map header. The plugin follows identifiable edits made in Obsidian even while the map is closed.
- **Node action bar** - Hover a node to add children or siblings, switch lists and tasks, and edit task metadata; right-click or `…` opens the full menu.
- **Visual hierarchy** - Depth, headings, and neighboring branch colors remain easy to distinguish.

## Keyboard shortcuts

Active while the mind map pane is focused.

| Key                     | Action                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `↑` / `↓`               | Select previous / next sibling, or walk the node's text line by line                                                   |
| `←` / `→`               | Select parent / first child                                                                                            |
| `Ctrl/Cmd + ←/→`        | Collapse / expand the selected branch (also in the right-click menu)                                                   |
| `Shift + ↑/↓`           | Move the node among its siblings                                                                                       |
| `Enter`                 | Add a sibling (a child on the root)                                                                                    |
| `Tab`                   | Add a child                                                                                                            |
| `F2`                    | Rename the node                                                                                                        |
| `Shift + F2`            | Add or edit the node's note                                                                                            |
| `Space`                 | Toggle the selected task's checkbox                                                                                    |
| `Ctrl/Cmd + B`          | Add or remove a bookmark for the selected node                                                                         |
| `Delete` / `Backspace`  | Delete the selected node(s) and their subtrees                                                                         |
| `Ctrl/Cmd + Z` / `+ ⇧Z` | Undo / redo, through the Markdown pane's history - or one step of the map's own when the note is only open for reading |
| `Esc`                   | End an edit, then clear the body-line and node selections                                                              |

Back/forward use Obsidian's own Navigate back / forward command:
`Ctrl + Alt + ←/→` (`Cmd + Option + ←/→` on macOS).

## Commands

None of these come with a hotkey; bind the ones you want in Settings → Hotkeys.

| Command                                             | What it does                                          |
| --------------------------------------------------- | ----------------------------------------------------- |
| `Open mind map for the active file`                 | Same as the ribbon icon                               |
| `Open mind map linked to the active file`           | Desktop: opens a map tied to the active Markdown tab  |
| `Fit mind map to viewport`                          | Fits the whole map in the viewport and centers it     |
| `Toggle focus between mind map and Markdown editor` | Jumps between the two panes                           |
| `Collapse all branches` / `Expand all branches`     | The `⌄⌃` header button, one direction at a time       |
| `Collapse unselected branches`                      | Keeps the selected node and its parent path visible   |
| `Fold all node text` / `Unfold all node text`       | The `≡` header button, likewise                       |
| `Show or hide node text on the map`                 | The `¶` header button                                 |
| `Refresh the mind map from the Markdown`            | The `⟳` header button: rebuilds the map from its file |

## Settings

**Settings → Mind map editor**:

- **Hide completed tasks by default** / **Show node text by default** - What a map starts with; each one is
  then switched on its own from its header (`✓✓`, `¶`).
- **Sync collapse state with Markdown folding** (default on) - An editing pane folds both ways; a reading pane
  follows along by its headings. List folding also follows Obsidian's Editor → Fold settings.
- **Split direction** - Side by side / stacked, for any pane the plugin splits open. A map that can join one
  already there opens as a tab instead, wherever that pane sits.
- **Remember linked maps** (default off) - Enable Auto-open when explicitly linking a map.
- **Close linked map with source** (default off) - Close a linked map with its Markdown tab.
- **Remove all node bookmarks** - Remove every saved node bookmark from every note.
- **Branch colors** - Custom family palette, one CSS color per line.

---

Building, testing and releasing the plugin: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
