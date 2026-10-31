# Bảo vệ vương quốc – hướng dẫn nhanh

## File
- `index.html` – trang cho học sinh (nhập mã game, chọn nhân vật, chơi).
- `admin.html` – trang giáo viên (đăng nhập, nạp câu hỏi, tạo mã, chia đội, theo dõi, báo cáo).
- `cau-hoi-mau.xlsx` – file Excel mẫu (A: câu hỏi, B–E: đáp án A–D, F: đáp án đúng, G: link hình). Cũng dùng được file JSON / ngân hàng Spark / thư viện ảnh `tinhoc247/ic3-images` y như game Đổi Vàng.

Đặt 2 file HTML cùng thư mục với nhau trên hosting (cùng chỗ với game gold). Game dùng **cùng Firebase** của game gold.

## Cách chơi (giáo viên)
1. Vào `admin.html` → đăng nhập → nạp câu hỏi (hoặc chọn từ thư viện) → *Tạo mã game*.
2. Học sinh vào `index.html`, nhập mã, tên, chọn nhân vật.
3. Khi đủ người, đặt **👥 Người/đội** (VD 4) rồi chọn:
   - **🎲 Bắt đầu & chia ngẫu nhiên**: máy xáo ngẫu nhiên các nhân vật vào đội. Người dư được chia thêm 1 người cho các đội cuối. VD 46 người, 4 người/đội → 11 đội: 9 đội 4 người + 2 đội cuối 5 người.
   - **✋ Admin chia đội**: máy gợi ý sẵn một cách chia ngẫu nhiên; thầy/cô đổi đội từng bạn bằng ô chọn, bấm 🔀 Xáo lại nếu muốn chia lại, rồi **✔ Xác nhận & bắt đầu**. Người vào phòng lúc đang chỉnh được tự xếp vào đội ít người nhất.
   Tên/biểu tượng vương quốc của mỗi đội luôn được bốc ngẫu nhiên.
4. Trận kết thúc khi chỉ còn 1 vương quốc hoặc hết giờ. Xem báo cáo ở nút 📊.

## BƯỚC BẮT BUỘC: thêm 1 đoạn Rules cho Firebase
Game ghi nhật ký trận đấu vào nhánh mới `gold/moves`. Nếu Rules hiện tại chỉ cho phép các nhánh của game gold thì cần thêm (Firebase Console → Realtime Database → Rules, đặt bên trong nút `"gold": { ... }`):

```json
"moves": {
  "$code": {
    ".read": "auth != null",
    ".write": "auth != null && auth.token.email === 'sparklv12026@gmail.com'",
    "$id": {
      ".write": "auth != null && !data.exists()",
      ".validate": "newData.hasChildren(['k','p'])"
    }
  }
}
```
Nếu không thêm, người chơi sẽ thấy thông báo "Không có quyền…" khi chọn khiên/kiếm hoặc tấn công.

## Luật chơi
Xem nút 📜 trong game. Tóm tắt: trả lời đúng → chọn 🛡️ (+1 phòng thủ) hoặc ⚔️ (+1 tấn công); có ≥1 lượt tấn công thì bấm ⚔️ Tấn công, chọn vương quốc (chỉ thấy tên + số nhân vật). Phòng thủ còn thì bị chặn (−1 phòng thủ); phòng thủ = 0 thì: giải cứu tù binh nếu đội đó đang giam người, hết tù binh mới bắt 1 nhân vật. Bị bắt hết nhân vật là thua.

Luật bổ sung đã thêm: 🔥 combo 3 câu đúng liên tiếp thưởng gấp đôi · 🎯 đánh trúng được hoàn 1 lượt tấn công · 🧱 đội bị bắt người được tặng 2 phòng thủ · 🤝 người bị giam vẫn trả lời câu hỏi để giúp đội.


## Cập nhật mới
- **Làm lại câu sai**: trả lời sai thì bắt buộc làm lại đúng câu đó, mỗi lần làm lại đều xáo lại thứ tự đáp án; đúng mới được đi tiếp. Làm lại không tính điểm, không có thưởng và không ghi vào báo cáo (chỉ lần trả lời đầu được tính). Mỗi lần mở câu hỏi, thứ tự câu và đáp án luôn được xáo trộn.
- **Xuất phát bằng 0**: không còn ô "Lượt khởi đầu"; mọi đội bắt đầu với 0 phòng thủ, 0 tấn công.
- **Toàn màn hình**: màn chơi tự phóng to chiếm trọn màn hình (máy tính: bên trái là thành + chỉ số, bên phải là diễn biến + nút; điện thoại: một cột). Game vẫn tự vào chế độ toàn màn hình khi em chạm lần đầu, thoát ra thì tạm dừng.
- **Câu ghép/chọn đáp án dài**: bấm vào ô chọn sẽ mở danh sách rộng, tự xuống dòng, không bị tràn khỏi màn hình (trên điện thoại vẫn dùng danh sách có sẵn của máy).

