# Espander Developer UI Customization Guide

This guide describes the styling structure of **Espander** and provides developers with instructions on how to inspect elements, locate styling rules, find React components, and perform UI customizations.

---

## 1. Styling Architecture & Files

Espander uses **Tailwind CSS** for component-level styling combined with a modular global CSS override architecture.

* **Global Tailwind Styles**: [src/index.css](src/index.css)
  Imports Tailwind modules and defines the color palette (using CSS custom properties) for both Light and Dark themes.
* **Customization Overrides**: [src/custom.css](src/custom.css)
  **All custom styling overrides, global spacing adjustments, and component radius adjustments should be written in this file.** It is loaded at the bottom of the global stylesheet to ensure it takes precedence over default styles.

---

## 2. DevTools and Inspecting Elements

Tauri includes complete support for Web Developer Tools in development builds.

### How to Inspect in Development
1. Start the application in development mode:
   ```bash
   npm run tauri dev
   ```
2. Once the application loads, **right-click** anywhere in the window and choose **Inspect** (or press `Cmd + Option + I` on macOS / `Ctrl + Shift + I` on Windows).
3. The DevTools panel will open. Use the **Element Selector** tool (`Cmd + Shift + C` / `Ctrl + Shift + C`) to hover over and select any UI element.

### Production DevTools Protection
> [!NOTE]
> Tauri automatically compiles out developer tools and disables element inspection (including right-click contexts and shortcut listeners) in production builds. There is no risk of exposing development tools or console logs to end users.

---

## 3. How to Identify Elements, Components, and Styles

### A. Which CSS class belongs to an element?
Select the element in the DevTools HTML tree. The **Styles** sidebar lists all active CSS classes, custom variables, and the computed properties for that element.

### B. Which React Component is rendering this element?
* Look for unique class names, ids, or text snippets on the selected element in the DevTools DOM tree.
* Search for that unique identifier across the `src/` directory. For example, if you see the class `selection-bar`, you can run a text search in your editor:
  ```bash
  grep -r "selection-bar" src/
  ```
* Component Directory Map:
  * [src/components/layout/](src/components/layout/) contains structural elements: [Sidebar.tsx](src/components/layout/Sidebar.tsx), [TopBar.tsx](src/components/layout/TopBar.tsx), and [AppLayout.tsx](src/components/layout/AppLayout.tsx).
  * [src/components/snippets/](src/components/snippets/) contains snippet listings, rows, and forms: [SnippetListPage.tsx](src/components/snippets/SnippetListPage.tsx), [SnippetRow.tsx](src/components/snippets/SnippetRow.tsx), and [SnippetEditorDialog.tsx](src/components/snippets/SnippetEditorDialog.tsx).
  * [src/components/settings/](src/components/settings/) contains settings and category listings: [SettingsPage.tsx](src/components/settings/SettingsPage.tsx).

### C. Which CSS file controls the styling?
* Utility-first rules are compiled directly into the DOM classes.
* Component overrides are loaded from [src/custom.css](src/custom.css). Check this file first to see if an element has custom overrides (such as `.sidebar`, `.snippet-table`, etc.).

---

## 4. Best Practices for UI Customization

1. **Modify Variables First**: To change layouts or aesthetics globally, adjust variables in [src/custom.css](src/custom.css) (e.g. `--radius-card`, `--sidebar-width`, or `--color-primary-indigo`).
2. **Avoid Direct Inline Editing**: Refrain from modifying Tailwind classes in the TSX code unless making structural changes. Write an override selector in `custom.css` instead.
3. **Use Theme Classes**: To write rules that only apply in Dark theme, wrap them inside the `.dark` class selector:
   ```css
   .dark .my-custom-element {
     background-color: #1a1a1a;
   }
   ```
