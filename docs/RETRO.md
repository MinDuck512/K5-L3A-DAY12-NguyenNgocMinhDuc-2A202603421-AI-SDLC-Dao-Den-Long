# Tổng kết và Đánh giá Dự án (Retrospective)

Dự án: **Đảo Đèn Lồng (AI-Assisted Software Development Life Cycle)**  
Tác giả: **Nguyễn Ngọc Minh Đức (MSSV: 2A202603421)** — Khóa 5 AI SDLC  
Phiên bản bàn giao: **v1.0.0** (Contract **v1.3**)

---

## 1. Tổng hợp Đánh giá (Evaluation) qua 4 Phase

| Phase | Trọng tâm | Thách thức chính | Kết quả đạt được |
|---|---|---|---|
| **Phase 1** (PRD-0, Contract v1.0) | Xây dựng khung game 3D, logic 60 Hz độc lập hiển thị, chế độ headless tất định. | PRD-0 có độ mơ hồ cao có chủ đích; phải đưa ra các giả định hợp lý và quy chuẩn hóa tọa độ/sự kiện. | Hoàn thành bộ core mô phỏng 60 Hz, CLI headless, 15/15 unit test, chụp ảnh UI thật, đạt tính tất định byte-by-byte. |
| **Phase 2** (Ticket-02, Contract v1.1) | Mở rộng 3 hòn đảo (Đêm 1–3), bục nhảy, bùa chú, gió thổi, kẻ địch Gió Lạc và âm thanh tổng hợp. | Luật mới thay thế nhiều giả định Phase 1 (rơi khỏi đảo, recoil, điểm số, cướp đom đóm). | Cập nhật hệ thống không làm gãy kiến trúc cũ; 30/30 unit test pass; Web Audio API tự tổng hợp; đạt >140 FPS. |
| **Phase 3** (Ticket-03, Contract v1.2) | Cơ chế dầu đèn (fuel), Bóng Mực hút dầu (`drain`), thắng tại bình minh (`dawn_survived`). | Đổi toàn bộ điều kiện thắng/thua và hệ thống điểm; quản lý nhiên liệu không tích lũy sai số float. | Sử dụng đơn vị nguyên `1/60 fuelTicks`; test 38/38 pass; hỗ trợ châm dầu/thắp lại, bảng màu dễ phân biệt. |
| **Phase 4** (Ticket-04, Contract v1.3) | Chế độ benchmark, soak test 10 Đêm, bảng xếp hạng cục bộ, trợ năng và đóng gói v1.0.0. | Đo đạc hiệu năng tự động trên máy chấm, kiểm soát rò rỉ bộ nhớ (memory leak), tùy biến phím và UI trợ năng. | 43/43 unit test pass; `bench.json` đạt 143.7 FPS; `soak.json` không crash, RAM tăng <14%; hoàn thành Release v1.0.0. |

---

## 2. Làm việc với AI: Điều hiệu quả và Không hiệu quả

### 2.1. Điều hiệu quả
- **Tách bạch Logic và Hiển thị (Separation of Concerns):** Yêu cầu AI chỉ viết logic trong `src/simulation.js` bằng pure JavaScript, không phụ thuộc DOM/WebGL, giúp AI tạo code cực kỳ chính xác, dễ test và chạy headless trong vài mili-giây.
- **Quy chuẩn hóa Test Contract trước khi code:** Khi đưa input/output schema và kịch bản kiểm thử vào trước, AI sinh code bám sát hợp đồng, không bị "bịa" trường dữ liệu hay sai kiểu dữ liệu.
- **Prompting dạng Checkpoint:** Chia nhỏ từng nhiệm vụ thành các sub-task rõ ràng (nhận ticket -> viết test -> sửa code -> verify thật) thay vì yêu cầu làm toàn bộ một lần.

### 2.2. Điều không hiệu quả
- **Mô tả mơ hồ bằng lời văn:** Nếu chỉ yêu cầu AI "làm camera mượt hơn" hoặc "làm kẻ địch thông minh hơn", AI thường thêm code rườm rà, thậm chí đưa thêm thư viện bên ngoài không cần thiết.
- **Sửa nhiều file cùng lúc không kiểm chứng:** Khi để AI sửa đồng thời logic và UI mà không chạy test trung gian, các lỗi tiềm ẩn (regression) rất dễ bị bỏ qua.

---

## 3. Các lần AI sai và Cách phát hiện, Phòng ngừa

