# BLTN-Analysis Log (DLT log viewer)

Release 1.2.7: run `build.bat` to validate, build the installer and prepare exactly
three release files in `dist/`: the versioned `.exe`, matching `.exe.blockmap`, and
`latest.yml`. Upload all three as assets of the same published GitHub Release
`v1.2.7` in `NguyenTienDung857/DLT_APP` (not as repository source files).
Previous generated build folders are cleaned after the new artifacts are verified.

Ứng dụng desktop (Electron) để xem log DLT-style của Built-in Cam ECU và chuẩn bị log để copy hoặc đính kèm trên ChatGPT.

Mục tiêu thiết kế:
- Scan log nhanh trên timeline + log table gọn nhẹ.

## Chạy ứng dụng

```powershell
cd D:\project\app_analyt_dlt_log
npm.cmd install
npm.cmd start
```

Kiểm tra nhanh:

```powershell
npm.cmd run check
npm.cmd run syntax
```

## Build file cài đặt Windows

Chạy:

```powershell
.\build.bat
```

Script sẽ:
- Cài dependency nếu chưa có `node_modules`.
- Chạy `npm.cmd run syntax`.
- Chạy `npm.cmd run check`.
- Build installer Windows bằng `electron-builder`.

Kết quả nằm trong thư mục `dist`.

File quan trọng sau khi build:
- `BLTN-Analysis-Log-Setup-<version>.exe`: file cài đặt gửi cho người dùng.
- `latest.yml`: metadata để auto-update biết bản mới.
- `*.blockmap`: file hỗ trợ tải update hiệu quả hơn.

Build hiện đang tạo installer unsigned để dùng nội bộ. Nếu phát hành rộng, nên mua code-signing certificate và bật lại signing để Windows SmartScreen ít cảnh báo hơn.

## Auto update bằng GitHub Releases

App dùng `electron-updater` + `electron-builder` GitHub provider.

Cấu hình hiện tại trong `package.json`:

```json
"publish": [
  {
    "provider": "github",
    "owner": "NguyenTienDung857",
    "repo": "DLT_APP"
  }
]
```

Quy trình phát hành bản update mới:
1. Tăng `version` trong `package.json` (ví dụ `1.0.0` -> `1.0.1`).
2. Chạy `build.bat`.
3. Vào GitHub repo `NguyenTienDung857/DLT_APP`.
4. Tạo Release mới với tag trùng version, ví dụ `v1.0.1`.
5. Upload các file trong `dist` vào Assets của Release:
   - `BLTN-Analysis-Log-Setup-<version>.exe`
   - `latest.yml`
   - `*.blockmap`
6. Publish Release.
7. Khi người dùng mở app đã cài, app sẽ tự kiểm tra GitHub Releases, tải bản mới, rồi hỏi restart để cài.

Lưu ý:
- Repo nên là public nếu muốn app tự update mà không cần token trong máy người dùng.
- Installer đầu tiên đưa cho người dùng phải được build sau khi cấu hình GitHub provider đúng `owner/repo`.

Nếu muốn upload release bằng CLI thay vì kéo-thả thủ công:
1. Cài GitHub CLI (`gh`).
2. Login bằng `gh auth login`.
3. Chạy `build.bat`.
4. Tạo release bằng lệnh dạng:

```powershell
gh release create v1.0.1 dist\*.exe dist\*.blockmap dist\latest.yml --title "v1.0.1" --notes "Update release"
```

## Mở log

- Bấm `Open DLT / ENC` hoặc kéo-thả file vào màn hình đầu.
- Hỗ trợ mở nhiều file cùng lúc; parse chạy trong worker để UI không bị đơ.

Input dự kiến hỗ trợ: `.dlt`, `.enc`, `.log`, `.bin`.

Với file `.enc`, app tự giải mã bằng `DecryptDll.dll` ra thư mục nằm cạnh file `.enc` gốc, mở thư mục đã giải nén đó, rồi để người dùng chọn file `.dlt` cần parse.

## Log viewer

### Bảng log

Bảng log sử dụng virtual scrolling để xử lý file lớn.

Cột hiện tại:
- `#`: thứ tự message
- `Time`: mặc định hiện `HH:mm:ss` (tick checkbox bên cạnh `Time` để hiện full timestamp)
- `Delta`: độ trễ so với message trước
- `Payload`: nội dung payload (wrap dòng, row cao theo nội dung)

Có thể kéo vạch chia trên header để resize cột.

### Timeline / Minimap / Scroll

- `Minute Timeline` (phía trên): click để nhảy nhanh đến vùng thời gian tương ứng.
- `Minimap` (bên phải log list): click để nhảy nhanh đến vùng có cảnh báo/lỗi.
- Thanh cuộn dọc riêng (bên cạnh log list): rail nhỏ, kéo để di chuyển nhanh trong danh sách.

## Message Detail

Click vào 1 dòng log để xem:
- File
- Timestamp
- Payload đầy đủ

Lưu ý: dòng `Counter` đã được bỏ khỏi Message Detail (UI gọn hơn).

## Search / Filter

Panel bên trái:

- Ô search `Search payload or time... (F)` để tìm nhanh; bấm `+` để mở thêm ô search keyword chạy song song.
- Mỗi ô search có bộ đếm keyword match và nút lên/xuống riêng; ô mở thêm có nút `x` để xóa.
- `Full` mặc định bật để giữ toàn bộ view và highlight tất cả keyword; tắt `Full` thì hiện các message match bất kỳ ô search nào.
- `ID Range`: slider 2 đầu để giới hạn view theo ID; nhãn ID đã kèm thời gian có ngày (`D1`, `D2`, ...) nên không cần chế độ Time riêng.
  - Bấm `Full Log` để reset về toàn bộ log.
- `Export CSV`: xuất các dòng đang hiển thị (sau khi áp dụng search + range).

Trong `Log focus`, có thêm nút `Search` nhỏ ngay trên bảng log để quick search.

## ChatGPT log sharing

Choose All loaded logs, Current line, Filtered logs or Lines on screen.
Copy copies Time (HH:mm:ss) and full Payload only. Copy & open ChatGPT also
opens the default browser. ID, date, fractional seconds and Delta are excluded.
No TXT files are created. Use Ctrl+V to paste the copied text into your chat.
The small settings button opens a hidden URL field. Save an HTTP/HTTPS link
to use it for Copy & open; clear it to restore https://chatgpt.com/.
Current line exports exactly one row; viewport exports partially visible rows
without offscreen overscan. Filtered logs respects the Full search option.
Large log formatting runs in a worker without sampling. Loading must finish first.
Minute Timeline has been removed; the log table and minimap remain.
Unpacked builds without app-update.yml do not attempt automatic updates.


## Download Guide

Nút `Download Guide` sẽ tải file hướng dẫn sử dụng (English) `USER_GUIDE_EN.md`.

## File quan trọng

- `electron-main.js`: main process, IPC, file dialog, clipboard, TXT export.
- `preload.js`: API bridge cho renderer.
- `index.html`: UI layout.
- `renderer.js`: UI logic (virtual scroll, timeline/minimap, filter, ChatGPT sharing).
- `style.css`: theme va UI style.
- `src/parser/dltParser.js`: parse DLT/text.
- `src/workers/parseWorker.js`: worker parse.

- `src/services/logTextFormatter.js`: ID/time/payload export.
- `src/services/chatgptHandoff.js`: clipboard, Downloads and browser handoff.
- `src/workers/logTextWorker.js`: background text formatting.
