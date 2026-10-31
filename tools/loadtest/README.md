# Đo băng thông Firebase (không đụng tới Firebase thật)

`harness.js` giả lập Realtime Database ngay trong Playwright, mở nhiều trình duyệt thật vào đúng các trang game
rồi đếm số byte tải xuống. Dùng sau mỗi lần sửa game để chắc chắn không làm tăng tải.

```bash
python3 -m http.server 8802 &                       # chạy ở thư mục gốc dự án
WAIT=30 PLAY=45 node tools/loadtest/harness.js 8802 chay-dua 40 4
#                                   cổng  game      N  số trình duyệt thật
```
Game: `doi-vang`, `bao-ve` (chỉ đo phòng chờ), `chay-dua`, `kho-bau`. `NOETAG=1` mô phỏng Firebase không hỗ trợ ETag.
Kết quả: MB/giờ cho cả lớp N học sinh (phòng chờ, đang chơi), và MB khi vào phòng lần đầu / vào lại.
