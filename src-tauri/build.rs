fn main() {
    load_private_build_env();
    tauri_build::build()
}

fn load_private_build_env() {
    for key in [
        "ESPANDER_NOTIFICATIONS_URL",
        "ESPANDER_UPDATES_URL",
        "ESPANDER_CONTENT_URL",
    ] {
        if let Some(value) = std::env::var(key)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| read_env_file_value(key))
        {
            println!("cargo:rustc-env={}={}", key, value.trim());
        }
    }

    println!("cargo:rerun-if-env-changed=ESPANDER_NOTIFICATIONS_URL");
    println!("cargo:rerun-if-env-changed=ESPANDER_UPDATES_URL");
    println!("cargo:rerun-if-env-changed=ESPANDER_CONTENT_URL");
    println!("cargo:rerun-if-changed=../.env.local");
    println!("cargo:rerun-if-changed=../.env");
}

fn read_env_file_value(key: &str) -> Option<String> {
    for path in ["../.env.local", "../.env"] {
        let Ok(contents) = std::fs::read_to_string(path) else {
            continue;
        };

        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            let Some((name, value)) = line.split_once('=') else {
                continue;
            };

            if name.trim() == key {
                return Some(
                    value
                        .trim()
                        .trim_matches('"')
                        .trim_matches('\'')
                        .to_string(),
                );
            }
        }
    }

    None
}