## Cập nhật bản 4
- **Kết thúc trận** (cả admin lẫn học sinh đều tự nhận biết): admin bấm ⏹ Kết thúc, hết giờ, hoặc chỉ còn 1 vương quốc. Màn kết quả ghi rõ lý do kết thúc. Không thể bắt đầu nếu chỉ có dưới 2 vương quốc.
- **Mượt hơn**: màn hình chỉ cập nhật phần thay đổi (không dựng lại toàn trang mỗi 2 giây nên không nháy, không nhảy cuộn); đổi trang/đổi trạng thái có chuyển cảnh nhẹ; kết quả trận đánh cuối được hiển thị trọn vẹn trước khi sang màn kết thúc.
- **Trang admin không còn toàn màn hình** (không tự phóng to, không có nút ⛶). Trang học sinh vẫn giữ chế độ toàn màn hình.
- **Trang học sinh gọn hơn**: các hướng dẫn/ghi chú được thu thành biểu tượng ⓘ, bấm vào mới hiện nội dung (bấm lần nữa hoặc chỗ khác để ẩn).

## Cập nhật bản 5
- **Hiện tên người chơi** trong bảng xếp hạng vương quốc (cả học sinh lẫn admin): mỗi thành viên là một viên thuốc gồm avatar + tên; người đang bị giam có ⛓️ và mờ đi.
- **Giới hạn tích lũy**: mỗi đội tối đa **5 🛡️** và **5 ⚔️** (kể cả thưởng combo, hoàn lượt, gia cố thành). Khi cả hai đầy, nút ❓ Trả lời câu hỏi bị ẩn, chỉ còn **⚔️ Tấn công**. Khi khiên (hoặc kiếm) giảm dưới 5, nút câu hỏi hiện lại; hộp thưởng chỉ hiện món chưa đầy (còn cả hai thì chọn 1 trong 2).
- **Chọn người để bắt**: bấm ⚔️ Tấn công → chọn vương quốc → chọn đúng **tên người chơi** muốn bắt. Nếu đội đó đang giữ tù binh thì danh sách là các tù binh để chọn người giải cứu (vẫn theo luật: hết khiên mới đánh trúng).
- **Trốn thoát**: người bị bắt trả lời đúng **3 câu** (tính lần trả lời đầu của mỗi câu; làm lại câu sai không tính) là tự thoát về thành. Trong lúc bị giam, câu đúng chỉ tính cho trốn thoát (không nhận khiên/kiếm). Tiến độ về 0 mỗi khi bị bắt lại.
- Không cần đổi Rules Firebase: vẫn dùng nhánh `gold/moves` (thêm loại hành động `c` = câu đúng khi bị giam; hành động tấn công có thêm trường `q` = người được chọn).
- Muốn đổi số câu trốn thoát hoặc mức tối đa: sửa `const MAXV=5,ESCN=3;` (ở cả `index.html` và `admin.html`).
- (Bản 5b) "Vượt ngục" (cũ) đổi tên thành **Trốn thoát**. Khi đội còn ⚔️ ≥ 1, nút **⚔️ Tấn công** luôn có mặt: ở màn chính, và cả ngay trong hộp câu hỏi (kể cả khi đang làm lại câu sai hoặc đang bị giam). Khiên/kiếm chỉ nhận được sau khi trả lời đúng.

## Cập nhật bản 6 – khiên/kiếm tính theo từng người
- Mỗi người chơi có **🛡️ khiên và ⚔️ kiếm riêng** (tối đa 5 mỗi loại); thưởng khi trả lời đúng cộng cho chính người đó, không dùng chung cả đội. Bảng xếp hạng hiện khiên/kiếm của từng bạn bên cạnh tên, ô "Lượt" của đội là tổng.
- Có ≥1 kiếm là tấn công được bất cứ lúc nào (kể cả đang làm câu hỏi). Chọn đội rồi chọn đúng người: bạn bị chọn còn khiên thì mất 1 khiên, hết khiên thì bị bắt.
- Giải cứu tù binh: chọn tù binh trong danh sách; phải phá hết khiên của các bạn đang ở trong thành đội giữ tù (mỗi đòn phá 1 khiên của bạn nhiều khiên nhất) rồi mới cứu được.
- Bỏ luật "gia cố thành +2 khiên" cho cả đội vì không còn khiên chung.

## Cập nhật bản 7 – quay lại kho chung của đội
- Khiên/kiếm là của **cả đội**: mỗi bạn trả lời đúng thì cộng vào kho chung, tối đa **5 🛡️ và 5 ⚔️** mỗi đội. Đủ 5-5 thì chỉ còn nút ⚔️ Tấn công; khiên/kiếm giảm dưới 5 thì lại được trả lời.
- Đội còn ≥1 kiếm thì bất kỳ bạn nào cũng tấn công được bất cứ lúc nào (kể cả đang làm câu hỏi). Chọn đội rồi chọn người: còn khiên thì chặn (−1 khiên); hết khiên thì giải cứu tù binh trước (chọn người muốn cứu), hết tù binh mới bắt đúng người đã chọn.
- Giữ lại: hoàn 1 kiếm khi đánh trúng, gia cố thành +2 khiên (không vượt 5), combo, và Trốn thoát (đúng 3 câu).

## Cập nhật bản 8
- **Bỏ các phần thưởng thêm:** không còn 🔥 combo (gấp đôi), 🎯 hoàn 1 kiếm khi đánh trúng, 🧱 gia cố thành +2 khiên. Mỗi câu đúng chỉ được +1 khiên hoặc +1 kiếm; mỗi đòn tấn công trừ 1 kiếm. (Các mục "Luật bổ sung" ở phần cũ của file này không còn áp dụng.) Ô "Chuỗi đúng" cũng được bỏ khỏi màn hình.
