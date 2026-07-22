<?php
/**
 * Plugin Name: Espander Control Hub
 * Description: Manage Espander notifications, updates, documentation, about content, and anonymous install stats.
 * Version: 1.2.3
 * Author: Ashik Hosen
 * License: MIT
 */

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/github-oauth.php';

const ESPANDER_NOTIFICATIONS_OPTION = 'espander_notifications_items';
const ESPANDER_UPDATE_OPTION = 'espander_update_info';
const ESPANDER_CONTENT_OPTION = 'espander_content_pages';
const ESPANDER_DEVICES_OPTION = 'espander_device_stats';
const ESPANDER_TOOLS_OPTION = 'espander_more_tools_items';
const ESPANDER_GLOBAL_TEXTS_OPTION = 'espander_global_texts';
const ESPANDER_GITHUB_OAUTH_OPTION = 'espander_github_oauth';

add_action('admin_menu', 'espander_admin_menu');
add_action('admin_head', 'espander_admin_styles');
add_action('admin_post_espander_save_notification', 'espander_notifications_save');
add_action('admin_post_espander_delete_notification', 'espander_notifications_delete');
add_action('admin_post_espander_toggle_notification', 'espander_notifications_toggle');
add_action('admin_post_espander_save_tool', 'espander_tools_save');
add_action('admin_post_espander_delete_tool', 'espander_tools_delete');
add_action('admin_post_espander_toggle_tool', 'espander_tools_toggle');
add_action('admin_post_espander_save_update', 'espander_update_save');
add_action('admin_post_espander_save_content', 'espander_content_save');
add_action('admin_post_espander_save_global_texts', 'espander_global_texts_save');
add_action('admin_post_espander_save_github_oauth', 'espander_github_oauth_save');

