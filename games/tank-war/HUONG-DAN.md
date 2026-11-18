# Tank War

Xe tăng nhìn từ trên xuống, dùng chung thư viện câu hỏi của hub. Nhân vật đại diện ngồi trên tháp pháo.

## Cách dùng
1. Dashboard chung → chọn bộ câu hỏi → game **Tank War** → chỉnh cài đặt → **Tạo mã**.
2. **Chế độ**
   - **Nhiều người**: học sinh vào bằng mã, chờ thầy/cô bấm **▶ Bắt đầu** (đếm ngược 3-2-1 đồng bộ). Chơi đơn hoặc chia **N đội** (xếp vòng theo thứ tự vào phòng, không bắn nhầm đồng đội). Hết giờ phòng điều khiển tự kết thúc.
   - **Offline (bài tập về nhà)**: thầy/cô chọn **Mở từ – Đóng lúc**; ngoài khung giờ này học sinh không vào mới được (bạn đã vào trận trước giờ đóng vẫn chơi nốt lượt của mình). Thời gian chơi là của **mỗi lượt từng bạn**. Mã mở trong khung giờ; mỗi bạn chơi một mình đấu với **số xe tăng máy** do thầy/cô chọn. Đồng hồ chạy riêng cho từng bạn từ lúc vào trận (tải lại trang không làm lại giờ). Điểm của từng bạn nằm trong bảng ở phòng điều khiển / CSV.
3. **Xếp hạng**: theo **số lần hạ đối thủ**, hòa thì xét **vàng đang có**. Chế độ chia đội cộng điểm theo cùng thứ tự.

## Luật chơi
- Xuất hiện ngẫu nhiên trên bản đồ (rừng – đồng bằng – đồi núi, đi chậm hơn ở rừng/đồi). Lái: **WASD/mũi tên**, ngắm bằng **chuột**, **giữ chuột trái** để bắn.
- Bắn trúng đối phương: **+100 vàng**. Bị hạ: trả lời đúng một câu hỏi để hồi sinh ở vị trí ngẫu nhiên (sai thì ra câu khác).
- 4 **xưởng** ở 4 góc (vùng an toàn, không bắn được, không bị bắn). Vào xưởng: **[1] nâng giáp** (1000 vàng, +1 lớp chịu 1 phát, tối đa 3) · **[2] nâng súng** (1000 vàng, tối đa 3).
- **Súng cấp N bỏ qua N lớp giáp**: nếu giáp của đối thủ còn trên N thì chỉ mất 1 lớp; còn từ N trở xuống thì bị hạ gục. (Cấp 0 + giáp 0 = hạ gục; cấp 1 phá 1 giáp; cấp 3 phá 3 giáp.)
- Giá nâng súng không nêu trong đề nên đặt 1000 vàng như giáp (hằng `COST` trong `index.html`).
- Trò chơi kết thúc khi hết thời gian (phút do admin đặt).

## BƯỚC BẮT BUỘC: thêm Rules cho Firebase (làm 1 lần)
Cách nhanh: dán cả file `firebase-rules-full.json` (đầy đủ mọi nhánh, đã gồm `tank`). Hoặc mở `firebase-rules-tank.json`, chép **nội dung bên trong** `"tank": { ... }` và dán vào Rules ngay sau nhánh `"race": { ... }` (cùng cấp với `gold`, `race`, `bida`). Rules theo đúng kiểu hiện có: chỉ admin đăng nhập bằng mật khẩu được tạo/ghi phiên và câu hỏi; mỗi học sinh chỉ ghi được hồ sơ của chính mình (vàng, hạ, giáp, súng đều bị giới hạn khoảng hợp lệ); sự kiện bắn/trúng đạn chỉ ghi mới, đúng uid của người gửi.

## Tệp & dữ liệu
`index.html` (học sinh) · `admin.html` (điều khiển + báo cáo). Dùng lại `../chay-dua/race.js`, `race-q.js`, `qbase.css`, `race.css` (đừng xoá thư mục chay-dua). Firebase: `tank/sessions|quiz|players|events/<mã>`. Bản đồ sinh từ `seed` của phiên nên mọi máy thấy cùng một bản đồ.

## Giữ quota
Máy học sinh ghi vị trí mỗi 0,3 giây và hỏi danh sách người chơi + sự kiện bắn mỗi 0,7 giây (chế độ nhiều người); chế độ 1 người chỉ ghi điểm mỗi 3 giây. Lớp trên ~40 máy nên thử trước bằng `tools/loadtest`.
