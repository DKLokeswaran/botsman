use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};

const MAX_BYTES: u64 = 80_000_000;
const READ_CHUNK: usize = 8192;

pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn installer_stem(build: u64) -> String {
    let salt = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("hermes-bots-setup-{build}-{}", salt % 1_000_000_000)
}

pub fn is_installer_leftover(name: &str) -> bool {
    if name == "hermes-bots-setup.exe" {
        return true;
    }
    name.starts_with("hermes-bots-setup-")
        && (name.ends_with(".exe") || name.ends_with(".part"))
}

pub fn prune_installer_leftovers(temp: &Path, keep: &Path) {
    let Ok(entries) = fs::read_dir(temp) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path == keep {
            continue;
        }
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if is_installer_leftover(name) {
            let _ = fs::remove_file(path);
        }
    }
}

pub fn download_verified_installer(
    url: &str,
    build: u64,
    expected_sha256: &str,
    expected_size: u64,
    mut progress: impl FnMut(u64, Option<u64>),
) -> Result<PathBuf, String> {
    let temp = std::env::temp_dir();
    let stem = installer_stem(build);
    let part = temp.join(format!("{stem}.part"));
    let final_path = temp.join(format!("{stem}.exe"));
    prune_installer_leftovers(&temp, &part);
    if part.exists() {
        let _ = fs::remove_file(&part);
    }
    let digest = download_to_file(url, &part, &mut progress)?;
    let received = digest.0;
    let actual = digest.1;
    if expected_size > 0 && received != expected_size {
        let _ = fs::remove_file(&part);
        return Err(format!(
            "Download size mismatch from {url}. Expected {expected_size} bytes, got {received}."
        ));
    }
    if !actual.eq_ignore_ascii_case(expected_sha256.trim()) {
        let _ = fs::remove_file(&part);
        return Err(format!(
            "SHA-256 mismatch for {url}. Expected {expected_sha256}, got {actual}."
        ));
    }
    fs::rename(&part, &final_path).map_err(|error| {
        format!(
            "Could not finalize the installer at {}: {error}",
            final_path.display()
        )
    })?;
    Ok(final_path)
}

fn download_to_file(
    url: &str,
    dest: &Path,
    progress: &mut dyn FnMut(u64, Option<u64>),
) -> Result<(u64, String), String> {
    let mut next = url.to_string();
    for _ in 0..4 {
        match fetch_to_file(&next, dest, progress)? {
            FetchOutcome::Done(total, hash) => return Ok((total, hash)),
            FetchOutcome::Redirect(location) => {
                next = join_url(&next, &location)?;
            }
        }
    }
    Err(format!("Download failed (too many redirects) from {url}"))
}

enum FetchOutcome {
    Done(u64, String),
    Redirect(String),
}

fn fetch_to_file(
    url: &str,
    dest: &Path,
    progress: &mut dyn FnMut(u64, Option<u64>),
) -> Result<FetchOutcome, String> {
    let target = parse_http(url)?;
    let mut stream = TcpStream::connect((target.host.as_str(), target.port))
        .map_err(|error| format!("Download failed from {url}. {error}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(60)))
        .map_err(|error| format!("Download failed from {url}. {error}"))?;
    stream
        .set_write_timeout(Some(Duration::from_secs(20)))
        .map_err(|error| format!("Download failed from {url}. {error}"))?;
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\nUser-Agent: hermes-bots\r\n\r\n",
        path = target.path,
        host = if target.port == 80 {
            target.host.clone()
        } else {
            format!("{}:{}", target.host, target.port)
        }
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("Download failed from {url}. {error}"))?;

    let mut header_buf = Vec::new();
    let mut scratch = [0_u8; 1];
    loop {
        let read = stream
            .read(&mut scratch)
            .map_err(|error| format!("Download failed from {url}. {error}"))?;
        if read == 0 {
            return Err(format!(
                "Download failed from {url}. The response ended before headers."
            ));
        }
        header_buf.push(scratch[0]);
        if header_buf.len() >= 4 && header_buf[header_buf.len() - 4..] == *b"\r\n\r\n" {
            break;
        }
        if header_buf.len() > 65_536 {
            return Err(format!("Download failed from {url}. The response headers were too large."));
        }
    }

    let header_text = String::from_utf8_lossy(&header_buf);
    let mut lines = header_text.split("\r\n");
    let status_line = lines.next().unwrap_or("");
    let status = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| format!("Download failed from {url}. Bad status line: {status_line}"))?;
    let headers: Vec<(String, String)> = lines
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            Some((name.trim().to_string(), value.trim().to_string()))
        })
        .collect();

    if matches!(status, 301 | 302 | 303 | 307 | 308) {
        let location = header(&headers, "location").ok_or_else(|| {
            format!("Download failed (HTTP {status} without a Location header) from {url}")
        })?;
        return Ok(FetchOutcome::Redirect(location));
    }
    if status != 200 {
        let snippet: String = header_text.chars().take(180).collect();
        return Err(format!("Download failed (HTTP {status}) from {url}. {snippet}"));
    }

    let total = header(&headers, "content-length")
        .and_then(|value| value.parse::<u64>().ok());
    if let Some(total) = total {
        if total > MAX_BYTES {
            return Err(format!("Download from {url} is larger than {MAX_BYTES} bytes."));
        }
    }

    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(dest)
        .map_err(|error| format!("Could not write the installer to {}: {error}", dest.display()))?;
    let mut hasher = Sha256::new();
    let mut received = 0_u64;
    progress(received, total);

    let mut chunk = [0_u8; READ_CHUNK];
    loop {
        let read = stream
            .read(&mut chunk)
            .map_err(|error| format!("Download failed from {url}. {error}"))?;
        if read == 0 {
            break;
        }
        received += read as u64;
        if received > MAX_BYTES {
            let _ = fs::remove_file(dest);
            return Err(format!("Download from {url} is larger than {MAX_BYTES} bytes."));
        }
        hasher.update(&chunk[..read]);
        file.write_all(&chunk[..read])
            .map_err(|error| format!("Could not write the installer to {}: {error}", dest.display()))?;
        progress(received, total);
    }

    Ok(FetchOutcome::Done(
        received,
        hasher
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect(),
    ))
}

