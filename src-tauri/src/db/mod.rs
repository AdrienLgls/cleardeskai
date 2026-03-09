use rusqlite::{Connection, Result, params};
use std::path::Path;
use once_cell::sync::OnceCell;

static DB_PATH: OnceCell<String> = OnceCell::new();

fn get_connection() -> Result<Connection> {
    let path = DB_PATH.get().expect("DB not initialized");
    Connection::open(path)
}

pub fn init(path: &Path) -> Result<()> {
    DB_PATH.set(path.to_string_lossy().to_string()).ok();
    let conn = Connection::open(path)?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS operations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            description TEXT NOT NULL,
            undone INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS file_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation_id TEXT NOT NULL,
            source_path TEXT NOT NULL,
            dest_path TEXT NOT NULL,
            new_name TEXT,
            change_type TEXT NOT NULL,
            FOREIGN KEY (operation_id) REFERENCES operations(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS watched_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            interval_secs INTEGER NOT NULL DEFAULT 60,
            auto_mode INTEGER NOT NULL DEFAULT 0,
            last_scan TEXT
        );

        CREATE TABLE IF NOT EXISTS recent_folders (
            path TEXT PRIMARY KEY,
            last_used TEXT NOT NULL,
            scan_count INTEGER NOT NULL DEFAULT 1
        );"
    )?;
    Ok(())
}

pub fn save_operation(id: &str, timestamp: &str, description: &str, changes: &[(String, String, Option<String>, String)]) -> Result<()> {
    let conn = get_connection()?;
    conn.execute(
        "INSERT INTO operations (id, timestamp, description, undone) VALUES (?1, ?2, ?3, 0)",
        params![id, timestamp, description],
    )?;
    for (source, dest, new_name, change_type) in changes {
        conn.execute(
            "INSERT INTO file_changes (operation_id, source_path, dest_path, new_name, change_type) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, source, dest, new_name, change_type],
        )?;
    }
    Ok(())
}

pub fn get_operation_changes(operation_id: &str) -> Result<Vec<(String, String, Option<String>, String)>> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT source_path, dest_path, new_name, change_type FROM file_changes WHERE operation_id = ?1"
    )?;
    let changes = stmt.query_map(params![operation_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, String>(3)?,
        ))
    })?.collect::<Result<Vec<_>>>()?;
    Ok(changes)
}

pub fn mark_undone(operation_id: &str) -> Result<()> {
    let conn = get_connection()?;
    conn.execute("UPDATE operations SET undone = 1 WHERE id = ?1", params![operation_id])?;
    Ok(())
}

pub fn get_setting(key: &str) -> Result<Option<String>> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query_map(params![key], |row| row.get::<_, String>(0))?;
    match rows.next() {
        Some(Ok(val)) => Ok(Some(val)),
        _ => Ok(None),
    }
}

pub fn set_setting(key: &str, value: &str) -> Result<()> {
    let conn = get_connection()?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

pub fn delete_setting(key: &str) -> Result<()> {
    let conn = get_connection()?;
    conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
    Ok(())
}

// Watched folders
pub fn add_watched_folder(path: &str, interval_secs: u64) -> Result<()> {
    let conn = get_connection()?;
    conn.execute(
        "INSERT OR IGNORE INTO watched_folders (path, interval_secs) VALUES (?1, ?2)",
        params![path, interval_secs as i64],
    )?;
    Ok(())
}

pub fn remove_watched_folder(path: &str) -> Result<()> {
    let conn = get_connection()?;
    conn.execute("DELETE FROM watched_folders WHERE path = ?1", params![path])?;
    Ok(())
}

pub fn get_watched_folders() -> Result<Vec<(String, i64, bool)>> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT path, interval_secs, auto_mode FROM watched_folders"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, bool>(2)?,
        ))
    })?.collect::<Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn get_all_operations() -> Result<Vec<(String, String, String, bool)>> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT id, timestamp, description, undone FROM operations ORDER BY timestamp DESC"
    )?;
    let ops = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, bool>(3)?,
        ))
    })?.collect::<Result<Vec<_>>>()?;
    Ok(ops)
}

// Recent folders
pub fn add_recent_folder(path: &str) -> Result<()> {
    let conn = get_connection()?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO recent_folders (path, last_used, scan_count) VALUES (?1, ?2, 1)
         ON CONFLICT(path) DO UPDATE SET last_used = ?2, scan_count = scan_count + 1",
        params![path, now],
    )?;
    Ok(())
}

pub fn get_recent_folders(limit: usize) -> Result<Vec<(String, String, i64)>> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT path, last_used, scan_count FROM recent_folders ORDER BY last_used DESC LIMIT ?1"
    )?;
    let rows = stmt.query_map(params![limit as i64], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })?.collect::<Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn clear_history() -> Result<()> {
    let conn = get_connection()?;
    conn.execute_batch(
        "DELETE FROM file_changes;
         DELETE FROM operations;"
    )?;
    Ok(())
}