add_action('rest_api_init', function () {
    register_rest_route('espander/v1', '/notifications', [
        'methods' => 'GET',
        'callback' => 'espander_notifications_rest_response',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('espander/v1', '/update', [
        'methods' => 'GET',
        'callback' => 'espander_update_rest_response',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('espander/v1', '/content/(?P<slug>about|docs|footer)', [
        'methods' => 'GET',
        'callback' => 'espander_content_rest_response',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('espander/v1', '/telemetry', [
        'methods' => 'POST',
        'callback' => 'espander_telemetry_rest_response',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('espander/v1', '/tools', [
        'methods' => 'GET',
        'callback' => 'espander_tools_rest_response',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('espander/v1', '/global-texts', [
        'methods' => 'GET',
        'callback' => 'espander_global_texts_rest_response',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('espander/v1', '/github/oauth/start', [
        'methods' => 'POST',
        'callback' => 'espander_github_oauth_start',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('espander/v1', '/github/oauth/callback', [
        'methods' => 'GET',
        'callback' => 'espander_github_oauth_callback',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('espander/v1', '/github/oauth/status', [
        'methods' => 'POST',
        'callback' => 'espander_github_oauth_status',
        'permission_callback' => '__return_true',
    ]);
});

function espander_admin_menu() {
    add_menu_page(
        'Espander Control Hub',
        'Espander Hub',
        'manage_options',
        'espander-hub',
        'espander_render_dashboard_page',
        'dashicons-megaphone',
        58
    );

    add_submenu_page('espander-hub', 'Overview', 'Overview', 'manage_options', 'espander-hub', 'espander_render_dashboard_page');
    add_submenu_page('espander-hub', 'Notifications', 'Notifications', 'manage_options', 'espander-notifications', 'espander_render_notifications_page');
    add_submenu_page('espander-hub', 'Add Notification', 'Add Notification', 'manage_options', 'espander-add-notification', 'espander_render_notification_form_page');
    add_submenu_page('espander-hub', 'Application Update', 'Application Update', 'manage_options', 'espander-update', 'espander_render_update_page');
    add_submenu_page('espander-hub', 'About Page', 'About Page', 'manage_options', 'espander-about', 'espander_render_about_page');
    add_submenu_page('espander-hub', 'Documentation', 'Documentation', 'manage_options', 'espander-documentation', 'espander_render_documentation_page');
    add_submenu_page('espander-hub', 'Footer Settings', 'Footer Settings', 'manage_options', 'espander-footer', 'espander_render_footer_page');
    add_submenu_page('espander-hub', 'Global Text', 'Global Text', 'manage_options', 'espander-global-text', 'espander_render_global_text_page');
    add_submenu_page('espander-hub', 'More Tools', 'More Tools', 'manage_options', 'espander-tools', 'espander_render_tools_page');
    add_submenu_page('espander-hub', 'Add Tool', 'Add Tool', 'manage_options', 'espander-add-tool', 'espander_render_tool_form_page');
    add_submenu_page('espander-hub', 'GitHub OAuth', 'GitHub OAuth', 'manage_options', 'espander-github-oauth', 'espander_render_github_oauth_page');
}

function espander_admin_styles() {
    $screen = get_current_screen();
    if (!$screen || strpos($screen->id, 'espander') === false) {
        return;
    }
    ?>
    <style>
        .espander-grid { display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr)); gap: 14px; max-width: 960px; }
        .espander-card { background: #fff; border: 1px solid #dcdcde; border-radius: 8px; padding: 18px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
        .espander-card strong { display: block; font-size: 28px; line-height: 1; margin-bottom: 6px; }
        .espander-panel { max-width: 920px; background: #fff; border: 1px solid #dcdcde; border-radius: 8px; padding: 20px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
        .espander-panel-wide { max-width: 1180px; }
        .espander-endpoints code { display: inline-block; margin: 2px 0; }
        .espander-status { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 3px 9px; font-size: 12px; font-weight: 600; }
        .espander-status-active { background: #edfaef; color: #116329; }
        .espander-status-inactive { background: #f6f7f7; color: #646970; }
        .espander-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }
        .espander-table-actions a { margin-right: 8px; }
        .espander-muted { color: #646970; }
        .espander-color-row { display: flex; gap: 8px; align-items: center; }
        .espander-color-row input[type="color"] { width: 44px; height: 32px; padding: 0 2px; }
        @media (max-width: 900px) { .espander-grid { grid-template-columns: repeat(2, minmax(140px, 1fr)); } }
    </style>
    <?php
}

function espander_admin_notice_messages() {
    $messages = [
        'updated' => 'Notification saved.',
        'deleted' => 'Notification deleted.',
        'activated' => 'Notification activated.',
        'deactivated' => 'Notification deactivated.',
        'tool_saved' => 'Tool saved.',
        'tool_deleted' => 'Tool deleted.',
        'tool_activated' => 'Tool activated.',
        'tool_deactivated' => 'Tool deactivated.',
        'update_saved' => 'Application update metadata saved.',
        'content_saved' => 'Content saved.',
        'global_text_saved' => 'Global text saved.',
    ];

    foreach ($messages as $key => $message) {
        if (isset($_GET[$key])) {
            echo '<div class="notice notice-success is-dismissible"><p>' . esc_html($message) . '</p></div>';
        }
    }
}

function espander_notifications_get_all() {
    $notifications = get_option(ESPANDER_NOTIFICATIONS_OPTION, []);
    return is_array($notifications) ? array_values($notifications) : [];
}

function espander_notifications_save_all($notifications) {
    update_option(ESPANDER_NOTIFICATIONS_OPTION, array_values($notifications), false);
}

function espander_notifications_find($id) {
    foreach (espander_notifications_get_all() as $notification) {
        if (($notification['id'] ?? '') === $id) {
            return $notification;
        }
    }

    return null;
}

function espander_notifications_normalize_datetime($value) {
    $value = sanitize_text_field(wp_unslash($value));
    if ($value === '') {
        return null;
    }

    if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $value)) {
        return $value . ':00Z';
    }

    return $value;
}

function espander_notification_form_defaults() {
    return [
        'id' => '',
        'content_type' => 'plain',
        'top_display_mode' => 'full',
        'top_visibility_mode' => 'custom',
        'top_visible_views' => ['all_snippets'],
        'title' => '',
        'excerpt' => '',
        'message' => '',
        'html_content' => null,
        'custom_css' => null,
        'custom_js' => null,
        'background_color' => null,
        'text_color' => null,
        'action_label' => null,
        'action_url' => null,
        'type_name' => 'info',
        'active' => true,
        'start_date' => null,
        'end_date' => null,
        'created_at' => null,
        'updated_at' => null,
        'schedule_mode' => 'always',
        'schedule_interval_days' => 1,
        'schedule_time_windows' => [],
        'schedule_window_minutes' => 60,
        'schedule_max_per_day' => null,
        'repeat_daily' => true,
        'dismissible' => true,
        'priority' => 0,
    ];
}

function espander_notifications_parse_time_windows($value) {
    $raw = is_array($value) ? implode("\n", $value) : (string) $value;
    $parts = preg_split('/[\r\n,]+/', $raw);
    $windows = [];

    foreach ($parts as $part) {
        $window = trim($part);
        if ($window !== '' && preg_match('/^\d{1,2}:\d{2}(\s*-\s*\d{1,2}:\d{2})?$/', $window)) {
            $windows[] = preg_replace('/\s+/', '', $window);
        }
    }

    return array_values(array_unique($windows));
}

function espander_notifications_save() {
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to manage Espander notifications.');
    }

    check_admin_referer('espander_save_notification');

    $id = isset($_POST['id']) ? sanitize_key(wp_unslash($_POST['id'])) : '';
    if ($id === '') {
        $id = 'notice-' . gmdate('YmdHis');
    }

    $content_type = isset($_POST['content_type']) ? sanitize_key(wp_unslash($_POST['content_type'])) : 'plain';
    if (!in_array($content_type, ['plain', 'html'], true)) {
        $content_type = 'plain';
    }

    $top_display_mode = isset($_POST['top_display_mode']) ? sanitize_key(wp_unslash($_POST['top_display_mode'])) : 'full';
    if (!in_array($top_display_mode, ['full', 'excerpt'], true)) {
        $top_display_mode = 'full';
    }

    $top_visibility_mode = isset($_POST['top_visibility_mode']) ? sanitize_key(wp_unslash($_POST['top_visibility_mode'])) : 'custom';
    if (!in_array($top_visibility_mode, ['global', 'custom'], true)) {
        $top_visibility_mode = 'custom';
    }

    $allowed_top_views = ['all_snippets', 'favorites', 'categories', 'settings', 'tools'];
    $top_visible_views = [];
    if (isset($_POST['top_visible_views']) && is_array($_POST['top_visible_views'])) {
        foreach (wp_unslash($_POST['top_visible_views']) as $view) {
            $view = sanitize_key($view);
            if (in_array($view, $allowed_top_views, true)) {
                $top_visible_views[] = $view;
            }
        }
    }
    if (empty($top_visible_views)) {
        $top_visible_views = ['all_snippets'];
    }

    $title = isset($_POST['title']) ? sanitize_text_field(wp_unslash($_POST['title'])) : '';
    if ($title === '') {
        $title = $content_type === 'html' ? 'HTML notification' : 'Untitled notification';
    }

    $created_at = gmdate('c');
    $notifications = espander_notifications_get_all();
    foreach ($notifications as $existing) {
        if (($existing['id'] ?? '') === $id && !empty($existing['created_at'])) {
            $created_at = $existing['created_at'];
            break;
        }
    }

    $schedule_mode = isset($_POST['schedule_mode']) ? sanitize_key(wp_unslash($_POST['schedule_mode'])) : 'always';
    if (!in_array($schedule_mode, ['always', 'daily', 'interval_days', 'time_windows'], true)) {
        $schedule_mode = 'always';
    }

    $schedule_interval_days = isset($_POST['schedule_interval_days']) ? max(1, (int) $_POST['schedule_interval_days']) : 1;
    $schedule_window_minutes = isset($_POST['schedule_window_minutes']) ? max(1, (int) $_POST['schedule_window_minutes']) : 60;
    $schedule_max_per_day = isset($_POST['schedule_max_per_day']) && $_POST['schedule_max_per_day'] !== '' ? max(1, (int) $_POST['schedule_max_per_day']) : null;
    $schedule_time_windows = isset($_POST['schedule_time_windows']) ? espander_notifications_parse_time_windows(wp_unslash($_POST['schedule_time_windows'])) : [];

    $notification = [
        'id' => $id,
        'content_type' => $content_type,
        'top_display_mode' => $top_display_mode,
        'top_visibility_mode' => $top_visibility_mode,
        'top_visible_views' => array_values(array_unique($top_visible_views)),
        'title' => $title,
        'excerpt' => isset($_POST['excerpt']) ? sanitize_textarea_field(wp_unslash($_POST['excerpt'])) : '',
        'message' => $content_type === 'plain' && isset($_POST['message']) ? sanitize_textarea_field(wp_unslash($_POST['message'])) : '',
        'html_content' => $content_type === 'html' && isset($_POST['html_content']) ? wp_kses_post(wp_unslash($_POST['html_content'])) : '',
        'custom_css' => $content_type === 'html' && isset($_POST['custom_css']) ? trim(wp_unslash($_POST['custom_css'])) : '',
        'custom_js' => $content_type === 'html' && isset($_POST['custom_js']) ? trim(wp_unslash($_POST['custom_js'])) : '',
        'background_color' => $content_type === 'plain' && isset($_POST['background_color']) ? sanitize_text_field(wp_unslash($_POST['background_color'])) : '',
        'text_color' => $content_type === 'plain' && isset($_POST['text_color']) ? sanitize_text_field(wp_unslash($_POST['text_color'])) : '',
        'action_label' => $content_type === 'plain' && isset($_POST['action_label']) ? sanitize_text_field(wp_unslash($_POST['action_label'])) : '',
        'action_url' => $content_type === 'plain' && isset($_POST['action_url']) ? esc_url_raw(wp_unslash($_POST['action_url'])) : '',
        'type_name' => $content_type === 'plain' && isset($_POST['type_name']) ? sanitize_key(wp_unslash($_POST['type_name'])) : 'info',
        'active' => isset($_POST['active']),
        'start_date' => isset($_POST['start_date']) ? espander_notifications_normalize_datetime($_POST['start_date']) : null,
        'end_date' => isset($_POST['end_date']) ? espander_notifications_normalize_datetime($_POST['end_date']) : null,
        'created_at' => $created_at,
        'updated_at' => gmdate('c'),
        'schedule_mode' => $schedule_mode,
        'schedule_interval_days' => $schedule_interval_days,
        'schedule_time_windows' => $schedule_time_windows,
        'schedule_window_minutes' => $schedule_window_minutes,
        'schedule_max_per_day' => $schedule_max_per_day,
        'repeat_daily' => isset($_POST['repeat_daily']),
        'dismissible' => isset($_POST['dismissible']),
        'priority' => isset($_POST['priority']) ? (int) $_POST['priority'] : 0,
    ];

    if (!in_array($notification['type_name'], ['info', 'success', 'warning', 'error'], true)) {
        $notification['type_name'] = 'info';
    }

    foreach (['excerpt', 'html_content', 'custom_css', 'custom_js', 'background_color', 'text_color', 'action_label', 'action_url'] as $field) {
        if ($notification[$field] === '') {
            $notification[$field] = null;
        }
    }

    $updated = false;

    foreach ($notifications as $index => $existing) {
        if (($existing['id'] ?? '') === $id) {
            $notifications[$index] = $notification;
            $updated = true;
            break;
        }
    }

    if (!$updated) {
        $notifications[] = $notification;
    }

    espander_notifications_save_all($notifications);

    wp_safe_redirect(admin_url('admin.php?page=espander-notifications&updated=1'));
    exit;
}

function espander_notifications_delete() {
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to manage Espander notifications.');
    }

    check_admin_referer('espander_delete_notification');

    $id = isset($_GET['id']) ? sanitize_key(wp_unslash($_GET['id'])) : '';
    $notifications = array_filter(
        espander_notifications_get_all(),
        function ($notification) use ($id) {
            return ($notification['id'] ?? '') !== $id;
        }
    );

    espander_notifications_save_all($notifications);

    wp_safe_redirect(admin_url('admin.php?page=espander-notifications&deleted=1'));
    exit;
}

function espander_notifications_toggle() {
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to manage Espander notifications.');
    }

    check_admin_referer('espander_toggle_notification');

    $id = isset($_GET['id']) ? sanitize_key(wp_unslash($_GET['id'])) : '';
    $next = isset($_GET['next']) ? sanitize_key(wp_unslash($_GET['next'])) : '0';
    $notifications = espander_notifications_get_all();

    foreach ($notifications as $index => $notification) {
        if (($notification['id'] ?? '') === $id) {
            $notifications[$index]['active'] = $next === '1';
            break;
        }
    }

    espander_notifications_save_all($notifications);
    $flag = $next === '1' ? 'activated' : 'deactivated';

    wp_safe_redirect(admin_url('admin.php?page=espander-notifications&' . $flag . '=1'));
    exit;
}

function espander_notifications_filtered() {
    $notifications = espander_notifications_get_all();
    $status = isset($_GET['status']) ? sanitize_key(wp_unslash($_GET['status'])) : 'all';
    $type = isset($_GET['type']) ? sanitize_key(wp_unslash($_GET['type'])) : 'all';
    $search = isset($_GET['s']) ? sanitize_text_field(wp_unslash($_GET['s'])) : '';

    $filtered = array_filter($notifications, function ($notification) use ($status, $type, $search) {
        if ($status === 'active' && empty($notification['active'])) {
            return false;
        }
        if ($status === 'inactive' && !empty($notification['active'])) {
            return false;
        }
        if ($type !== 'all' && ($notification['type_name'] ?? 'info') !== $type) {
            return false;
        }
        if ($search !== '') {
            $haystack = strtolower(($notification['title'] ?? '') . ' ' . ($notification['message'] ?? '') . ' ' . ($notification['html_content'] ?? ''));
            if (strpos($haystack, strtolower($search)) === false) {
                return false;
            }
        }
        return true;
    });

    usort($filtered, function ($a, $b) {
        return strtotime($b['created_at'] ?? $b['updated_at'] ?? $b['start_date'] ?? '1970-01-01') <=> strtotime($a['created_at'] ?? $a['updated_at'] ?? $a['start_date'] ?? '1970-01-01');
    });

    return array_values($filtered);
}

function espander_notifications_rest_response() {
    $notifications = array_filter(
        espander_notifications_get_all(),
        function ($notification) {
            return !empty($notification['active']);
        }
    );

    usort($notifications, function ($a, $b) {
        $priority = ((int) ($b['priority'] ?? 0)) <=> ((int) ($a['priority'] ?? 0));
        if ($priority !== 0) {
            return $priority;
        }
        return strtotime($b['created_at'] ?? $b['updated_at'] ?? $b['start_date'] ?? '1970-01-01') <=> strtotime($a['created_at'] ?? $a['updated_at'] ?? $a['start_date'] ?? '1970-01-01');
    });

    return rest_ensure_response([
        'notifications' => array_values($notifications),
    ]);
}

function espander_notifications_to_datetime_local($value) {
    if (empty($value)) {
        return '';
    }

    return substr((string) $value, 0, 16);
}

function espander_tools_defaults() {
    return [
        'id' => '',
        'name' => '',
        'version' => '',
        'image_url' => '',
        'short_description' => '',
        'button_label' => 'Open',
        'button_url' => '',
        'active' => true,
        'sort_order' => 0,
        'created_at' => null,
        'updated_at' => null,
    ];
}

function espander_tools_get_all() {
    $tools = get_option(ESPANDER_TOOLS_OPTION, []);
    return is_array($tools) ? array_values($tools) : [];
}

function espander_tools_save_all($tools) {
    update_option(ESPANDER_TOOLS_OPTION, array_values($tools), false);
}

function espander_tools_find($id) {
    foreach (espander_tools_get_all() as $tool) {
        if (($tool['id'] ?? '') === $id) {
            return $tool;
        }
    }
    return null;
}

function espander_tools_sort($tools) {
    usort($tools, function ($a, $b) {
        $order = ((int) ($a['sort_order'] ?? 0)) <=> ((int) ($b['sort_order'] ?? 0));
        if ($order !== 0) {
            return $order;
        }
        return strtotime($b['created_at'] ?? $b['updated_at'] ?? '1970-01-01') <=> strtotime($a['created_at'] ?? $a['updated_at'] ?? '1970-01-01');
    });

    return array_values($tools);
}

function espander_tools_save() {
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to manage Espander tools.');
    }

    check_admin_referer('espander_save_tool');

    $id = isset($_POST['id']) ? sanitize_key(wp_unslash($_POST['id'])) : '';
    if ($id === '') {
        $id = 'tool-' . gmdate('YmdHis');
    }

    $tools = espander_tools_get_all();
    $created_at = gmdate('c');
    foreach ($tools as $existing) {
        if (($existing['id'] ?? '') === $id && !empty($existing['created_at'])) {
            $created_at = $existing['created_at'];
            break;
        }
    }

    $tool = [
        'id' => $id,
        'name' => isset($_POST['name']) ? sanitize_text_field(wp_unslash($_POST['name'])) : '',
        'version' => isset($_POST['version']) ? sanitize_text_field(wp_unslash($_POST['version'])) : '',
        'image_url' => isset($_POST['image_url']) ? esc_url_raw(wp_unslash($_POST['image_url'])) : '',
        'short_description' => isset($_POST['short_description']) ? sanitize_textarea_field(wp_unslash($_POST['short_description'])) : '',
        'button_label' => isset($_POST['button_label']) ? sanitize_text_field(wp_unslash($_POST['button_label'])) : 'Open',
        'button_url' => isset($_POST['button_url']) ? esc_url_raw(wp_unslash($_POST['button_url'])) : '',
        'active' => isset($_POST['active']),
        'sort_order' => isset($_POST['sort_order']) ? (int) $_POST['sort_order'] : 0,
        'created_at' => $created_at,
        'updated_at' => gmdate('c'),
    ];

    foreach (['version', 'image_url'] as $field) {
        if ($tool[$field] === '') {
            $tool[$field] = null;
        }
    }

    if ($tool['button_label'] === '') {
        $tool['button_label'] = 'Open';
    }

    $updated = false;
    foreach ($tools as $index => $existing) {
        if (($existing['id'] ?? '') === $id) {
            $tools[$index] = $tool;
            $updated = true;
            break;
        }
    }

    if (!$updated) {
        $tools[] = $tool;
    }

    espander_tools_save_all($tools);
    wp_safe_redirect(admin_url('admin.php?page=espander-tools&tool_saved=1'));
    exit;
}

function espander_tools_delete() {
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to manage Espander tools.');
    }

    check_admin_referer('espander_delete_tool');

    $id = isset($_GET['id']) ? sanitize_key(wp_unslash($_GET['id'])) : '';
    $tools = array_filter(espander_tools_get_all(), function ($tool) use ($id) {
        return ($tool['id'] ?? '') !== $id;
    });

    espander_tools_save_all($tools);
    wp_safe_redirect(admin_url('admin.php?page=espander-tools&tool_deleted=1'));
    exit;
}

function espander_tools_toggle() {
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to manage Espander tools.');
    }

    check_admin_referer('espander_toggle_tool');

    $id = isset($_GET['id']) ? sanitize_key(wp_unslash($_GET['id'])) : '';
    $next = isset($_GET['next']) ? sanitize_key(wp_unslash($_GET['next'])) : '0';
    $tools = espander_tools_get_all();

    foreach ($tools as $index => $tool) {
        if (($tool['id'] ?? '') === $id) {
            $tools[$index]['active'] = $next === '1';
            $tools[$index]['updated_at'] = gmdate('c');
            break;
        }
    }

    espander_tools_save_all($tools);
    wp_safe_redirect(admin_url('admin.php?page=espander-tools&' . ($next === '1' ? 'tool_activated' : 'tool_deactivated') . '=1'));
    exit;
}

function espander_tools_rest_response() {
    $tools = array_filter(espander_tools_get_all(), function ($tool) {
        return !empty($tool['active']);
    });

    return rest_ensure_response([
        'tools' => espander_tools_sort($tools),
    ]);
}

function espander_global_text_defaults() {
    return [
        'more_tools_title' => 'More Tools',
        'more_tools_subtitle' => 'Useful tools and products from Espander.',
        'notifications_title' => 'Notifications',
        'notifications_subtitle' => 'Messages and announcements from Espander.',
    ];
}

function espander_global_texts_get() {
    $texts = get_option(ESPANDER_GLOBAL_TEXTS_OPTION, []);
    return array_merge(espander_global_text_defaults(), is_array($texts) ? $texts : []);
}

function espander_global_texts_save() {
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to manage Espander global text.');
    }

    check_admin_referer('espander_save_global_texts');

    $defaults = espander_global_text_defaults();
    $texts = [];
    foreach ($defaults as $key => $default) {
        $value = isset($_POST[$key]) ? sanitize_text_field(wp_unslash($_POST[$key])) : '';
        $texts[$key] = $value !== '' ? $value : $default;
    }

    update_option(ESPANDER_GLOBAL_TEXTS_OPTION, $texts, false);
    wp_safe_redirect(admin_url('admin.php?page=espander-global-text&global_text_saved=1'));
    exit;
}

function espander_global_texts_rest_response() {
    return rest_ensure_response(espander_global_texts_get());
}

function espander_update_default() {
    return [
        'active' => false,
        'version' => '',
        'release_date' => '',
        'release_notes' => '',
        'download_url' => '',
        'macos_download_url' => '',
        'windows_download_url' => '',
        'github_releases_url' => '',
    ];
}

function espander_update_get() {
    $update = get_option(ESPANDER_UPDATE_OPTION, []);
    return array_merge(espander_update_default(), is_array($update) ? $update : []);
}

function espander_update_save() {
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to manage Espander updates.');
    }

    check_admin_referer('espander_save_update');

    $update = [
        'active' => isset($_POST['update_active']),
        'version' => isset($_POST['version']) ? sanitize_text_field(wp_unslash($_POST['version'])) : '',
        'release_date' => isset($_POST['release_date']) ? sanitize_text_field(wp_unslash($_POST['release_date'])) : '',
        'release_notes' => isset($_POST['release_notes']) ? sanitize_textarea_field(wp_unslash($_POST['release_notes'])) : '',
        'download_url' => isset($_POST['download_url']) ? esc_url_raw(wp_unslash($_POST['download_url'])) : '',
        'macos_download_url' => isset($_POST['macos_download_url']) ? esc_url_raw(wp_unslash($_POST['macos_download_url'])) : '',
        'windows_download_url' => isset($_POST['windows_download_url']) ? esc_url_raw(wp_unslash($_POST['windows_download_url'])) : '',
        'github_releases_url' => isset($_POST['github_releases_url']) ? esc_url_raw(wp_unslash($_POST['github_releases_url'])) : '',
    ];

    update_option(ESPANDER_UPDATE_OPTION, $update, false);

    wp_safe_redirect(admin_url('admin.php?page=espander-update&update_saved=1'));
    exit;
}

function espander_update_rest_response() {
    $update = espander_update_get();
    $has_required_fields = !empty($update['version']) && !empty($update['download_url']);

    return rest_ensure_response([
        'announcement' => null,
        'updater' => (!empty($update['active']) && $has_required_fields) ? [
            'version' => $update['version'],
            'release_date' => $update['release_date'],
            'release_notes' => $update['release_notes'],
            'download_url' => $update['download_url'],
            'macos_download_url' => $update['macos_download_url'] ?: null,
            'windows_download_url' => $update['windows_download_url'] ?: null,
            'github_releases_url' => $update['github_releases_url'] ?: $update['download_url'],
        ] : null,
    ]);
}

function espander_content_default() {
    return [
        'about' => '<h1>About Espander</h1><p>Espander is an open-source visual manager and sync companion for Espanso.</p>',
        'docs' => '<h1>Espander Documentation</h1><p>Write your app documentation here from WordPress.</p>',
        'footer' => [
            'left_text' => 'Espander v0.1.0 · MIT License',
            'link_label' => 'GitHub',
            'link_url' => 'https://github.com/ashikhosenpro/Expander',
            'show_github_icon' => true,
        ],
    ];
}

function espander_content_get() {
    $content = get_option(ESPANDER_CONTENT_OPTION, []);
    return array_merge(espander_content_default(), is_array($content) ? $content : []);
}

function espander_content_save() {
    if (!current_user_can('manage_options')) {
        wp_die('You do not have permission to manage Espander content.');
    }

    check_admin_referer('espander_save_content');

    $slug = isset($_POST['slug']) ? sanitize_key(wp_unslash($_POST['slug'])) : '';
    if (!in_array($slug, ['about', 'docs', 'footer'], true)) {
        wp_die('Invalid content page.');
    }

    $content = espander_content_get();
    if ($slug === 'footer') {
        $content[$slug] = [
            'left_text' => isset($_POST['left_text']) ? sanitize_text_field(wp_unslash($_POST['left_text'])) : '',
            'link_label' => isset($_POST['link_label']) ? sanitize_text_field(wp_unslash($_POST['link_label'])) : '',
            'link_url' => isset($_POST['link_url']) ? esc_url_raw(wp_unslash($_POST['link_url'])) : '',
            'show_github_icon' => isset($_POST['show_github_icon']),
        ];
    } else {
        // About and Documentation are trusted administrator-authored source.
        // Store it losslessly so HTML comments, quotes, entities and CSS syntax
        // are not normalized into visible text. The desktop app renders this
        // inside an isolated Shadow DOM and removes executable markup.
        $content[$slug] = isset($_POST['html'])
            ? wp_unslash($_POST['html'])
            : '';
    }

    update_option(ESPANDER_CONTENT_OPTION, $content, false);

    $page = $slug === 'about' ? 'espander-about' : ($slug === 'footer' ? 'espander-footer' : 'espander-documentation');
    wp_safe_redirect(admin_url('admin.php?page=' . $page . '&content_saved=1'));
    exit;
}

function espander_content_rest_response($request) {
    $slug = sanitize_key($request['slug']);
    $content = espander_content_get();

    if ($slug === 'footer') {
        $footer = is_array($content['footer'] ?? null) ? $content['footer'] : espander_content_default()['footer'];
        return rest_ensure_response([
            'slug' => $slug,
            'footer' => $footer,
        ]);
    }

    return rest_ensure_response([
        'slug' => $slug,
        'html' => $content[$slug] ?? '',
    ]);
}

function espander_devices_get() {
    $devices = get_option(ESPANDER_DEVICES_OPTION, []);
    return is_array($devices) ? $devices : [];
}

function espander_devices_save($devices) {
    update_option(ESPANDER_DEVICES_OPTION, $devices, false);
}

function espander_telemetry_rest_response($request) {
    $params = $request->get_json_params();
    $device_id = isset($params['device_id']) ? sanitize_key($params['device_id']) : '';

    if ($device_id === '') {
        return new WP_REST_Response(['ok' => false], 400);
    }

    $platform = isset($params['platform']) ? sanitize_key($params['platform']) : 'unknown';
    if (!in_array($platform, ['macos', 'windows', 'linux', 'unknown'], true)) {
        $platform = 'unknown';
    }

    $devices = espander_devices_get();
    $devices[$device_id] = [
        'platform' => $platform,
        'version' => isset($params['version']) ? sanitize_text_field($params['version']) : '',
        'first_seen' => $devices[$device_id]['first_seen'] ?? gmdate('c'),
        'last_seen' => gmdate('c'),
    ];

    espander_devices_save($devices);

    return rest_ensure_response(['ok' => true]);
}

function espander_devices_summary() {
    $devices = espander_devices_get();
    $summary = [
        'total' => count($devices),
        'macos' => 0,
        'windows' => 0,
        'linux' => 0,
        'unknown' => 0,
    ];

    foreach ($devices as $device) {
        $platform = $device['platform'] ?? 'unknown';
        if (!isset($summary[$platform])) {
            $platform = 'unknown';
        }
        $summary[$platform]++;
    }

    return $summary;
}

function espander_render_dashboard_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $devices = espander_devices_summary();
    $notifications = espander_notifications_get_all();
    $active_notifications = count(array_filter($notifications, function ($notification) {
        return !empty($notification['active']);
    }));
    $active_tools = count(array_filter(espander_tools_get_all(), function ($tool) {
        return !empty($tool['active']);
    }));
    $update = espander_update_get();
    ?>
    <div class="wrap">
        <h1>Espander Control Hub</h1>
        <?php espander_admin_notice_messages(); ?>

        <div class="espander-grid">
            <div class="espander-card"><strong><?php echo esc_html((string) $devices['total']); ?></strong><span>Total devices</span></div>
            <div class="espander-card"><strong><?php echo esc_html((string) $devices['macos']); ?></strong><span>macOS</span></div>
            <div class="espander-card"><strong><?php echo esc_html((string) $devices['windows']); ?></strong><span>Windows</span></div>
            <div class="espander-card"><strong><?php echo esc_html((string) $devices['linux']); ?></strong><span>Linux</span></div>
        </div>

        <div class="espander-panel espander-panel-wide" style="margin-top: 18px;">
            <h2>Publishing Overview</h2>
            <p><strong><?php echo esc_html((string) $active_notifications); ?></strong> active notifications out of <?php echo esc_html((string) count($notifications)); ?> total.</p>
            <p><strong><?php echo esc_html((string) $active_tools); ?></strong> active tools are available in the app.</p>
            <p>Update publishing is <strong><?php echo !empty($update['active']) ? 'active' : 'inactive'; ?></strong><?php echo !empty($update['version']) ? ' for v' . esc_html($update['version']) : ''; ?>.</p>
            <p class="espander-endpoints">
                Notifications: <code><?php echo esc_html(rest_url('espander/v1/notifications')); ?></code><br>
                More Tools: <code><?php echo esc_html(rest_url('espander/v1/tools')); ?></code><br>
                Global Text: <code><?php echo esc_html(rest_url('espander/v1/global-texts')); ?></code><br>
                Update: <code><?php echo esc_html(rest_url('espander/v1/update')); ?></code><br>
                Documentation: <code><?php echo esc_html(rest_url('espander/v1/content/docs')); ?></code><br>
                About: <code><?php echo esc_html(rest_url('espander/v1/content/about')); ?></code><br>
                Footer: <code><?php echo esc_html(rest_url('espander/v1/content/footer')); ?></code><br>
                Telemetry: <code><?php echo esc_html(rest_url('espander/v1/telemetry')); ?></code>
            </p>
        </div>
    </div>
    <?php
}

function espander_render_notifications_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $notifications = espander_notifications_filtered();
    $status = isset($_GET['status']) ? sanitize_key(wp_unslash($_GET['status'])) : 'all';
    $type = isset($_GET['type']) ? sanitize_key(wp_unslash($_GET['type'])) : 'all';
    $search = isset($_GET['s']) ? sanitize_text_field(wp_unslash($_GET['s'])) : '';
    ?>
    <div class="wrap">
        <h1 class="wp-heading-inline">Notifications</h1>
        <a href="<?php echo esc_url(admin_url('admin.php?page=espander-add-notification')); ?>" class="page-title-action">Add New</a>
        <?php espander_admin_notice_messages(); ?>

        <form method="get" style="margin: 16px 0;">
            <input type="hidden" name="page" value="espander-notifications">
            <select name="status">
                <option value="all" <?php selected($status, 'all'); ?>>All statuses</option>
                <option value="active" <?php selected($status, 'active'); ?>>Active</option>
                <option value="inactive" <?php selected($status, 'inactive'); ?>>Inactive</option>
            </select>
            <select name="type">
                <option value="all" <?php selected($type, 'all'); ?>>All types</option>
                <?php foreach (['info', 'success', 'warning', 'error'] as $item) : ?>
                    <option value="<?php echo esc_attr($item); ?>" <?php selected($type, $item); ?>><?php echo esc_html(ucfirst($item)); ?></option>
                <?php endforeach; ?>
            </select>
            <input type="search" name="s" value="<?php echo esc_attr($search); ?>" placeholder="Search notifications">
            <?php submit_button('Filter', 'secondary', '', false); ?>
            <a class="button" href="<?php echo esc_url(admin_url('admin.php?page=espander-notifications')); ?>">Reset</a>
        </form>

        <table class="widefat striped">
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Priority</th>
                    <th>Schedule</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($notifications)) : ?>
                    <tr><td colspan="7">No notifications match this filter.</td></tr>
                <?php else : ?>
                    <?php foreach ($notifications as $notification) : ?>
                        <?php
                        $is_active = !empty($notification['active']);
                        $toggle_url = wp_nonce_url(
                            admin_url('admin-post.php?action=espander_toggle_notification&id=' . urlencode($notification['id']) . '&next=' . ($is_active ? '0' : '1')),
                            'espander_toggle_notification'
                        );
                        ?>
                        <tr>
                            <td>
                                <strong><?php echo esc_html($notification['title'] ?? ''); ?></strong>
                                <br><span class="espander-muted"><?php echo esc_html(($notification['content_type'] ?? 'plain') === 'html' ? 'HTML notification' : wp_trim_words($notification['message'] ?? '', 18)); ?></span>
                            </td>
                            <td><?php echo esc_html($notification['type_name'] ?? 'info'); ?></td>
                            <td>
                                <span class="espander-status <?php echo $is_active ? 'espander-status-active' : 'espander-status-inactive'; ?>">
                                    <span class="espander-dot"></span><?php echo $is_active ? 'Active' : 'Inactive'; ?>
                                </span>
                            </td>
                            <td><?php echo esc_html($notification['created_at'] ?? $notification['updated_at'] ?? ''); ?></td>
                            <td><?php echo esc_html((string) ($notification['priority'] ?? 0)); ?></td>
                            <td>
                                <?php echo esc_html($notification['start_date'] ?? ''); ?>
                                <?php if (!empty($notification['end_date'])) : ?>
                                    <br>to <?php echo esc_html($notification['end_date']); ?>
                                <?php endif; ?>
                            </td>
                            <td class="espander-table-actions">
                                <a href="<?php echo esc_url(admin_url('admin.php?page=espander-add-notification&edit=' . urlencode($notification['id']))); ?>">Edit</a>
                                <a href="<?php echo esc_url($toggle_url); ?>"><?php echo $is_active ? 'Deactivate' : 'Activate'; ?></a>
                                <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=espander_delete_notification&id=' . urlencode($notification['id'])), 'espander_delete_notification')); ?>" onclick="return confirm('Delete this notification?');">Delete</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
    <?php
}

function espander_render_notification_form_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $edit_id = isset($_GET['edit']) ? sanitize_key(wp_unslash($_GET['edit'])) : '';
    $editing = $edit_id ? espander_notifications_find($edit_id) : null;
    $notification = array_merge(espander_notification_form_defaults(), is_array($editing) ? $editing : []);
    if (($notification['content_type'] ?? 'plain') === 'plain' && !empty($notification['html_content'])) {
        $notification['content_type'] = 'html';
    }
    if (!is_array($notification['schedule_time_windows'])) {
        $notification['schedule_time_windows'] = espander_notifications_parse_time_windows($notification['schedule_time_windows']);
    }
    if (!is_array($notification['top_visible_views'])) {
        $notification['top_visible_views'] = ['all_snippets'];
    }
    $background_picker_value = preg_match('/^#[0-9a-fA-F]{6}$/', (string) $notification['background_color']) ? $notification['background_color'] : '#082f49';
    $text_picker_value = preg_match('/^#[0-9a-fA-F]{6}$/', (string) $notification['text_color']) ? $notification['text_color'] : '#e5f4ff';
    $time_windows_value = implode("\n", $notification['schedule_time_windows']);
    ?>
    <div class="wrap">
        <h1><?php echo $editing ? 'Edit Notification' : 'Add Notification'; ?></h1>
        <?php espander_admin_notice_messages(); ?>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="espander-panel">
            <input type="hidden" name="action" value="espander_save_notification">
            <input type="hidden" name="id" value="<?php echo esc_attr($notification['id']); ?>">
            <?php wp_nonce_field('espander_save_notification'); ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="content_type">Notification content</label></th>
                    <td>
                        <select name="content_type" id="content_type">
                            <option value="plain" <?php selected($notification['content_type'], 'plain'); ?>>Plain message</option>
                            <option value="html" <?php selected($notification['content_type'], 'html'); ?>>HTML content</option>
                        </select>
                        <p class="description">Plain uses Espander's native notification layout. HTML renders exactly as your code designs it.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="title">Title</label></th>
                    <td>
                        <input name="title" id="title" type="text" class="regular-text" required value="<?php echo esc_attr($notification['title']); ?>">
                        <p class="description">Used in the admin list and Espander's notifications page. HTML notifications will not show this title in the top banner.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="top_display_mode">Top banner display</label></th>
                    <td>
                        <select name="top_display_mode" id="top_display_mode">
                            <option value="full" <?php selected($notification['top_display_mode'], 'full'); ?>>Full content</option>
                            <option value="excerpt" <?php selected($notification['top_display_mode'], 'excerpt'); ?>>Title and excerpt only</option>
                        </select>
                        <p class="description">Only affects the top notification banner. The notifications page always shows full details.</p>
                    </td>
                </tr>
                <tr class="espander-excerpt-field">
                    <th scope="row"><label for="excerpt">Top banner excerpt</label></th>
                    <td>
                        <textarea name="excerpt" id="excerpt" class="large-text" rows="3" placeholder="Short summary for the top banner."><?php echo esc_textarea($notification['excerpt']); ?></textarea>
                        <p class="description">Shown with the title when top banner display is set to excerpt. If empty, the plain message is used when available.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="top_visibility_mode">Top banner visibility</label></th>
                    <td>
                        <select name="top_visibility_mode" id="top_visibility_mode">
                            <option value="custom" <?php selected($notification['top_visibility_mode'], 'custom'); ?>>Selected pages only</option>
                            <option value="global" <?php selected($notification['top_visibility_mode'], 'global'); ?>>Global, show everywhere</option>
                        </select>
                        <p class="description">Controls where the top notification banner appears in the app.</p>
                    </td>
                </tr>
                <tr class="espander-top-views-field">
                    <th scope="row">Show on</th>
                    <td>
                        <?php
                        $top_view_options = [
                            'all_snippets' => 'All Snippets',
                            'favorites' => 'Favorites',
                            'categories' => 'Categories',
                            'settings' => 'Settings',
                            'tools' => 'More Tools',
                        ];
                        foreach ($top_view_options as $view_key => $view_label) :
                        ?>
                            <label style="display:block;margin-bottom:6px;">
                                <input name="top_visible_views[]" type="checkbox" value="<?php echo esc_attr($view_key); ?>" <?php checked(in_array($view_key, $notification['top_visible_views'], true)); ?>>
                                <?php echo esc_html($view_label); ?>
                            </label>
                        <?php endforeach; ?>
                        <p class="description">If none are selected, All Snippets will be used by default.</p>
                    </td>
                </tr>
                <tr class="espander-plain-field">
                    <th scope="row"><label for="message">Plain message</label></th>
                    <td><textarea name="message" id="message" class="large-text" rows="4"><?php echo esc_textarea($notification['message']); ?></textarea></td>
                </tr>
                <tr class="espander-html-field">
                    <th scope="row"><label for="html_content">HTML content</label></th>
                    <td>
                        <textarea name="html_content" id="html_content" class="large-text code" rows="7" placeholder="<p><strong>New:</strong> Rich notification content.</p>"><?php echo esc_textarea($notification['html_content']); ?></textarea>
                        <p class="description">Rendered inside an isolated frame in Espander. CSS here cannot affect the app outside this notification.</p>
                    </td>
                </tr>
                <tr class="espander-html-field">
                    <th scope="row"><label for="custom_css">Custom CSS</label></th>
                    <td>
                        <textarea name="custom_css" id="custom_css" class="large-text code" rows="5" placeholder="* { box-sizing: border-box; }"><?php echo esc_textarea($notification['custom_css']); ?></textarea>
                        <p class="description">Scoped to this notification frame only. Universal selectors will not affect Espander's app UI.</p>
                    </td>
                </tr>
                <tr class="espander-html-field">
                    <th scope="row"><label for="custom_js">Custom JS</label></th>
                    <td>
                        <textarea name="custom_js" id="custom_js" class="large-text code" rows="5" placeholder="document.body.classList.add('ready');"><?php echo esc_textarea($notification['custom_js']); ?></textarea>
                        <p class="description">Runs inside the isolated notification frame only.</p>
                    </td>
                </tr>
                <tr class="espander-plain-field">
                    <th scope="row"><label for="background_color">Background</label></th>
                    <td>
                        <div class="espander-color-row">
                            <input id="background_color_picker" type="color" value="<?php echo esc_attr($background_picker_value); ?>">
                            <input name="background_color" id="background_color" type="text" class="regular-text" placeholder="#082f49 or linear-gradient(...)" value="<?php echo esc_attr($notification['background_color']); ?>">
                        </div>
                    </td>
                </tr>
                <tr class="espander-plain-field">
                    <th scope="row"><label for="text_color">Text color</label></th>
                    <td>
                        <div class="espander-color-row">
                            <input id="text_color_picker" type="color" value="<?php echo esc_attr($text_picker_value); ?>">
                            <input name="text_color" id="text_color" type="text" class="regular-text" placeholder="#e5f4ff" value="<?php echo esc_attr($notification['text_color']); ?>">
                        </div>
                    </td>
                </tr>
                <tr class="espander-plain-field">
                    <th scope="row"><label for="action_label">Action button</label></th>
                    <td>
                        <input name="action_label" id="action_label" type="text" class="regular-text" placeholder="Learn more" value="<?php echo esc_attr($notification['action_label']); ?>">
                        <input name="action_url" id="action_url" type="url" class="regular-text" placeholder="https://example.com" value="<?php echo esc_attr($notification['action_url']); ?>">
                    </td>
                </tr>
                <tr class="espander-plain-field">
                    <th scope="row"><label for="type_name">Type</label></th>
                    <td>
                        <select name="type_name" id="type_name">
                            <?php foreach (['info', 'success', 'warning', 'error'] as $type) : ?>
                                <option value="<?php echo esc_attr($type); ?>" <?php selected($notification['type_name'], $type); ?>><?php echo esc_html(ucfirst($type)); ?></option>
                            <?php endforeach; ?>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="start_date">Start date</label></th>
                    <td><input name="start_date" id="start_date" type="datetime-local" value="<?php echo esc_attr(espander_notifications_to_datetime_local($notification['start_date'])); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="end_date">End date</label></th>
                    <td><input name="end_date" id="end_date" type="datetime-local" value="<?php echo esc_attr(espander_notifications_to_datetime_local($notification['end_date'])); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="schedule_mode">Schedule</label></th>
                    <td>
                        <select name="schedule_mode" id="schedule_mode">
                            <option value="always" <?php selected($notification['schedule_mode'], 'always'); ?>>Always inside start/end date</option>
                            <option value="daily" <?php selected($notification['schedule_mode'], 'daily'); ?>>Every day</option>
                            <option value="interval_days" <?php selected($notification['schedule_mode'], 'interval_days'); ?>>Every N days</option>
                            <option value="time_windows" <?php selected($notification['schedule_mode'], 'time_windows'); ?>>Specific time windows</option>
                        </select>
                        <p class="description">Start/end date still limits the full campaign. Use time windows for ads that should appear only at selected times.</p>
                    </td>
                </tr>
                <tr class="espander-interval-field">
                    <th scope="row"><label for="schedule_interval_days">Interval days</label></th>
                    <td><input name="schedule_interval_days" id="schedule_interval_days" type="number" min="1" value="<?php echo esc_attr((string) $notification['schedule_interval_days']); ?>"></td>
                </tr>
                <tr class="espander-window-field">
                    <th scope="row"><label for="schedule_time_windows">Time windows</label></th>
                    <td>
                        <textarea name="schedule_time_windows" id="schedule_time_windows" class="large-text code" rows="4" placeholder="09:00-10:00&#10;14:00-14:30&#10;20:00"><?php echo esc_textarea($time_windows_value); ?></textarea>
                        <p class="description">One per line or comma separated. Use HH:MM-HH:MM ranges, or HH:MM with the duration below.</p>
                    </td>
                </tr>
                <tr class="espander-window-field">
                    <th scope="row"><label for="schedule_window_minutes">Single-time duration</label></th>
                    <td><input name="schedule_window_minutes" id="schedule_window_minutes" type="number" min="1" value="<?php echo esc_attr((string) $notification['schedule_window_minutes']); ?>"> minutes</td>
                </tr>
                <tr>
                    <th scope="row"><label for="schedule_max_per_day">Daily display cap</label></th>
                    <td>
                        <input name="schedule_max_per_day" id="schedule_max_per_day" type="number" min="1" value="<?php echo esc_attr((string) $notification['schedule_max_per_day']); ?>" placeholder="No limit">
                        <p class="description">Optional. Example: set 3 if this notification should appear at most three times in one day.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="priority">Priority</label></th>
                    <td><input name="priority" id="priority" type="number" value="<?php echo esc_attr((string) $notification['priority']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row">Options</th>
                    <td>
                        <label><input name="active" type="checkbox" <?php checked($notification['active']); ?>> Active</label><br>
                        <label><input name="dismissible" type="checkbox" <?php checked($notification['dismissible']); ?>> Dismissible</label><br>
                        <label><input name="repeat_daily" type="checkbox" <?php checked($notification['repeat_daily']); ?>> Can reappear daily after dismiss</label>
                    </td>
                </tr>
            </table>

            <?php submit_button($editing ? 'Update Notification' : 'Create Notification'); ?>
        </form>
        <script>
            (function () {
                const contentType = document.getElementById('content_type');
                const title = document.getElementById('title');
                const message = document.getElementById('message');
                const html = document.getElementById('html_content');
                const scheduleMode = document.getElementById('schedule_mode');
                const topDisplayMode = document.getElementById('top_display_mode');
                const topVisibilityMode = document.getElementById('top_visibility_mode');

                function setRequired(element, enabled) {
                    if (!element) return;
                    if (enabled) {
                        element.setAttribute('required', 'required');
                    } else {
                        element.removeAttribute('required');
                    }
                }

                function syncMode() {
                    const htmlMode = contentType && contentType.value === 'html';
                    document.querySelectorAll('.espander-plain-field').forEach((row) => {
                        row.style.display = htmlMode ? 'none' : '';
                    });
                    document.querySelectorAll('.espander-html-field').forEach((row) => {
                        row.style.display = htmlMode ? '' : 'none';
                    });
                    setRequired(title, true);
                    setRequired(message, !htmlMode);
                    setRequired(html, htmlMode);
                }

                function syncScheduleMode() {
                    const mode = scheduleMode ? scheduleMode.value : 'always';
                    document.querySelectorAll('.espander-interval-field').forEach((row) => {
                        row.style.display = mode === 'interval_days' ? '' : 'none';
                    });
                    document.querySelectorAll('.espander-window-field').forEach((row) => {
                        row.style.display = mode === 'time_windows' ? '' : 'none';
                    });
                }

                function syncTopDisplayMode() {
                    const excerptMode = topDisplayMode && topDisplayMode.value === 'excerpt';
                    document.querySelectorAll('.espander-excerpt-field').forEach((row) => {
                        row.style.display = excerptMode ? '' : 'none';
                    });
                }

                function syncTopVisibilityMode() {
                    const globalMode = topVisibilityMode && topVisibilityMode.value === 'global';
                    document.querySelectorAll('.espander-top-views-field').forEach((row) => {
                        row.style.display = globalMode ? 'none' : '';
                    });
                }

                function bindColorPicker(pickerId, inputId) {
                    const picker = document.getElementById(pickerId);
                    const input = document.getElementById(inputId);
                    if (!picker || !input) return;
                    picker.addEventListener('input', () => {
                        input.value = picker.value;
                    });
                }

                if (contentType) {
                    contentType.addEventListener('change', syncMode);
                    syncMode();
                }
                if (scheduleMode) {
                    scheduleMode.addEventListener('change', syncScheduleMode);
                    syncScheduleMode();
                }
                if (topDisplayMode) {
                    topDisplayMode.addEventListener('change', syncTopDisplayMode);
                    syncTopDisplayMode();
                }
                if (topVisibilityMode) {
                    topVisibilityMode.addEventListener('change', syncTopVisibilityMode);
                    syncTopVisibilityMode();
                }
                bindColorPicker('background_color_picker', 'background_color');
                bindColorPicker('text_color_picker', 'text_color');
            })();
        </script>
    </div>
    <?php
}

function espander_render_tools_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $tools = espander_tools_sort(espander_tools_get_all());
    ?>
    <div class="wrap">
        <h1 class="wp-heading-inline">More Tools</h1>
        <a href="<?php echo esc_url(admin_url('admin.php?page=espander-add-tool')); ?>" class="page-title-action">Add New</a>
        <?php espander_admin_notice_messages(); ?>

        <table class="widefat striped" style="margin-top: 16px;">
            <thead>
                <tr>
                    <th>Tool</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Order</th>
                    <th>URL</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($tools)) : ?>
                    <tr><td colspan="6">No tools created yet.</td></tr>
                <?php else : ?>
                    <?php foreach ($tools as $tool) : ?>
                        <?php
                        $is_active = !empty($tool['active']);
                        $toggle_url = wp_nonce_url(
                            admin_url('admin-post.php?action=espander_toggle_tool&id=' . urlencode($tool['id']) . '&next=' . ($is_active ? '0' : '1')),
                            'espander_toggle_tool'
                        );
                        ?>
                        <tr>
                            <td>
                                <strong><?php echo esc_html($tool['name'] ?? ''); ?></strong>
                                <br><span class="espander-muted"><?php echo esc_html(wp_trim_words($tool['short_description'] ?? '', 18)); ?></span>
                            </td>
                            <td><?php echo esc_html($tool['version'] ?? ''); ?></td>
                            <td>
                                <span class="espander-status <?php echo $is_active ? 'espander-status-active' : 'espander-status-inactive'; ?>">
                                    <span class="espander-dot"></span><?php echo $is_active ? 'Active' : 'Inactive'; ?>
                                </span>
                            </td>
                            <td><?php echo esc_html((string) ($tool['sort_order'] ?? 0)); ?></td>
                            <td><code><?php echo esc_html($tool['button_url'] ?? ''); ?></code></td>
                            <td class="espander-table-actions">
                                <a href="<?php echo esc_url(admin_url('admin.php?page=espander-add-tool&edit=' . urlencode($tool['id']))); ?>">Edit</a>
                                <a href="<?php echo esc_url($toggle_url); ?>"><?php echo $is_active ? 'Deactivate' : 'Activate'; ?></a>
                                <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=espander_delete_tool&id=' . urlencode($tool['id'])), 'espander_delete_tool')); ?>" onclick="return confirm('Delete this tool?');">Delete</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
    <?php
}

function espander_render_tool_form_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $edit_id = isset($_GET['edit']) ? sanitize_key(wp_unslash($_GET['edit'])) : '';
    $editing = $edit_id ? espander_tools_find($edit_id) : null;
    $tool = array_merge(espander_tools_defaults(), is_array($editing) ? $editing : []);
    ?>
    <div class="wrap">
        <h1><?php echo $editing ? 'Edit Tool' : 'Add Tool'; ?></h1>
        <?php espander_admin_notice_messages(); ?>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="espander-panel">
            <input type="hidden" name="action" value="espander_save_tool">
            <input type="hidden" name="id" value="<?php echo esc_attr($tool['id']); ?>">
            <?php wp_nonce_field('espander_save_tool'); ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="name">Tool name</label></th>
                    <td><input name="name" id="name" type="text" class="regular-text" required value="<?php echo esc_attr($tool['name']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="version">Version</label></th>
                    <td><input name="version" id="version" type="text" class="regular-text" placeholder="1.0.0" value="<?php echo esc_attr($tool['version']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="image_url">Image URL</label></th>
                    <td><input name="image_url" id="image_url" type="url" class="large-text" placeholder="https://example.com/tool.png" value="<?php echo esc_attr($tool['image_url']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="short_description">Short description</label></th>
                    <td><textarea name="short_description" id="short_description" class="large-text" rows="4" required><?php echo esc_textarea($tool['short_description']); ?></textarea></td>
                </tr>
                <tr>
                    <th scope="row"><label for="button_label">Button</label></th>
                    <td>
                        <input name="button_label" id="button_label" type="text" class="regular-text" value="<?php echo esc_attr($tool['button_label']); ?>" placeholder="Open">
                        <input name="button_url" id="button_url" type="url" class="regular-text" required value="<?php echo esc_attr($tool['button_url']); ?>" placeholder="https://example.com">
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="sort_order">Sort order</label></th>
                    <td><input name="sort_order" id="sort_order" type="number" value="<?php echo esc_attr((string) $tool['sort_order']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row">Options</th>
                    <td><label><input name="active" type="checkbox" <?php checked($tool['active']); ?>> Active</label></td>
                </tr>
            </table>

            <?php submit_button($editing ? 'Update Tool' : 'Create Tool'); ?>
        </form>
    </div>
    <?php
}

function espander_render_global_text_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $texts = espander_global_texts_get();
    ?>
    <div class="wrap">
        <h1>Global Text</h1>
        <?php espander_admin_notice_messages(); ?>
        <p>Endpoint: <code><?php echo esc_html(rest_url('espander/v1/global-texts')); ?></code></p>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="espander-panel">
            <input type="hidden" name="action" value="espander_save_global_texts">
            <?php wp_nonce_field('espander_save_global_texts'); ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="more_tools_title">More Tools title</label></th>
                    <td><input name="more_tools_title" id="more_tools_title" type="text" class="regular-text" value="<?php echo esc_attr($texts['more_tools_title']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="more_tools_subtitle">More Tools subtitle</label></th>
                    <td><input name="more_tools_subtitle" id="more_tools_subtitle" type="text" class="large-text" value="<?php echo esc_attr($texts['more_tools_subtitle']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="notifications_title">Notifications title</label></th>
                    <td><input name="notifications_title" id="notifications_title" type="text" class="regular-text" value="<?php echo esc_attr($texts['notifications_title']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="notifications_subtitle">Notifications subtitle</label></th>
                    <td><input name="notifications_subtitle" id="notifications_subtitle" type="text" class="large-text" value="<?php echo esc_attr($texts['notifications_subtitle']); ?>"></td>
                </tr>
            </table>

            <?php submit_button('Save Global Text'); ?>
        </form>
    </div>
    <?php
}

