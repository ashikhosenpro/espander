# Espander Control Hub WordPress Plugin

This plugin adds a private WordPress admin screen for managing Espander top-bar
notifications, update metadata, documentation, about content, and anonymous install stats.

## Install

1. Upload this `espander-notifications` folder to `wp-content/plugins/`.
2. Activate **Espander Control Hub** from the WordPress Plugins page.
3. Open **Espander Hub** in the WordPress dashboard.
4. Use the submenu pages:
   - **Overview** for anonymous install/device counts and endpoint status.
   - **Notifications** for a filterable notification list with activate/deactivate actions.
   - **Add Notification** for rich notification creation and editing.
   - **Application Update** for latest version, release notes, and installer URLs.
   - **About Page** for the in-app About content.
   - **Documentation** for the in-app Documentation content.
   - **Footer Settings** for the app footer text and link.

The app reads notifications from:

```text
https://your-domain.com/wp-json/espander/v1/notifications
```

Build Espander with:

```bash
ESPANDER_NOTIFICATIONS_URL="https://your-domain.com/wp-json/espander/v1/notifications" npm run tauri:build
```

Espander also derives these endpoints automatically:

```text
https://your-domain.com/wp-json/espander/v1/update
https://your-domain.com/wp-json/espander/v1/content/docs
https://your-domain.com/wp-json/espander/v1/content/about
https://your-domain.com/wp-json/espander/v1/content/footer
https://your-domain.com/wp-json/espander/v1/telemetry
```

The read endpoints are public so installed apps can fetch content. Creating, editing, and
deleting content requires WordPress admin access. Telemetry stores an anonymous device id,
platform, version, first seen date, and last seen date.
