use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

use sha2::{Digest, Sha256};

const MAX_BYTES: usize = 80_000_000;

pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn download(url: &str) -> Result<Vec<u8>, String> {
    let mut next = url.to_string();
    for _ in 0..4 {
        let (status, headers, body) = fetch_once(&next)?;
        if matches!(status, 301 | 302 | 303 | 307 | 308) {
            let location = header(&headers, "location").ok_or_else(|| {
                format!("Download failed (HTTP {status} without a Location header) from {next}")
            })?;
            next = join_url(&next, &location)?;
            continue;
        }
        if status != 200 {
            let snippet: String = String::from_utf8_lossy(&body).chars().take(180).collect();
            return Err(format!("Download failed (HTTP {status}) from {next}. {snippet}"));
        }
        return Ok(body);
    }
    Err(format!("Download failed (too many redirects) from {url}"))
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

fn fetch_once(url: &str) -> Result<(u16, Vec<(String, String)>, Vec<u8>), String> {
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
    let mut raw = Vec::new();
    stream
        .read_to_end(&mut raw)
        .map_err(|error| format!("Download failed from {url}. {error}"))?;
    let split = raw
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .ok_or_else(|| format!("Download failed from {url}. The response had no header."))?;
    let header_bytes = &raw[..split];
    let body = raw[split + 4..].to_vec();
    if body.len() > MAX_BYTES {
        return Err(format!("Download from {url} is larger than {MAX_BYTES} bytes."));
    }
    let header = String::from_utf8_lossy(header_bytes);
    let mut lines = header.split("\r\n");
    let status_line = lines.next().unwrap_or("");
    let status = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| format!("Download failed from {url}. Bad status line: {status_line}"))?;
    let headers = lines
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            Some((name.trim().to_string(), value.trim().to_string()))
        })
        .collect();
    Ok((status, headers, body))
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
    Err(format!("Download redirect from {current} is not an http URL ({location})"))
}
