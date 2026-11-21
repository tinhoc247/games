/* Phiên bản hệ thống. Mỗi lần điều chỉnh / vá lỗi: tăng số ở HUB_VERSION và thêm 1 dòng lên ĐẦU HUB_CHANGELOG.
   Quy ước: sửa lỗi nhỏ → v1.1, v1.2…; thay đổi lớn → v2.0. */
window.HUB_VERSION = '1.4';
window.HUB_CHANGELOG = [
  ['1.4', '21/11/2026', 'Tank War: sửa lỗi không lái được khi mới vào (bộ gõ tiếng Việt, bàn phím khác QWERTY, thiết bị cảm ứng — thêm cần lái ảo, chuột phải để đi); sửa lỗi bắn trúng nhiều lần nhưng không tính (đạn tới trễ bị nhảy cóc qua xe); tối ưu mạng chậm: yêu cầu có thời hạn chờ và tự thử lại, ghi vị trí theo hàng đợi, nội suy theo vận tốc, hỏi sự kiện nhanh hơn, vào phòng nhanh hơn, hiện ping.'],
  ['1.3', '19/11/2026', 'Mỗi game có nhạc nền riêng: Chạy đua (sôi động), Tank War (hành khúc), Đội vàng (xylophone nhí nhảnh), Bảo vệ (hùng tráng), Kho báu (phiêu lưu hải tặc). Giảm âm lượng nhạc nền cho vừa phải.'],
  ['1.2', '19/11/2026', 'Màn hình vào phòng của Tank War và Chạy đua hiện tên bài (như các game khác) kèm loại game và mã.'],
  ['1.1', '19/11/2026', 'Tank War (admin): ghi chú dài đổi thành icon ⓘ, bấm để xem; giao diện gọn hơn.'],
  ['1.0', '19/11/2026', 'Tank War: thêm danh sách người tham gia và dấu ✕ để loại người chơi (đặt tên không phù hợp, gian lận); giảm giật lắc ở phòng chờ và bảng xếp hạng. Cần dán lại Rules Firebase (nhánh tank/kicked).']
];
