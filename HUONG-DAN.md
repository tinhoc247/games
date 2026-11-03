# Dashboard chung cho các game

## Cấu trúc thư mục

```
index.html        Trang cho HỌC SINH: nhập mã, vào đúng game
admin.html        Dashboard cho THẦY CÔ: đăng nhập 1 lần, chọn dữ liệu, chọn game, tạo mã
hub.js            Lõi dùng chung + DANH SÁCH GAME (thêm game mới ở đây)
games/
  kho-bau/        Truy Tìm Kho Báu  (index.html, play.html, admin.html)
  doi-vang/       Đổi Vàng          (index.html, admin.html)
  bao-ve/         Bảo vệ vương quốc (index.html, admin.html, cau-hoi-mau.xlsx)
  chay-dua/       Chạy đua (index.html, admin.html, race*.js/css) – xem games/chay-dua/HUONG-DAN.md, CẦN thêm Rules cho nhánh race
```

Đưa cả thư mục lên hosting (GitHub Pages, Netlify...) giữ nguyên cấu trúc. Dùng chung Firebase cũ, **không cần sửa Rules**.

## Cách dùng hằng ngày

1. Mở `admin.html`, nhập mật khẩu admin (chỉ 1 lần).
2. Bước 1: chọn bộ câu hỏi (hoặc nạp bộ mới ngay tại đó). Bước 2: chọn game. Bước 3: chỉnh cài đặt rồi bấm **Tạo mã**.
3. Bấm **Mở phòng điều khiển** (không phải đăng nhập lại) hoặc chép link gửi học sinh.
4. **Tất cả game dùng chung 1 trang học sinh: `index.html` ở thư mục gốc.** Link gửi học sinh chỉ khác nhau ở mã: `index.html?code=ABCDE`; trang tự tra mã trên Firebase rồi chuyển vào đúng game. Nút **Chép link kèm mã** (dashboard và phòng điều khiển Chạy đua) đều tạo link này. Link không kèm mã vẫn dùng để học sinh tự nhập mã.

**Báo cáo tất cả lượt chơi**: nút **📊 Báo cáo** trên thanh đầu dashboard mở danh sách mọi lượt chơi của cả 4 game (đọc thẳng từ Firebase, không phụ thuộc máy đang dùng). Mỗi dòng có nút Báo cáo, Phòng và 🗑 Xoá; có ô tìm theo mã/tên và lọc theo game.

Mã gần đây hiện ở cột phải, kèm trạng thái (đang chờ, đang chơi, đã kết thúc). Danh sách này lưu trên máy đang dùng.

## Những điều cần biết

- **Đăng nhập một lần**: mật khẩu được giữ trên trình duyệt (localStorage, hết hạn sau 12 giờ) nên mở phòng điều khiển ở tab mới vẫn tự đăng nhập. Nếu máy dùng chung, bấm "Đăng xuất" ở dashboard để xoá ngay. Nếu phải nhập lại mật khẩu ở trang admin của game, trang vẫn mở đúng phòng điều khiển của mã (`?ctl=MÃ`) chứ không nhảy về thư viện.
- **Thư viện câu hỏi chỉ có một nơi lưu**: `lib/` (thông tin bộ), `libq/` (câu hỏi), `libimg/` (ảnh) ở gốc Firebase. Cả 4 game cùng đọc/ghi ở đây, bộ nào cũng chơi được ở mọi game, không cần chép ảnh. Thêm bộ mới ngay trên dashboard: Bước 1 → **➕ Nạp bộ câu hỏi mới** → chọn file Excel/JSON (và thư mục ảnh nếu có) → **Lưu vào thư viện**. Bộ vừa lưu được chọn sẵn, không cần chọn game. Trang admin của từng game vẫn nạp và lưu được như cũ, cùng vào một thư viện.
- **Chuyển dữ liệu cũ (làm 1 lần)**: nếu trước đây đã lưu bộ ở Đổi Vàng / Bảo vệ (`gold/lib`), vào dashboard sẽ thấy dòng cảnh báo vàng kèm nút **Chuyển về thư viện chung**. Bấm là chép câu hỏi và ảnh sang chỗ mới rồi xoá bản cũ. Phiên chơi cũ vẫn dùng được. Phiên chơi (`sessions/`, `gold/sessions/`) vẫn nằm ở vùng riêng của từng game.
- Trên dashboard, mỗi bộ có nút ✏️ đổi tên và 🗑 xoá (xoá cả câu hỏi và ảnh trên Firebase, không khôi phục được). Xoá một bộ chỉ dọn các lượt chơi của game đang mở trang admin; lượt chơi cũ của game khác tạo từ bộ đó (nếu có) sẽ mất ảnh.
- Mã tạo từ dashboard có thêm trường `game`. Mã tạo thẳng trong trang admin của từng game vẫn vào được: cổng học sinh tự nhận ra game dựa vào cấu trúc phiên chơi.
- Trong mỗi game có nút nhỏ "⌂ Dashboard chung" ở góc trái dưới của trang admin.

## Mã luôn vào đúng game

