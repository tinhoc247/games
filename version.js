/* Phiên bản hệ thống. Mỗi lần điều chỉnh / vá lỗi: tăng số ở HUB_VERSION và thêm 1 dòng lên ĐẦU HUB_CHANGELOG.
   Quy ước: sửa lỗi nhỏ → v1.1, v1.2…; thay đổi lớn → v2.0. */
window.HUB_VERSION = '1.1';
window.HUB_CHANGELOG = [
  ['1.1', '19/11/2026', 'Tank War (admin): ghi chú dài đổi thành icon ⓘ, bấm để xem; giao diện gọn hơn.'],
  ['1.0', '19/11/2026', 'Tank War: thêm danh sách người tham gia và dấu ✕ để loại người chơi (đặt tên không phù hợp, gian lận); giảm giật lắc ở phòng chờ và bảng xếp hạng. Cần dán lại Rules Firebase (nhánh tank/kicked).']
];