1. **Lỗi nuốt phím nhấn nhanh (Key Drop giữa các tick):**
   * *Phát hiện:* Khi test thủ công trong trình duyệt, phím nhấn rất nhanh bị trôi giữa hai vòng lặp 60 Hz.
   * *Khắc phục:* Bổ sung hàng đợi `pending` để gom sự kiện phím cho từng tick.
2. **Sai số tích lũy của số thực (Floating-point Drift):**
   * *Phát hiện:* Khi chạy 21.600 tick ở Đêm 3, nhiên liệu đèn bị lệch số thập phân do `0.1 + 0.2 != 0.3`.
   * *Khắc phục:* Đưa quy tắc vào `AGENTS.md`: "Nhiên liệu đèn lưu nội bộ theo đơn vị nguyên 1/60, chỉ snapshot mới làm tròn".
3. **Thứ tự xử lý sự kiện trong cùng một tick:**
   * *Phát hiện:* Bóng Mực S10 và S2 cùng va chạm, ID chuỗi sắp xếp sai thứ tự số học (S10 trước S2 thay vì S2 trước S10).
   * *Khắc phục:* Viết hàm `idOrder` tách số và chữ, kiểm thử bằng unit test riêng.

---

## 4. Harness AI nào giúp nhiều nhất?

1. **`AGENTS.md` (Tối quan trọng):**
   * Quy định bất biến: Dùng tick cố định 1/60s; đọc thông số từ `game.contract.json`; kiểm chứng thật bằng `npm run verify`, không được bỏ qua test đỏ; giữ file harness trong Git.
   * Đây là "kim chỉ nam" ngăn AI không đi chệch hướng hay thêm tính năng thừa.
2. **Hệ thống Test Contract & Scenarios JSON:**
   * Các file kịch bản JSON (`tests/scenarios/*.json`) và `npm run verify` đóng vai trò là "lưới an toàn". Mỗi khi AI sửa code, test chạy ngay lập tức; nếu đỏ thì bắt buộc sửa lại trước khi commit.
3. **Quy tắc Clean Clone & Bằng chứng SHA-256:**
   * Việc sao chép ra thư mục tạm và chạy offline đảm bảo code không bị dính môi trường cục bộ hay cache tạm thời.

---

## 5. Thống kê Token, Chi phí và Phương pháp Tiết kiệm

### 5.1. Ước tính sử dụng Token
- **Phase 1 (PRD-0):** ~35.000 – 45.000 tokens (đọc tài liệu lab, sinh mô phỏng core và dựng Three.js ban đầu).
- **Phase 2 (Ticket-02):** ~50.000 – 65.000 tokens (mở rộng 3 hòn đảo, Web Audio API, bục nhảy và kẻ địch).
- **Phase 3 (Ticket-03):** ~20.000 – 28.000 tokens (thay đổi cơ chế nhiên liệu đèn, điều kiện bình minh).
- **Phase 4 (Ticket-04):** ~30.000 – 40.000 tokens (benchmark, soak test, accessibility, bảng xếp hạng, đóng gói).
- **Tổng cộng cả dự án:** ~135.000 – 178.000 tokens. Chi phí ước tính: < $0.30 USD.

### 5.2. Cách tiết kiệm Token hiệu quả
- **Context ngắn gọn:** Giữ `AGENTS.md` dưới 40 dòng, chỉ chứa quy tắc then chốt.
- **Một bộ mã nguồn dùng chung:** `src/simulation.js` phục vụ cả Web và Node headless, không duy trì 2 bộ code.
- **Không dùng asset nhị phân nặng:** Tự tạo hình học Three.js và âm thanh Web Audio bằng mã thuần, không tốn token nạp/xử lý file ngoài.
- **Sửa file có chủ đích:** Dùng công cụ `edit_file` với vùng sửa nhỏ thay vì viết lại cả file lớn.

---

## 6. Nếu làm lại từ đầu thì sẽ thay đổi điều gì?

1. **Quy hoạch Accessibility và Key Rebinding ngay từ Phase 1:** Nếu thiết kế lớp `InputManager` hỗ trợ rebind phím ngay từ đầu thì Phase 4 không cần tái cấu trúc lại object lắng nghe sự kiện phím.
2. **Chuẩn bị sẵn Script đo hiệu năng từ sớm:** Việc đo FPS và bộ nhớ nên được tích hợp vào CI ngay từ Phase 2 để phát hiện sớm các frame drop thay vì đợi đến Phase 4 mới benchmark toàn diện.
3. **Mở rộng kịch bản tự chơi (Auto-play Agent):** Phát triển thêm một bot đơn giản có khả năng tự chơi thắng cả 3 Đêm trên giao diện thật để tự động ghi hình video demo thay vì phải thao tác tay thủ công.
