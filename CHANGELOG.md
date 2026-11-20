# Changelog

## Phase 3 — Contract v1.2

Breaking changes:

- Đêm 1/2/3 còn 240/270/300 giây; bỏ thắng sớm `all_lit`, thêm thắng `dawn_survived` theo ngưỡng 60%.
- Đèn sáng hao dầu, có thể tắt, châm dầu và thắp lại; snapshot/scenario/sự kiện thêm các trường nhiên liệu v1.2.
- Bóng Mực có trạng thái `drain`, hút đèn yếu và chỉ bị vùng an toàn chặn khi nhiên liệu từ 30 trở lên.
- Sức chứa tăng từ 10 tới tối đa 20 theo số lần thắp thành công.
- Thay toàn bộ điểm: +5 mỗi đom đóm nạp, +100 lần đầu, +40 thắp lại, pulse Bóng Mực đang hút được tổng +15 và chỉ cộng thưởng đèn/nhiên liệu/máu khi thắng tại bình minh.
- Giao diện thêm thanh dầu và bảng màu dễ phân biệt được lưu trong trình duyệt.
