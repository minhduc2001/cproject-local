# CProject Local v0.1.2

**CProject Local** là một VSCode extension giúp bạn quản lý project local trong workspace và chạy script nhanh chóng theo package manager (npm, yarn, pnpm, bun).

---

## Features

- Quét workspace để detect project từ `package.json`.
- Chạy / dừng script trực tiếp từ Tree View.
- Chọn package manager cho toàn project (project-level).
- Đánh dấu project **Manual** để `detectProjects` không ghi đè.
- Xóa project hoặc script trực tiếp từ menu chuột phải.
- Refresh Tree View từ `.cproject.json`.
- **Blacklist**: Project đã xóa sẽ không bị detect lại.
- **Whitelist**: Project bắt buộc load, ưu tiên detect dù có trong blacklist.
- **Detect All**: Quét tất cả project trong workspace, bỏ qua blacklist, giữ nguyên whitelist.

---

## Usage

### Tree View

- **Project Node** (chuột phải):

  - **Change PM**: Chọn package manager cho project.
  - **Mark/Unmark Manual**: Giữ project nguyên khi detect.
  - **Delete Project**: Xóa project khỏi `.cproject.json` và thêm vào blacklist.
  - **Add Project to Whitelist**: Bắt buộc detect project dù có trong blacklist.

- **Script Node**:

  - Click → **Run / Stop script**.
  - Chuột phải → **Delete Script**.

### Tree View Title Buttons

- **Detect Projects** → Phát hiện project mới từ workspace (bỏ qua manual, tôn trọng blacklist/whitelist).
- **Detect All Projects** → Quét tất cả project từ đầu, bỏ qua blacklist, ưu tiên whitelist.
- **Refresh Projects** → Reload tree view từ `.cproject.json`.

---

## Notes

- `.cproject.json` lưu cấu hình project, scripts, blacklist và whitelist.
- PM được chọn ở **project-level**, áp dụng cho tất cả script trong project.
- Terminal tự động dừng script cũ nếu chạy trùng script mới.
- Manual project sẽ không bị ghi đè khi detect.

---

## Version

- **0.1.0**: Initial release.
- **0.1.1**: Add stop/start script, change PM per project, mark manual.
- **0.1.2**: Add delete project/script, blacklist, whitelist, detect all, improved tree view.

---

## License

MIT License
