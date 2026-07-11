fn main() {
    tauri_build::build();

    // Embed Windows resource with multi-resolution icon
    if std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default() == "windows" {
        embed_resource::compile("resource.rc", embed_resource::NONE);
    }
}
