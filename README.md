# CProject Local v0.2.0

**CProject Local** là một VSCode extension giúp bạn quản lý và chạy Node.js projects và Docker Compose services một cách dễ dàng ngay trong workspace.

---

## ✨ Features

### 🚀 Multi-Platform Support

- **Node.js Projects**: Auto-detect từ `package.json` với hỗ trợ npm, yarn, pnpm, bun
- **Docker Projects**: Auto-detect từ `docker-compose*.yml` files
- Hỗ trợ nhiều docker-compose files (dev, prod, test, etc.) trong cùng project

### 📁 Smart Organization

- Projects được nhóm theo loại: Node.js và Docker
- Mỗi docker-compose file là một nhóm riêng với các commands
- Hiển thị tên thư mục giúp phân biệt projects dễ dàng

### ▶️ Running Status Indicators

- Hiển thị số lượng scripts/commands đang chạy ở mọi level
- Visual indicators ngay cả khi collapse folders
- Icons và màu sắc rõ ràng cho running items
- Ví dụ: `📦 Docker (2 projects • ▶ 5 running)`

### ⚙️ Custom Config Location

- Chọn nơi lưu file `.cproject.json`
- Mặc định: workspace root
- Tùy chọn: custom folder hoặc home directory (`~/.cproject`)
- Tránh phải commit config vào repository

### 🔍 Powerful Search

- Search projects và scripts/commands nhanh chóng
- Hỗ trợ tìm kiếm theo tên, type, và compose file
- Chạy hoặc dừng trực tiếp từ search results

### 🎨 Modern UI

- Icons thay vì text cho toolbar commands
- Themed colors cho từng loại project
- Config location hiển thị ngay trên cùng
- Click để reveal file trong OS explorer

---

## 📖 Usage

### Tree Structure

```
📍 Config Location: Workspace Root
├── 📦 Node.js (3 projects)
│   ├── 🔧 my-app
│   │   ├── ▶ dev [npm]
│   │   ├── ▶ build [npm]
│   │   └── ▶ test [npm]
│   └── 🔧 api-server
└── 🐳 Docker (2 projects • ▶ 3 running)
    └── 📦 backend/services
        ├── 📄 dev          ▶ 2 running
        │   ├── ▶ up
        │   ├── ▶ up -d
        │   └── ▶ down
        └── 📄 prod
            ├── ▶ up
            └── ▶ down
```

### Context Menu Options

**Config Location** (chuột phải):

- Change Config Save Location

**Project Node** (chuột phải):

- **Change PM**: Chọn package manager (Node.js only)
- **Mark/Unmark Manual**: Giữ project nguyên khi detect
- **Delete Project**: Xóa project và thêm vào blacklist
- **Add to Whitelist**: Bắt buộc detect dù có trong blacklist

**Script/Command Node**:

- Click → **Run / Stop**
- Chuột phải → **Delete Script** (Node.js only)

### Toolbar Commands

- 🔄 **Detect** → Phát hiện projects mới (tôn trọng blacklist)
- 🔄 **Detect All** → Quét tất cả (bỏ qua blacklist)
- ↻ **Refresh** → Reload tree view
- 🔍 **Search** → Tìm kiếm projects và scripts
- 📁 **Config Location** → Thay đổi nơi lưu config

### Keyboard Shortcuts

- `Ctrl+Shift+P` → Open search (when in editor)

---

## 📝 Notes

### Config File

- `.cproject.json` lưu cấu hình projects, scripts, blacklist và whitelist
- Có thể lưu ở workspace root hoặc custom location
- Format: `{ projects: [], blacklist: [], whitelist: [] }`

### Docker Projects

- Auto-detect tất cả `docker-compose*.yml` files
- Mỗi compose file có nhóm commands riêng
- Commands phổ biến: `up`, `up -d`, `down`, `ps`, `logs`, `restart`, `stop`, `start`, `build`, `pull`
- Hỗ trợ nhiều compose files: `docker-compose.dev.yml`, `docker-compose.prod.yml`, etc.

### Node.js Projects

- Auto-detect từ `package.json`
- Package manager: npm, yarn, pnpm, bun
- PM được chọn ở project-level
- Terminal tự động dừng script cũ khi chạy script mới

### Running Status

- Unique keys cho mỗi script/command (bao gồm compose file label)
- Có thể chạy cùng lúc nhiều compose files
- Visual indicators ở tất cả levels
- Auto-refresh khi start/stop

---

## 🔄 Version History

### 0.2.0 (Latest)

- ✨ Docker Compose support với multiple compose files
- ✨ Custom config location
- ✨ Running status indicators ở tất cả levels
- ✨ Project organization by type (Node.js, Docker)
- 🎨 Icons cho tất cả toolbar commands
- 🎨 Enhanced search với Docker support
- 🐛 Better running status tracking

### 0.1.2

- Add delete project/script
- Blacklist/whitelist functionality
- Detect all projects
- Improved tree view

### 0.1.1

- Add stop/start script
- Change PM per project
- Mark manual projects

### 0.1.0

- Initial release
- Node.js project management
- Basic script running

---

## 📦 Installation

1. Download `.vsix` file
2. Open VSCode
3. Run: `Extensions: Install from VSIX...`
4. Select the downloaded file

Or install from VSCode Marketplace (coming soon)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

MIT License
