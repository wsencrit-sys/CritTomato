use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg(target_os = "windows")]
extern "system" {
    fn GetUserDefaultLCID() -> u32;
}

/// Detect if the system is using a Chinese locale.
fn is_chinese_locale() -> bool {
    #[cfg(target_os = "windows")]
    unsafe {
        let lcid = GetUserDefaultLCID();
        // 0x0804 = zh-CN, 0x0004 = zh-TW, 0x0C04 = zh-HK, 0x1004 = zh-SG
        return matches!(lcid, 0x0804 | 0x0004 | 0x0C04 | 0x1004);
    }
    #[cfg(not(target_os = "windows"))]
    false
}

/// Create a simple tomato-red circle tray icon (32x32 RGBA)
fn create_tomato_icon() -> tauri::image::Image<'static> {
    let size: u32 = 32;
    let mut rgba = Vec::with_capacity((size * size * 4) as usize);
    let center = size as f32 / 2.0;
    let radius = size as f32 / 2.0 - 3.0;

    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center + 0.5;
            let dy = y as f32 - center + 0.5;
            let dist = (dx * dx + dy * dy).sqrt();

            if dist <= radius {
                // Inner: tomato red gradient
                let gradient = 1.0 - (dist / radius) * 0.3;
                rgba.push((230.0 * gradient) as u8); // R
                rgba.push((70.0 * gradient) as u8);  // G
                rgba.push((55.0 * gradient) as u8);  // B
                rgba.push(255);                        // A
            } else if dist <= radius + 1.5 {
                // Edge: darker red border
                rgba.push(180);
                rgba.push(45);
                rgba.push(35);
                rgba.push(255);
            } else {
                // Transparent
                rgba.push(0);
                rgba.push(0);
                rgba.push(0);
                rgba.push(0);
            }
        }
    }

    tauri::image::Image::new_owned(rgba, size, size)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Build tray menu — detect system language for labels
            let (show_label, quit_label) = if is_chinese_locale() {
                ("显示", "退出")
            } else {
                ("Show", "Quit")
            };
            let show_item = MenuItem::with_id(app, "show", show_label, true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let tomato_icon = create_tomato_icon();

            let _tray = TrayIconBuilder::new()
                .icon(tomato_icon)
                .tooltip("Crit Tomato")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
