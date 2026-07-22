<?php
if (!defined('ABSPATH')) { exit; }

function espander_github_oauth_get() {
    $value = get_option(ESPANDER_GITHUB_OAUTH_OPTION, []);
    return array_merge(['client_id' => '', 'client_secret' => '', 'enabled' => false], is_array($value) ? $value : []);
}

function espander_github_oauth_save() {
    if (!current_user_can('manage_options')) { wp_die('Permission denied.'); }
    check_admin_referer('espander_save_github_oauth');
    $old = espander_github_oauth_get();
    $secret = trim((string) wp_unslash($_POST['client_secret'] ?? ''));
    update_option(ESPANDER_GITHUB_OAUTH_OPTION, [
        'client_id' => sanitize_text_field(wp_unslash($_POST['client_id'] ?? '')),
        'client_secret' => $secret !== '' ? $secret : $old['client_secret'],
        'enabled' => isset($_POST['enabled']),
    ], false);
    wp_safe_redirect(admin_url('admin.php?page=espander-github-oauth&updated=1'));
    exit;
}

function espander_render_github_oauth_page() {
    if (!current_user_can('manage_options')) { return; }
    $s = espander_github_oauth_get();
    $active = $s['enabled'] && $s['client_id'] !== '' && $s['client_secret'] !== '';
    $application_name = 'Espander';
    $homepage_url = home_url('/');
    $application_description = 'Connect Espander to GitHub to securely synchronize Espanso snippets across devices.';
    $callback_url = rest_url('espander/v1/github/oauth/callback');
    ?>
    <div class="wrap espander-oauth-page"><h1>GitHub OAuth</h1>
      <?php if (isset($_GET['updated'])) : ?><div class="notice notice-success is-dismissible"><p>GitHub OAuth settings saved.</p></div><?php endif; ?>
      <div class="espander-panel">
        <p><span class="espander-status <?php echo $active ? 'espander-status-active' : 'espander-status-inactive'; ?>"><span class="espander-dot"></span><?php echo $active ? 'Configured and enabled' : 'Not active'; ?></span></p>
        <p>Installed Espander apps read this configuration at connection time. Changing it does not require a new app build.</p>
      </div>

      <div class="espander-panel espander-oauth-guide">
        <h2>1. Register the GitHub OAuth App</h2>
        <p>Open GitHub’s OAuth App form and enter the values below exactly as shown.</p>
        <p><a class="button button-secondary" href="https://github.com/settings/applications/new" target="_blank" rel="noopener noreferrer">Open GitHub OAuth App Registration ↗</a></p>
        <?php
        $registration_values = [
            ['Application name', $application_name],
            ['Homepage URL', $homepage_url],
            ['Application description', $application_description],
            ['Authorization callback URL', $callback_url],
        ];
        foreach ($registration_values as $index => $registration_value) :
            $field_id = 'espander-oauth-copy-' . $index;
        ?>
          <div class="espander-oauth-copy-row">
            <label for="<?php echo esc_attr($field_id); ?>"><?php echo esc_html($registration_value[0]); ?></label>
            <div class="espander-oauth-copy-control">
              <input id="<?php echo esc_attr($field_id); ?>" class="large-text code" readonly value="<?php echo esc_attr($registration_value[1]); ?>">
              <button type="button" class="button espander-copy-button" data-copy-target="<?php echo esc_attr($field_id); ?>">Copy</button>
            </div>
          </div>
        <?php endforeach; ?>
        <div class="notice notice-info inline"><p><strong>Enable Device Flow:</strong> Leave this unchecked. Espander uses the browser OAuth callback flow through this WordPress site.</p></div>
      </div>

      <div class="espander-panel">
        <h2>2. Add the GitHub credentials</h2>
        <p>After registering the OAuth App, copy its Client ID and generate a Client Secret. Paste both below.</p>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
          <input type="hidden" name="action" value="espander_save_github_oauth"><?php wp_nonce_field('espander_save_github_oauth'); ?>
          <table class="form-table"><tbody>
            <tr><th><label for="client_id">Client ID</label></th><td><input class="regular-text" id="client_id" name="client_id" required value="<?php echo esc_attr($s['client_id']); ?>"></td></tr>
            <tr><th><label for="client_secret">Client Secret</label></th><td><input class="regular-text" id="client_secret" name="client_secret" type="password" autocomplete="new-password" placeholder="<?php echo $s['client_secret'] ? 'Saved — leave blank to keep it' : 'Enter client secret'; ?>"><p class="description">The saved value is never displayed again.</p></td></tr>
            <tr><th>Availability</th><td><label><input type="checkbox" name="enabled" <?php checked($s['enabled']); ?>> Enable GitHub connections</label></td></tr>
          </tbody></table><?php submit_button('Save GitHub OAuth Settings'); ?>
        </form>
      </div>
      <div class="espander-panel"><h2>3. Test in Espander</h2><p>Open Espander → Settings → GitHub, click <strong>Connect to GitHub</strong>, authorize in the browser, then select a repository. Future Client ID or Client Secret changes can be saved here without rebuilding the desktop app; affected users will only need to reconnect.</p></div>
    </div>
    <style>
      .espander-oauth-page .espander-panel { margin-top: 16px; }
      .espander-oauth-page h2 { margin-top: 0; }
      .espander-oauth-copy-row { margin: 16px 0; }
      .espander-oauth-copy-row > label { display: block; font-weight: 600; margin-bottom: 6px; }
      .espander-oauth-copy-control { display: flex; gap: 8px; align-items: center; }
      .espander-oauth-copy-control input { flex: 1; min-width: 0; }
      .espander-oauth-copy-control .button { min-width: 72px; }
      .espander-oauth-guide .notice { margin: 18px 0 0; }
    </style>
    <script>
      document.addEventListener('click', async function (event) {
        const button = event.target.closest('.espander-copy-button');
        if (!button) return;
        const input = document.getElementById(button.dataset.copyTarget);
        if (!input) return;
        try {
          await navigator.clipboard.writeText(input.value);
        } catch (error) {
          input.select();
          document.execCommand('copy');
        }
        const oldLabel = button.textContent;
        button.textContent = 'Copied!';
        window.setTimeout(function () { button.textContent = oldLabel; }, 1400);
      });
    </script>
    <?php
}