function espander_render_update_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $update = espander_update_get();
    ?>
    <div class="wrap">
        <h1>Application Update</h1>
        <?php espander_admin_notice_messages(); ?>
        <p>Endpoint: <code><?php echo esc_html(rest_url('espander/v1/update')); ?></code></p>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="espander-panel">
            <input type="hidden" name="action" value="espander_save_update">
            <?php wp_nonce_field('espander_save_update'); ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">Status</th>
                    <td><label><input name="update_active" type="checkbox" <?php checked($update['active']); ?>> Publish this update to Espander users</label></td>
                </tr>
                <tr>
                    <th scope="row"><label for="version">Latest version</label></th>
                    <td><input name="version" id="version" type="text" class="regular-text" placeholder="0.2.0" value="<?php echo esc_attr($update['version']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="release_date">Release date</label></th>
                    <td><input name="release_date" id="release_date" type="date" value="<?php echo esc_attr($update['release_date']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="release_notes">Release notes</label></th>
                    <td><textarea name="release_notes" id="release_notes" class="large-text" rows="6"><?php echo esc_textarea($update['release_notes']); ?></textarea></td>
                </tr>
                <tr>
                    <th scope="row"><label for="download_url">Default download URL</label></th>
                    <td><input name="download_url" id="download_url" type="url" class="large-text" placeholder="https://ashikhosen.com/downloads/espander.dmg" value="<?php echo esc_attr($update['download_url']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="macos_download_url">macOS URL</label></th>
                    <td><input name="macos_download_url" id="macos_download_url" type="url" class="large-text" value="<?php echo esc_attr($update['macos_download_url']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="windows_download_url">Windows URL</label></th>
                    <td><input name="windows_download_url" id="windows_download_url" type="url" class="large-text" value="<?php echo esc_attr($update['windows_download_url']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="github_releases_url">Manual download page</label></th>
                    <td><input name="github_releases_url" id="github_releases_url" type="url" class="large-text" placeholder="https://github.com/ashikhosenpro/Expander/releases/latest" value="<?php echo esc_attr($update['github_releases_url']); ?>"></td>
                </tr>
            </table>

            <?php submit_button('Save Update Metadata'); ?>
        </form>
    </div>
    <?php
}

