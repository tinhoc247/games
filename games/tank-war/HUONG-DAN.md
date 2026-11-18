# Tank War

Xe tăng nhìn từ trên xuống, dùng chung thư viện câu hỏi của hub. Nhân vật đại diện ngồi trên tháp pháo.

## Cách dùng
1. Dashboard chung → chọn bộ câu hỏi → game **Tank War** → chỉnh cài đặt → **Tạo mã**.
2. **Chế độ**
   - **Nhiều người**: học sinh vào bằng mã, chờ thầy/cô bấm **▶ Bắt đầu** (đếm ngược 3-2-1 đồng bộ). Chơi đơn hoặc chia **N đội** (xếp vòng theo thứ tự vào phòng, không bắn nhầm đồng đội). Hết giờ phòng điều khiển tự kết thúc.
   - **Offline (bài tập về nhà)**: thầy/cô chọn **Mở từ – Đóng lúc**; ngoài khung giờ này học sinh không vào mới được (bạn đã vào trận trước giờ đóng vẫn chơi nốt lượt của mình). Thời gian chơi là của **mỗi lượt từng bạn**. Mã mở trong khung giờ; mỗi bạn chơi một mình đấu với **số xe tăng máy** do thầy/cô chọn. Đồng hồ chạy riêng cho từng bạn từ lúc vào trận (tải lại trang không làm lại giờ). Điểm của từng bạn nằm trong bảng ở phòng điều khiển / CSV.
3. **Xếp hạng**: theo **số lần hạ đối thủ**, hòa thì xét **vàng đang có**. Chế độ chia đội cộng điểm theo cùng thứ tự.

## Kiểu chiến trường
Khi tạo mã (dashboard, bước 3) thầy/cô chọn **Kiểu chiến trường**: 🗺️ Hỗn hợp (rừng – đồng bằng – đồi núi, như cũ) · 🌲 Rừng rậm · 🏜️ Sa mạc · ❄️ Tuyết nguyên · 🏙️ Thành phố đổ nát (nhà cao tầng chắn đạn, đường phố) · 🎲 Ngẫu nhiên · 🙋 Học sinh tự chọn (chỉ chế độ Offline; chế độ Online dùng chung 1 bản đồ nên tự về Hỗn hợp). Mỗi kiểu có địa hình, vật cản và tốc độ di chuyển riêng. Cả lớp trong cùng một mã luôn thấy cùng một bản đồ. Mã cũ không có lựa chọn này vẫn chơi như Hỗn hợp.

## Hiển thị giáp & vũ khí
- **Trên xe** (cả xe mình và xe đối thủ): giáp cấp 1 = tấm giáp hông · cấp 2 = thêm giáp mũi và khối giáp phản ứng · cấp 3 = thêm viền vàng và vòng giáp tháp pháo. Súng cấp 0 = nòng đơn 75mm · cấp 1 = nòng to 90mm có hãm lửa · cấp 2 = nòng kép 105mm · cấp 3 = nòng kép + bệ tên lửa 120mm (đạn to và đỏ hơn). Vòng xanh quanh xe = số lớp giáp còn lại. Trên đầu xe có nhãn 🛡/🔫 kèm cấp.
- **Bảng "Xe của em"** (góc trái dưới): hình xe hiện tại, tên cấp giáp, tên vũ khí, thanh cấp và mô tả (xuyên mấy lớp giáp). Nút ở xưởng cũng ghi rõ tên cấp kế tiếp.

## Luật chơi
- Xuất hiện ngẫu nhiên trên bản đồ (rừng – đồng bằng – đồi núi, đi chậm hơn ở rừng/đồi). Lái: **WASD/mũi tên**, ngắm bằng **chuột**, **giữ chuột trái** để bắn.
- Bắn trúng đối phương: **+100 vàng**. Bị hạ: trả lời đúng một câu hỏi để hồi sinh ở vị trí ngẫu nhiên (sai thì **bắt buộc làm lại đúng câu đó**, đáp án được xáo lại, cho tới khi đúng mới hồi sinh).
- 4 **xưởng** ở 4 góc (vùng an toàn, không bắn được, không bị bắn). Vào xưởng: **[1] nâng giáp** (1000 vàng, +1 lớp chịu 1 phát, tối đa 3) · **[2] nâng súng** (1000 vàng, tối đa 3).
- **Súng cấp N bỏ qua N lớp giáp**: nếu giáp của đối thủ còn trên N thì chỉ mất 1 lớp; còn từ N trở xuống thì bị hạ gục. (Cấp 0 + giáp 0 = hạ gục; cấp 1 phá 1 giáp; cấp 3 phá 3 giáp.)
- Giá nâng súng không nêu trong đề nên đặt 1000 vàng như giáp (hằng `COST` trong `index.html`).
- Trò chơi kết thúc khi hết thời gian (phút do admin đặt).

## BƯỚC BẮT BUỘC: thêm Rules cho Firebase (làm 1 lần)
Cách nhanh: dán cả file `firebase-rules-full.json` (đầy đủ mọi nhánh, đã gồm `tank`). Hoặc mở `firebase-rules-tank.json`, chép **nội dung bên trong** `"tank": { ... }` và dán vào Rules ngay sau nhánh `"race": { ... }` (cùng cấp với `gold`, `race`, `bida`). Rules theo đúng kiểu hiện có: chỉ admin đăng nhập bằng mật khẩu được tạo/ghi phiên và câu hỏi; mỗi học sinh chỉ ghi được hồ sơ của chính mình (vàng, hạ, giáp, súng đều bị giới hạn khoảng hợp lệ); sự kiện bắn/trúng đạn chỉ ghi mới, đúng uid của người gửi.

## Tệp & dữ liệu
Phiên chơi có thêm trường `map` (`mix|forest|desert|snow|city|random|pick`), không cần sửa Rules vì chỉ admin ghi phiên.

`index.html` (học sinh) · `admin.html` (điều khiển + báo cáo). Dùng lại `../chay-dua/race.js`, `race-q.js`, `qbase.css`, `race.css` (đừng xoá thư mục chay-dua). Firebase: `tank/sessions|quiz|players|events/<mã>`. Bản đồ sinh từ `seed` của phiên nên mọi máy thấy cùng một bản đồ.

## Giữ quota
Máy học sinh ghi vị trí mỗi 0,3 giây và hỏi danh sách người chơi + sự kiện bắn mỗi 0,7 giây (chế độ nhiều người); chế độ 1 người chỉ ghi điểm mỗi 3 giây. Lớp trên ~40 máy nên thử trước bằng `tools/loadtest`.