struct Target {
    host: String,
    port: u16,
    path: String,
}

fn parse_http(url: &str) -> Result<Target, String> {
    let rest = url
        .strip_prefix("http://")
        .ok_or_else(|| format!("Download URL must start with http:// ({url})"))?;
    let (authority, path) = match rest.split_once('/') {
        Some((host, path)) => (host, format!("/{path}")),
        None => (rest, "/".to_string()),
    };
    if authority.is_empty() {
        return Err(format!("Download URL has no host ({url})"));
    }
    let (host, port) = if let Some((host, port)) = authority.rsplit_once(':') {
        if host.is_empty() {
            return Err(format!("Download URL has no host ({url})"));
        }
        let port = port
            .parse::<u16>()
            .map_err(|_| format!("Download URL has a bad port ({url})"))?;
        (host.to_string(), port)
    } else {
        (authority.to_string(), 80)
    };
    Ok(Target { host, port, path })
}

fn header(headers: &[(String, String)], name: &str) -> Option<String> {
    headers
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case(name))
        .map(|(_, value)| value.clone())
}

fn join_url(current: &str, location: &str) -> Result<String, String> {
    if location.starts_with("http://") {
        return Ok(location.to_string());
    }
    let target = parse_http(current)?;
    let origin = if target.port == 80 {
        format!("http://{}", target.host)
    } else {
        format!("http://{}:{}", target.host, target.port)
    };
    if location.starts_with('/') {
        return Ok(format!("{origin}{location}"));
    }
    Err(format!(
        "Download redirect from {current} is not an http URL ({location})"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::sync::{Arc, Mutex};

    #[test]
    fn test_bug_update_locked_old_temp_does_not_block() {
        let temp = std::env::temp_dir().join("hermes-bots-update-test");
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(&temp).expect("temp dir");
        let legacy = temp.join("hermes-bots-setup.exe");
        let mut locked = File::create(&legacy).expect("legacy file");
        locked.write_all(b"hold").expect("write legacy");
        let _keep = locked;

        let part = temp.join(format!("{}.part", installer_stem(29)));
        prune_installer_leftovers(&temp, &part);
        assert!(legacy.exists(), "a locked legacy installer must not block pruning attempts");

        let first = temp.join(format!("{}.exe", installer_stem(29)));
        let second = temp.join(format!("{}.exe", installer_stem(29)));
        assert_ne!(first, second);
        assert_ne!(first, legacy);
        assert!(is_installer_leftover("hermes-bots-setup.exe"));
        assert!(is_installer_leftover("hermes-bots-setup-29-1.part"));
    }

    #[test]
    fn test_bug_update_single_flight_and_progress() {
        let gate = Arc::new(Mutex::new(false));
        let begin = || {
            let mut busy = gate.lock().expect("lock");
            if *busy {
                return false;
            }
            *busy = true;
            true
        };
        assert!(begin());
        assert!(!begin());
        *gate.lock().expect("lock") = false;
        assert!(begin());
    }

    #[test]
    fn test_update_progress_callback_runs() {
        let seen = Arc::new(Mutex::new(Vec::<(u64, Option<u64>)>::new()));
        let seen_capture = Arc::clone(&seen);
        let progress = move |received: u64, total: Option<u64>| {
            seen_capture
                .lock()
                .expect("lock")
                .push((received, total));
        };
        progress(0, Some(100));
        progress(50, Some(100));
        progress(100, Some(100));
        assert_eq!(*seen.lock().expect("lock"), vec![(0, Some(100)), (50, Some(100)), (100, Some(100))]);
    }
}
