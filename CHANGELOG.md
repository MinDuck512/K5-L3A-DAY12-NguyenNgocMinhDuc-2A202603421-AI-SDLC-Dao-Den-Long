# Changelog

Tất cả các thay đổi quan trọng của dự án Đảo Đèn Lồng qua 4 Phase phát triển.

## [v1.0.0] - Phase 4 — Contract v1.3: Bình Minh & Phát hành

### Thêm mới
- **Chế độ Benchmark (`node src/bench.js`):** Đo đạc hiệu năng với 200 Bóng Mực wander, 100 đom đóm, 3 đèn sáng tại Đêm 1; camera bay 360°; xuất các chỉ số `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `load_ms`, `peak_mem_mb`.
- **Soak Test (`node src/soak.js`):** Chạy kiểm thử độ bền 10 Đêm liên tiếp trong cùng một tiến trình, xác nhận không rò rỉ bộ nhớ (`mem_end_mb <= 1.2 * mem_start_mb`) và 0 crash.
- **Bảng xếp hạng cục bộ (Leaderboard):** Lưu top 10 điểm cao nhất kèm tên người chơi (3–12 ký tự), số Đêm thắng, ngày giờ và seed; hỗ trợ xuất CLI qua `<run_cmd> --export-leaderboard <file.json>`.
- **Trợ năng & Dễ tiếp cận (Accessibility):** Tùy biến đổi toàn bộ phím điều khiển (có cảnh báo trùng phím và khôi phục mặc định); phụ đề và cảnh báo hình ảnh (Bóng Mực xuất hiện, gió mạnh, 10s cuối, đèn cạn dầu); tùy chọn giảm chuyển động (tắt rung/chớp); tùy chọn chữ lớn UI (×1.25).
- **Tài liệu hoàn chỉnh:** Bản Retro tổng kết 4 phase (`docs/RETRO.md`), `LICENSE` và hướng dẫn đóng gói Release `v1.0.0`.

---

## Phase 3 — Contract v1.2: Nhiên liệu đèn & Sinh tồn Bình minh

### Thay đổi
- Đêm 1/2/3 rút ngắn còn 240/270/300 giây; bỏ điều kiện thắng sớm `all_lit`, thay bằng thắng `dawn_survived` khi bình minh tới và giữ được ít nhất 60% số đèn còn sáng.
- Đèn sáng tự hao dầu (1 đơn vị/giây), có thể cạn dầu tắt ngúm, châm dầu nạp thêm và thắp lại sau khi tắt.
- Bóng Mực có trạng thái `drain` hút dầu đèn yếu (<30); vùng an toàn chỉ bảo vệ khi đèn có fuel >= 30.
- Sức chứa túi đom đóm tăng tiến từ 10 lên tối đa 20 theo số lần thắp đèn thành công.
- Cập nhật công thức tính điểm v1.2 và thanh hiển thị dầu trên chao đèn.

---

## Phase 2 — Contract v1.1: Mở rộng Thế giới & Luật chơi

### Thêm mới
- Mở rộng 3 hòn đảo: Đảo Bến (Đêm 1), Hai đảo cầu tre (Đêm 2) và Đảo tháp chuông (Đêm 3).
- Bục nhảy vàng tự động phóng Mây qua khoảng cách lớn; bùa gió tăng tốc và bỏ hồi chiêu lướt; gió thổi định kỳ.
- Kẻ địch mới Gió Lạc bay cướp đom đóm; cơ chế rơi đồ khi bị va chạm hoặc rơi khỏi đảo.
- Hệ thống âm thanh procedural tổng hợp bằng Web Audio API trong `src/audio.js`.
- Menu tạm dừng (Esc/P), cài đặt âm lượng và độ nhạy chuột lưu `localStorage`.

---

## Phase 1 — Contract v1.0: Nền tảng Ban đầu (PRD-0)

### Thêm mới
- Khởi tạo kiến trúc mô phỏng vật lý 60 Hz độc lập hiển thị trong `src/simulation.js`.
- CLI headless chuẩn xác thực tất định theo Test Contract (`src/headless.js`).
- Dựng hình học 3D Three.js cho nhân vật Mây (áo nâu, nón lá, đèn nhỏ), 5 Đèn Lồng lớn, đom đóm và Bóng Mực.
- Các cơ chế lõi: di chuyển, nhảy, nhặt đom đóm, nạp đèn, tỏa sáng làm choáng/đẩy lùi, mất máu khi chạm quái.
- Thiết lập hệ thống kiểm thử tự động `npm run verify` và GitHub Actions CI.