function espander_render_about_page() {
    espander_render_content_editor_page('about', 'About Page', 'HTML and CSS are rendered inside an isolated container in Espander Settings -> About.');
}

function espander_render_documentation_page() {
    espander_render_content_editor_page('docs', 'Documentation', 'HTML and CSS are rendered inside an isolated container in Espander Settings -> Documentation.');
}

function espander_render_footer_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $content = espander_content_get();
    $defaults = espander_content_default()['footer'];
    $footer = array_merge($defaults, is_array($content['footer'] ?? null) ? $content['footer'] : []);
    ?>
    <div class="wrap">
        <h1>Footer Settings</h1>
        <?php espander_admin_notice_messages(); ?>
        <p>Endpoint: <code><?php echo esc_html(rest_url('espander/v1/content/footer')); ?></code></p>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="espander-panel">
            <input type="hidden" name="action" value="espander_save_content">
            <input type="hidden" name="slug" value="footer">
            <?php wp_nonce_field('espander_save_content'); ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="left_text">Left text</label></th>
                    <td><input name="left_text" id="left_text" type="text" class="large-text" value="<?php echo esc_attr($footer['left_text']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="link_label">Right link label</label></th>
                    <td><input name="link_label" id="link_label" type="text" class="regular-text" value="<?php echo esc_attr($footer['link_label']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="link_url">Right link URL</label></th>
                    <td><input name="link_url" id="link_url" type="url" class="large-text" value="<?php echo esc_attr($footer['link_url']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row">Icon</th>
                    <td><label><input name="show_github_icon" type="checkbox" <?php checked($footer['show_github_icon']); ?>> Show GitHub icon beside the footer link</label></td>
                </tr>
            </table>

            <?php submit_button('Save Footer Settings'); ?>
        </form>
    </div>
    <?php
}

function espander_render_content_editor_page($slug, $title, $description) {
    if (!current_user_can('manage_options')) {
        return;
    }

    $content = espander_content_get();
    ?>
    <div class="wrap">
        <h1><?php echo esc_html($title); ?></h1>
        <?php espander_admin_notice_messages(); ?>
        <p><?php echo esc_html($description); ?></p>
        <p>Endpoint: <code><?php echo esc_html(rest_url('espander/v1/content/' . $slug)); ?></code></p>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="espander-panel espander-panel-wide">
            <input type="hidden" name="action" value="espander_save_content">
            <input type="hidden" name="slug" value="<?php echo esc_attr($slug); ?>">
            <?php wp_nonce_field('espander_save_content'); ?>

            <textarea name="html" class="large-text code" rows="22"><?php echo esc_textarea($content[$slug] ?? ''); ?></textarea>
            <?php submit_button('Save ' . $title); ?>
        </form>
    </div>
    <?php
}