function espander_github_oauth_start() {
    $s = espander_github_oauth_get();
    if (!$s['enabled'] || !$s['client_id'] || !$s['client_secret']) {
        return new WP_Error('oauth_unavailable', 'GitHub connection is temporarily unavailable.', ['status' => 503]);
    }
    $id = wp_generate_password(32, false, false);
    $poll = wp_generate_password(48, false, false);
    $state = wp_generate_password(48, false, false);
    set_transient('espander_gh_session_' . hash('sha256', $id), ['poll_hash' => hash('sha256', $poll), 'status' => 'pending'], 15 * MINUTE_IN_SECONDS);
    set_transient('espander_gh_state_' . hash('sha256', $state), $id, 15 * MINUTE_IN_SECONDS);
    $url = add_query_arg(['client_id' => $s['client_id'], 'redirect_uri' => rest_url('espander/v1/github/oauth/callback'), 'scope' => 'repo', 'state' => $state], 'https://github.com/login/oauth/authorize');
    return rest_ensure_response(['device_code' => $id . '.' . $poll, 'user_code' => '', 'verification_uri' => $url, 'interval' => 3]);
}

function espander_github_oauth_callback(WP_REST_Request $request) {
    $state = sanitize_text_field((string) $request->get_param('state'));
    $id = $state ? get_transient('espander_gh_state_' . hash('sha256', $state)) : false;
    if (!$id) { wp_die('Authorization expired. Return to Espander and try again.', 'Espander authorization', ['response' => 400]); }
    delete_transient('espander_gh_state_' . hash('sha256', $state));
    $key = 'espander_gh_session_' . hash('sha256', $id);
    $session = get_transient($key);
    $code = sanitize_text_field((string) $request->get_param('code'));
    if (!is_array($session) || !$code) {
        if (is_array($session)) { $session['status'] = 'error'; $session['error'] = 'Authorization was cancelled.'; set_transient($key, $session, 10 * MINUTE_IN_SECONDS); }
        wp_die('Authorization was not completed. You may close this tab.', 'Espander authorization', ['response' => 400]);
    }
    $s = espander_github_oauth_get();
    $response = wp_remote_post('https://github.com/login/oauth/access_token', ['timeout' => 20, 'headers' => ['Accept' => 'application/json', 'User-Agent' => 'Espander-Control-Hub'], 'body' => ['client_id' => $s['client_id'], 'client_secret' => $s['client_secret'], 'code' => $code, 'redirect_uri' => rest_url('espander/v1/github/oauth/callback')]]);
    $body = is_wp_error($response) ? [] : json_decode(wp_remote_retrieve_body($response), true);
    if (empty($body['access_token'])) { $session['status'] = 'error'; $session['error'] = sanitize_text_field($body['error_description'] ?? 'GitHub token exchange failed.'); }
    else { $session['status'] = 'complete'; $session['access_token'] = sanitize_text_field($body['access_token']); }
    set_transient($key, $session, 10 * MINUTE_IN_SECONDS);
    if ($session['status'] !== 'complete') { wp_die('GitHub could not complete the connection. You may close this tab.', 'Espander connection failed', ['response' => 400]); }
    wp_die('<p>Your GitHub account is connected to Espander.</p><p>You can close this tab and return to the app.</p>', 'Espander connected', ['response' => 200]);
}

function espander_github_oauth_status(WP_REST_Request $request) {
    $parts = explode('.', sanitize_text_field((string) $request->get_param('device_code')), 2);
    if (count($parts) !== 2) { return new WP_Error('invalid_session', 'Invalid authorization session.', ['status' => 400]); }
    [$id, $poll] = $parts;
    $key = 'espander_gh_session_' . hash('sha256', $id);
    $session = get_transient($key);
    if (!is_array($session) || !hash_equals((string) $session['poll_hash'], hash('sha256', $poll))) { return new WP_Error('expired_session', 'Authorization session expired.', ['status' => 410]); }
    if ($session['status'] === 'complete') { delete_transient($key); return rest_ensure_response(['success' => true, 'access_token' => $session['access_token'], 'error' => null]); }
    if ($session['status'] === 'error') { delete_transient($key); return rest_ensure_response(['success' => false, 'access_token' => null, 'error' => $session['error'] ?? 'Authorization failed.']); }
    return rest_ensure_response(['success' => false, 'access_token' => null, 'error' => 'authorization_pending']);
}
