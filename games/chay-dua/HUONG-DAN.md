# Chạy đua

Cuộc đua online nhiều người, dùng chung thư viện câu hỏi của hub (mọi dạng câu hỏi như các game khác).

## Cách dùng
1. Vào dashboard chung → chọn bộ câu hỏi → chọn game **Chạy đua** → **Tạo mã**.
2. **Mở phòng điều khiển**: thầy cô thấy mọi người chơi di chuyển trên đường đua. Học sinh nhập mã ở trang chủ (hoặc dùng "Chép link kèm mã") rồi chọn tên, nhân vật.
3. Khi đủ người bấm **▶ Bắt đầu cuộc đua**: đếm ngược 3-2-1, kèn xuất phát và tiếng reo hò vang lên, cả lớp chạy cùng lúc.
4. Cuộc đua **kết thúc ngay khi có người về đích đầu tiên** (người đó thắng), hoặc thầy cô bấm **⏹ Kết thúc** sớm hơn. Báo cáo xem lại ở nút 📊 của dashboard (`admin.html?rep=MÃ`), có nút tải CSV.

## Luật chơi
- Độ dài đường đua = số câu hỏi của bộ. Mỗi câu hiện **full màn hình**; **không tính thời gian**.
- Đúng → tiến 1 bước. Sai → phải trả lời lại câu đó (đáp án được xáo lại). Câu làm lại vẫn giúp tiến bước nhưng **không tính vào số câu đúng** trong báo cáo.
- **Năng lực**: khi trả lời đúng (ngay lần đầu) câu thứ **3, 6, 9, 12, 15…** (mỗi bội số của 3), người chơi bốc ngẫu nhiên 1 trong 3:
  - 🚀 tiến thêm 1 bước;
  - ⏪ kéo lùi 1 bước một đối thủ do mình chọn;
  - 🧊 đóng băng một đối thủ 3 giây (không trả lời được).
  Người bị ảnh hưởng nhận thông báo có tên người ra chiêu. Không còn đối thủ nào đang chạy thì năng lực biến thành "tiến thêm 1 bước".
- Người chơi có **thanh tiến độ phía trên** thấy mọi người chạy; admin thấy từng làn đua, bảng xếp hạng và nhật ký hiệu ứng.
- Bảng tóm tắt cuối cuộc đua: xếp hạng (người về đích đầu tiên hạng 1, những người còn lại xếp theo số bước), độ chính xác (câu đúng ngay lần đầu / số câu đã làm), câu hỏi cần lưu ý (nhiều bạn sai).

## BƯỚC BẮT BUỘC: thêm Rules cho Firebase (làm 1 lần)
Game dùng vùng riêng `race` trong Realtime Database. Vào Firebase Console → Realtime Database → Rules, thêm nhánh `race` ngang hàng với `gold`:

```json
"race": {
  "sessions": {
    ".read": "auth != null",
    "$code": { ".write": "auth != null && auth.token.email === 'sparklv12026@gmail.com'" }
  },
  "quiz": {
    "$code": { ".read": "auth != null", ".write": "auth != null && auth.token.email === 'sparklv12026@gmail.com'" }
  },
  "players": {
    "$code": {
      ".read": "auth != null",
      ".write": "auth != null && auth.token.email === 'sparklv12026@gmail.com'",
      "$id": { ".write": "auth != null && auth.uid === $id" }
    }
  },
  "logs": {
    "$code": {
      ".read": "auth != null",
      ".write": "auth != null && auth.token.email === 'sparklv12026@gmail.com'",
      "$id": { ".write": "auth != null && auth.uid === $id" }
    }
  },
  "events": {
    "$code": {
      ".read": "auth != null",
      ".write": "auth != null && auth.token.email === 'sparklv12026@gmail.com'",
      "$eid": { ".write": "auth != null && !data.exists()" }
    }
  }
}
```
Chưa thêm thì học sinh/admin sẽ thấy "Không có quyền truy cập dữ liệu…".

## Tệp
`index.html` (học sinh) · `admin.html` (điều khiển + báo cáo) · `race.js` (Firebase, âm thanh, xếp hạng) · `race-q.js` + `qbase.css` (hiển thị câu hỏi, lấy từ Đổi Vàng) · `race.css` (giao diện đường đua).

Dữ liệu Firebase: `race/sessions/<mã>`, `race/quiz/<mã>`, `race/players/<mã>/<uid>`, `race/logs/<mã>/<uid>`, `race/events/<mã>/<id>` (hiệu ứng năng lực).
