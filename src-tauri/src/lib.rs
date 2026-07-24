pub mod commands;
pub mod db;
pub mod error;
pub mod espanso;
pub mod github;
pub mod github_sync;
pub mod sync;

use db::database::Database;
use db::settings::get_app_data_dir;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("espander=debug")
        .init();

    let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");

    let data_dir = rt
        .block_on(get_app_data_dir())
        .unwrap_or_else(|_| std::path::PathBuf::from(".").join(".espander"));

    let database = Database::new(data_dir.clone());
    if let Err(e) = rt.block_on(database.init()) {
        eprintln!("Failed to initialize database: {}", e);
    }

    let launched_from_autostart = std::env::args().any(|arg| arg == "--autostart");
    let mut show_window_on_start = cfg!(target_os = "windows") && !launched_from_autostart;

    if let Ok(settings) = rt.block_on(database.get_settings()) {
        show_window_on_start =
            (cfg!(target_os = "windows") && !launched_from_autostart)
                || !settings.first_launch_complete;
        if !settings.espanso_auto_detected {
            if let Ok(info) = rt.block_on(espanso::detector::detect_espanso()) {
                if info.found {
                    let patch = serde_json::json!({
                        "espanso_path": info.path,
                        "espanso_config_dir": info.config_dir,
                        "espanso_auto_detected": true,
                    });
                    let _ = rt.block_on(database.update_settings(patch));
                }
            }
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("Espander")
                .args(["--autostart"])
                .build(),
        )
        .manage(database)
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let show_item = MenuItem::with_id(app, "show", "Show Espander", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Espander", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }

            tray.build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_skip_taskbar(true);
                if show_window_on_start {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::snippets::get_snippets,
            commands::snippets::create_snippet,
            commands::snippets::update_snippet,
            commands::snippets::delete_snippet,
            commands::snippets::duplicate_snippet,
            commands::snippets::toggle_favorite,
            commands::snippets::bulk_delete_snippets,
            commands::snippets::bulk_move_snippets,
            commands::categories::get_categories,
            commands::categories::create_category,
            commands::categories::update_category,
            commands::categories::reorder_categories,
            commands::categories::delete_category,
            commands::categories::move_snippets_and_delete_category,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::open_browser,
            commands::permissions::get_permission_status,
            commands::espanso::detect_espanso,
            commands::espanso::generate_yaml,
            commands::espanso::deploy_and_reload,
            commands::sync::sync_now,
            commands::sync::get_sync_status,
            commands::sync::start_github_oauth,
            commands::sync::poll_github_oauth,
            commands::sync::get_github_username,
            commands::sync::list_github_repos,
            commands::sync::test_github_connection,
            commands::gsheet::validate_gsheet_url,
            commands::gsheet::import_from_gsheet,
            commands::backup::create_backup,
            commands::backup::restore_backup,
            commands::import_export::import_snippets,
            commands::about::read_about_page,
            commands::about::read_docs_page,
            commands::about::read_footer_settings,
            commands::import_export::export_snippets,
            commands::updater::check_updates_and_announcements,
            commands::updater::fetch_notifications,
            commands::updater::fetch_hub_tools,
            commands::updater::fetch_global_texts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Espander");
}
