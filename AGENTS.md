# Hướng dẫn làm việc

- Bám PRD-0 và Test Contract đang được phát hành trên lab board; không đoán ticket chưa mở.
- Làm từng checkpoint. Hiện triển khai Phase 1; xem tiêu chí/giả định trong `docs/progress.md`.
- Chỉ thêm file phục vụ chạy, kiểm chứng hoặc bàn giao theo đề; không thêm tính năng ngoài phạm vi.
- Mô phỏng ở `src/simulation.js` dùng chung cho giao diện và Node; không import DOM/Three.js vào logic.
- Dùng tick cố định 1/60 giây. Đọc thông số từ `game.contract.json`, không khai báo hai bộ thông số.
- Cài: `npm ci`. Chạy web: `npm run dev`. Đóng gói: `npm run build`.
- Kiểm chứng: `npm run verify` phải chạy test thật và build, không được bỏ qua test đỏ.
- Ghi kết quả thật vào `docs/progress.md`; yêu cầu chưa làm phải ghi chưa đạt.
- Giữ file harness trong lịch sử Git. Không tự gắn tag phase khi chưa đủ bàn giao.
- Không commit `node_modules`, `dist`, `.env`, khóa API hoặc output tạm.