- Link cũ có kèm game (`?code=MÃ&g=GAME`) vẫn chạy: chuyển trang ngay, không chờ mạng. Link mới chỉ có `?code=MÃ` nên mất thêm một lần tra mã (rất nhanh). Học sinh gõ mã tay cũng tra mã trên Firebase; phiên có trường `game` thì chỉ vào đúng game đó.
- Nếu cùng một mã tồn tại ở 2 game (chỉ xảy ra với mã tạo thẳng trong trang admin của game), cổng không đoán mà báo học sinh nhờ thầy cô tạo mã mới.
- Mỗi trang game tự từ chối mã của game khác, kể cả khi học sinh mở nhầm link trực tiếp.
- Game mới nên luôn ghi trường `game` vào phiên chơi (mẫu trong `hub.js` đã có).

## Thêm game mới

Cần 4 việc:

**1. Đặt game vào `games/ten-game/`** với `index.html` (trang học sinh) và `admin.html` (phòng điều khiển).

**2. Trang học sinh nhận mã từ link.** Sau khi màn nhập mã đã hiện, thêm:

```js
const c = new URLSearchParams(location.search).get('code');
if (c) { /* điền c vào ô mã rồi gọi hàm kiểm tra mã của game */ }
```

**3. Trang admin nhận đăng nhập từ dashboard.** Lúc khởi động trang admin:

```js
const P = sessionStorage.getItem('hubPw');          // mật khẩu do dashboard để lại
if (P) { /* đăng nhập Firebase bằng P, rồi nếu có ?ctl=MÃ thì mở phòng điều khiển của MÃ đó */ }
```

**4. Khai báo trong `hub.js`**, thêm 1 mục vào mảng `GAMES` (có sẵn mẫu bị comment ở cuối mảng):

| Trường | Ý nghĩa |
|---|---|
| `id`, `name`, `icon`, `tone`, `blurb` | Hiển thị ở bước 2 của dashboard |
| `dir` | Thư mục game, ví dụ `games/ten-game/` |
| `ns` | Vùng Firebase của phiên chơi (không áp dụng cho thư viện câu hỏi, đã dùng chung): `''` hoặc `'gold/'` hoặc vùng riêng như `'ten-game/'` |
| `match(keys)` | Nhận ra phiên của game này. Game mới nên ghi trường `game` khi tạo phiên, `match` có thể chỉ là `k => !!k.game` |
| `options` | Các ô cài đặt ở bước 3. Hỗ trợ `number`, `select`, `checkbox`, `datetime`, có `showIf` để ẩn/hiện theo ô khác |
| `create(ctx)` | Ghi phiên chơi lên Firebase, trả về `{ control: 'admin.html?ctl=' + ctx.code }` |

`ctx` gồm: `code`, `title`, `qs` (câu hỏi dạng chuỗi JSON), `nq` (số câu), `o` (giá trị các ô cài đặt), `bank`, `me` (mã người tạo), `now`.

Nếu game mới dùng vùng Firebase riêng, nhớ thêm Rules cho vùng đó như các game hiện tại.

## Kết thúc lượt chơi

- Khi một lượt kết thúc (thầy cô bấm Kết thúc, hết giờ, hoặc có người về đích ở Chạy đua), mã **không dùng lại được nữa**: học sinh nhập mã sẽ bị từ chối.
- **Báo cáo của lượt chơi được giữ lại cho đến khi admin xoá** (nút 🗑 trong 📊 Báo cáo trên dashboard). Không có gì tự xoá.
- Học sinh đang ở màn hình kết quả không bị đẩy ra khi thầy cô xoá lượt.

## Giữ Firebase không quá tải (quota)

Gói Spark của Firebase giới hạn **10 GB tải xuống / tháng**. Các game hỏi Firebase liên tục (mỗi vài giây), nên đã có `quota.js` (nạp đầu mọi trang) và vài chỉnh sửa tần suất:

- `quota.js` bọc `fetch` cho mọi yêu cầu tới Realtime Database: ghi không nhận lại dữ liệu (`print=silent`), ảnh + câu hỏi lưu bền trong IndexedDB (tải lại trang không tải lại ảnh), đọc kèm ETag (không đổi thì Firebase trả 304), tab ẩn thì dùng lại dữ liệu cũ tối đa 15 giây. Tắt khẩn cấp: gỡ dòng `<script src="quota.js">` khỏi trang.
- Phòng chờ Kho Báu không còn tải cả bộ câu hỏi mỗi 2 giây (chỉ hỏi `status`/`kicked`).
- Danh sách người chơi (phần nặng nhất, tỷ lệ với sĩ số) thưa dần theo số học sinh: 4–8 giây/lần thay vì 1–2 giây.
- Dashboard: Báo cáo không tải bộ câu hỏi của từng phiên Kho Báu; danh sách bộ câu hỏi nhớ 2 phút.
- **Game mới**: thêm `<script src="../../quota.js"></script>` ngay sau `<head>`, đừng poll quá 1 lần/2 giây, và đừng đọc cả nhánh `players/` hay `sessions/` (chứa câu hỏi) nếu chỉ cần vài trường.
- Đo kiểm: xem `tools/loadtest/README.md`.
