//! A minimal ZIP writer: stored entries (no compression — PNG and JPEG are
//! already compressed), no ZIP64. Enough for a campaign download, with no
//! dependency beyond a CRC.

fn u16le(out: &mut Vec<u8>, v: u16) {
    out.extend_from_slice(&v.to_le_bytes());
}
fn u32le(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}

/// Build a ZIP of `(name, bytes)` entries. Names must be plain ASCII file
/// names; the caller guarantees that (campaign file names are checked).
pub fn store(files: &[(&str, &[u8])]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut central = Vec::new();
    // 1980-01-01 00:00 in DOS time — deterministic output.
    let (time, date) = (0u16, (1 << 5) | 1);
    for (name, data) in files {
        let crc = crc32fast::hash(data);
        let offset = out.len() as u32;
        let size = data.len() as u32;
        let name_len = name.len() as u16;

        u32le(&mut out, 0x0403_4b50);
        u16le(&mut out, 20); // version needed
        u16le(&mut out, 0); // flags
        u16le(&mut out, 0); // stored
        u16le(&mut out, time);
        u16le(&mut out, date);
        u32le(&mut out, crc);
        u32le(&mut out, size);
        u32le(&mut out, size);
        u16le(&mut out, name_len);
        u16le(&mut out, 0);
        out.extend_from_slice(name.as_bytes());
        out.extend_from_slice(data);

        u32le(&mut central, 0x0201_4b50);
        u16le(&mut central, 20); // made by
        u16le(&mut central, 20); // needed
        u16le(&mut central, 0);
        u16le(&mut central, 0);
        u16le(&mut central, time);
        u16le(&mut central, date);
        u32le(&mut central, crc);
        u32le(&mut central, size);
        u32le(&mut central, size);
        u16le(&mut central, name_len);
        u16le(&mut central, 0); // extra
        u16le(&mut central, 0); // comment
        u16le(&mut central, 0); // disk
        u16le(&mut central, 0); // internal attrs
        u32le(&mut central, 0); // external attrs
        u32le(&mut central, offset);
        central.extend_from_slice(name.as_bytes());
    }
    let cd_offset = out.len() as u32;
    let cd_size = central.len() as u32;
    out.extend_from_slice(&central);
    u32le(&mut out, 0x0605_4b50);
    u16le(&mut out, 0);
    u16le(&mut out, 0);
    u16le(&mut out, files.len() as u16);
    u16le(&mut out, files.len() as u16);
    u32le(&mut out, cd_size);
    u32le(&mut out, cd_offset);
    u16le(&mut out, 0);
    out
}
