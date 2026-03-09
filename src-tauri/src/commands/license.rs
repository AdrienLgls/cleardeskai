use crate::db;

const FREE_SCAN_LIMIT: usize = 50;
const FREE_FOLDER_LIMIT: usize = 1;

#[derive(serde::Serialize)]
pub struct LicenseInfo {
    pub tier: String,
    pub valid: bool,
    pub scan_limit: Option<usize>,
    pub folder_limit: Option<usize>,
}

#[tauri::command]
pub async fn get_license_info() -> Result<LicenseInfo, String> {
    let key = db::get_setting("license_key").map_err(|e| e.to_string())?;

    match key {
        Some(k) if validate_key(&k) == "pro" => Ok(LicenseInfo {
            tier: "pro".to_string(),
            valid: true,
            scan_limit: None,
            folder_limit: None,
        }),
        Some(k) if validate_key(&k) == "premium" => Ok(LicenseInfo {
            tier: "premium".to_string(),
            valid: true,
            scan_limit: None,
            folder_limit: None,
        }),
        _ => Ok(LicenseInfo {
            tier: "free".to_string(),
            valid: true,
            scan_limit: Some(FREE_SCAN_LIMIT),
            folder_limit: Some(FREE_FOLDER_LIMIT),
        }),
    }
}

#[tauri::command]
pub async fn activate_license(key: String) -> Result<LicenseInfo, String> {
    let tier = validate_key(&key);
    if tier == "invalid" {
        return Err("Invalid license key".to_string());
    }

    db::set_setting("license_key", &key).map_err(|e| e.to_string())?;

    Ok(LicenseInfo {
        tier: tier.to_string(),
        valid: true,
        scan_limit: None,
        folder_limit: None,
    })
}

#[tauri::command]
pub async fn deactivate_license() -> Result<(), String> {
    db::delete_setting("license_key").map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_file_limit() -> Option<usize> {
    let key = db::get_setting("license_key").ok().flatten();
    match key {
        Some(k) if validate_key(&k) == "pro" || validate_key(&k) == "premium" => None,
        _ => Some(FREE_SCAN_LIMIT),
    }
}

fn validate_key(key: &str) -> &str {
    // Key format: CDAI-PRO-XXXX-XXXX-XXXX or CDAI-PREM-XXXX-XXXX-XXXX
    // This is a simple local validation. In production, validate against Keygen.sh API.
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() != 5 || parts[0] != "CDAI" {
        return "invalid";
    }

    match parts[1] {
        "PRO" => {
            if parts[2..].iter().all(|p| p.len() == 4 && p.chars().all(|c| c.is_ascii_alphanumeric())) {
                "pro"
            } else {
                "invalid"
            }
        }
        "PREM" => {
            if parts[2..].iter().all(|p| p.len() == 4 && p.chars().all(|c| c.is_ascii_alphanumeric())) {
                "premium"
            } else {
                "invalid"
            }
        }
        _ => "invalid",
    }
}
