# CProject Local

**CProject Local** là một VSCode extension giúp bạn quản lý project local trong workspace và chạy script nhanh chóng theo package manager (npm, yarn, pnpm, bun).

---

## Features

- Quét workspace để detect project từ `package.json`.
- Chạy / dừng script trực tiếp từ Tree View.
- Chọn package manager cho toàn project (project-level).
- Đánh dấu project **Manual** để `detectProjects` không ghi đè.
- Xóa project hoặc script trực tiếp từ menu chuột phải.
- Refresh Tree View từ `.cproject.json`.

---

## Usage

### Tree View

- **Project Node** (chuột phải):

  - **Change PM**: Chọn package manager cho project.
  - **Mark/Unmark Manual**: Giữ project nguyên khi detect.
  - **Delete Project**: Xóa project khỏi `.cproject.json`.

- **Script Node**:
  - Click → **Run / Stop script**.
  - Chuột phải → **Delete Script**.

### Tree View Title Buttons

- **Detect Projects** → Phát hiện project mới từ workspace.
- **Refresh Projects** → Reload tree view từ `.cproject.json`.

---

## Notes

- `.cproject.json` lưu cấu hình project và script.
- PM được chọn ở **project-level**, áp dụng cho tất cả script trong project.
- Terminal tự động dừng script cũ nếu chạy trùng script mới.

---

## License

MIT License
