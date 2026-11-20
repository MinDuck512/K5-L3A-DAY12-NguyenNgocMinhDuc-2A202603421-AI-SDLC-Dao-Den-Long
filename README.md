# Day 12 — AI SDLC: Đảo Đèn Lồng

## Bản chơi Phase 1 — Đêm 1: Đảo Bến

Điều khiển Mây gom đom đóm, thắp lại 5 Đèn Lồng Lớn và tránh Bóng Mực trước bình minh. Đã triển khai PRD-0 và Test Contract v1.0; chưa triển khai Ticket-02/03/04 đang khóa trên lab board. Video và Release cuối cùng chưa có.

Yêu cầu: Node.js >=22.12 và trình duyệt hỗ trợ WebGL 2. Cài và chạy trong hai lệnh, dùng được cho Windows/macOS/Linux:

```bash
npm ci
npm run dev
```

Mở địa chỉ Local do Vite in ra và chọn **Bắt đầu**. Bản web được thử trực tiếp trên Windows; CI đã cấu hình Ubuntu, kết quả CI phải xem trên GitHub sau khi push. `npm run build` tạo bản web tĩnh trong `dist/`; `npm run preview` xem bản build.

| Điều khiển | Hành động |
|---|---|
| WASD hoặc mũi tên | Đi theo hướng camera |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn chưa sáng gần nhất trong 2,5 m |
| F | Tỏa sáng: tốn 3 đom đóm, choáng/đẩy Bóng Mực trong 6 m |
| Kéo chuột trên cảnh | Xoay camera |
| Chơi lại | Bắt đầu lại sau thắng/thua |

Nhặt đom đóm tự động trong 1,2 m, chứa tối đa 10; mỗi đèn cần 10. Có 3 ngọn lửa, thời gian 300 giây. Thắp đủ 5 đèn thì thắng; hết máu hoặc hết giờ thì thua. Bóng Mực không vào vùng an toàn 5 m quanh đèn đã sáng. Không phạt rơi khỏi đảo (`fall_enabled=false`), không đánh rơi đom đóm khi trúng đòn (`hit_drop_ratio=0`); người chơi bị chặn ở mép đảo.

Điểm: 10/đom đóm nhặt, 100/đèn thắp, 5/lần làm choáng mới. Khi thắng cộng phần nguyên số giây còn lại và 50/ngọn lửa còn lại. Thông số thực tế đọc từ [game.contract.json](game.contract.json), các giả định khác ở [ghi chép](docs/progress.md).

Chạy toàn bộ test và build: `npm run verify`. CI chạy cùng lệnh mỗi lần push/PR. Kiểm tra headless không mở cửa sổ hoặc dùng GPU:

```bash
node src/headless.js --seed 1 --night 1 --ticks 60 --out output.jsonl
```

Hỗ trợ `--scenario <file.json>`, `--inputs <file.json>`, `--snapshot-every <int>` (mặc định 10). Logic cố định 60 Hz, snapshot từ tick 0, output JSONL gồm snapshot/event/end. Seed âm cũng hợp lệ. Dữ liệu inputs/scenario sai định dạng trả mã 2; lỗi khác trả mã khác 0 và thông báo ở stderr.

Tái lập scenario thắp đủ 5 đèn trong bộ kiểm tra:

```bash
node src/headless.js --seed 1 --night 1 --scenario tests/scenarios/win.json --inputs tests/scenarios/win.inputs.json --ticks 60 --snapshot-every 1 --out output.jsonl
```

Scenario này gom 50 đom đóm và đặt 5 đèn tại cùng một vị trí **chỉ để kiểm thử contract**; bản đồ chơi thật phân bố đèn và đom đóm rải rác. Test khác chạy bản đồ mặc định từ đầu tới thắng qua di chuyển/nhặt/nạp/tỏa sáng.

Bằng chứng: [báo cáo test/build](docs/proof/verify.txt), [output headless](docs/proof/phase-1.jsonl), [ảnh gameplay](docs/proof/phase-1.jpg). Truy vết yêu cầu, giới hạn kiểm chứng và nhật ký AI ở [docs/progress.md](docs/progress.md). Nguồn công cụ và hình học ở [CREDITS.md](CREDITS.md).

## Sáng tạo của tôi

Hiện chỉ triển khai phần lõi PRD-0, chưa thêm cơ chế hoặc thực thể ngoài đề. Nhân vật và cảnh dùng hình học tạo bằng mã; không tải asset bên ngoài.

---

Phần dưới là tài liệu đề bài ban đầu.

> **Cá nhân** (1 người / 1 MSSV) · Áp dụng SDLC cùng AI để xây một **game 3D** qua **4 phase**, từ yêu cầu ban đầu tới bản phát hành.
> **Lab board + trợ giảng:** **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**

---

## Tài liệu của lab

| File | Nội dung |
|---|---|
| [GUIDE.md](GUIDE.md) | Hướng dẫn làm lab: vòng làm việc mỗi phase, harness, kiểm chứng, token |
| [CHECKPOINTS.md](CHECKPOINTS.md) | Các mốc tự kiểm tra từ chuẩn bị đến nộp bài |
| [SUBMISSION.md](SUBMISSION.md) | Đặt tên repo, hạn nộp, tag, Release, video, checklist |
| [RULES.md](RULES.md) | Quy định: AI, trung thực về bằng chứng, bản quyền, bảo mật |
| [RUBRIC.md](RUBRIC.md) | Thang điểm chi tiết |

## Lab board

Yêu cầu dự án được phát hành tại **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**. Mỗi phase là một tab (tab chưa phát hành bị khóa), mỗi tab có trợ giảng AI riêng chỉ trả lời trong phạm vi phase đó. Trợ giảng cần đăng nhập claude.ai và dùng lượt Claude của bạn.

## Dự án

**Đảo Đèn Lồng**: game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen.

- Không ràng buộc công nghệ; chạy được trên macOS hoặc Linux.
- Tuân theo **Test Contract** (chế độ headless) để được chấm tự động và so sánh với nhau.

| Phase | Bạn nhận | Nộp |
|---|---|---|
| 1 | **PRD-0** (mô tả tổng quát) + Test Contract | tag `phase-1` |
| 2 | **Ticket-02**, phát hành khi Phase 1 kết thúc | tag `phase-2` |
| 3 | **Ticket-03**, phát hành khi Phase 2 kết thúc | tag `phase-3` |
| 4 | **Ticket-04**, phát hành khi Phase 3 kết thúc | tag `phase-4` + Release `v1.0.0` |

Yêu cầu sẽ được bổ sung và có thể thay đổi giữa các phase, giống dự án thật.

### Lịch 4 giờ

Bài lab kéo dài **4 giờ**. Phase 1 và 2 khoảng **1 giờ**, Phase 3 khoảng **30 phút**, Phase 4 khoảng **1 giờ 30 phút**. Mỗi phase phát hành đúng mốc giờ. Phase mới xuất hiện trên lab board khi tới mốc.

| Mốc | Sự kiện | Hạn tag |
|---|---|---|
| 0h | Phát hành **Phase 1** (PRD-0), gồm cả phần chuẩn bị | `phase-1` trước mốc 1h |
| 1h | Phát hành **Phase 2** | `phase-2` trước mốc 2h |
| 2h | Phát hành **Phase 3** | `phase-3` trước mốc 2h30 |
| 2h30 | Phát hành **Phase 4** | `phase-4`, Release `v1.0.0` và video trước mốc 4h |
| 4h | Hết giờ lab, chốt bài | |

Hết giờ mỗi phase thì tag và chuyển sang phase tiếp theo, dù phase chưa hoàn hảo. Chỗ chưa xong ghi trung thực trong bằng chứng.

---

## Gợi ý SDLC (cách làm là của bạn)

Mỗi phase là một vòng nhỏ. Công cụ, thứ tự, định dạng tài liệu đều tự do; đây chỉ là gợi ý:

1. **Requirements:** biến yêu cầu thành tiêu chí nghiệm thu kiểm chứng được. Chỗ mơ hồ thì tự giả định và ghi lại.
2. **Plan:** nghĩ cách kiểm chứng **trước** khi để agent viết code.
3. **Build:** để agent viết, bạn điều phối và review.
4. **Verify:** chạy thật, kiểm tra hành vi thật. *Không có bằng chứng thì chưa xong*: "agent bảo chạy rồi" không phải bằng chứng.
5. **Evaluate:** cái gì đạt, AI sai ở đâu, harness (AGENTS.md, skill, hook) cần chỉnh gì.
6. **Release:** gắn tag.

## Ba điều cần nhớ

> Bạn được **tự do sáng tạo thêm** quanh phần lõi (nhân vật, cơ chế nhỏ, câu chuyện, hiệu ứng, âm thanh…). Sáng tạo gọn và không phá yêu cầu được tính điểm trong hạng mục F của [RUBRIC](RUBRIC.md); ghi mục "Sáng tạo của tôi" trong README của bạn.

- **Game tốt là game đúng yêu cầu của khách hàng**, không phải game phức tạp hay đẹp nhất. Làm đúng và chứng minh được là đúng trước, trau chuốt sau.
- **Cân nhắc kỹ quota token của bạn.** Đốt nhiều token không làm bài tốt hơn. Ngữ cảnh gọn, kế hoạch rõ, kiểm chứng sớm thường vừa rẻ vừa đúng hơn chạy agent liên tục.
- **Kiểm chứng là phần quan trọng nhất.** Bằng chứng (test, output headless, ảnh, số đo) đáng giá hơn lời mô tả.

---

## Bàn giao cuối cùng

Một **repo GitHub cá nhân, public**, gồm:

1. **Toàn bộ mã nguồn** của game qua 4 phase, tag `phase-1` … `phase-4`, Release `v1.0.0`.
2. **Video demo `.mp4` dưới 5 phút** (đính kèm Release `v1.0.0` hoặc `docs/demo/demo.mp4`, link ở đầu README): chơi thử và cho thấy bằng chứng game chạy đúng.
3. **Bằng chứng kiểm chứng** của từng phase (định dạng tự chọn).
4. **Harness AI đã dùng** (AGENTS.md / CLAUDE.md, skills, hooks, plugins…), giữ nguyên trong repo và lịch sử git.
5. **Ghi chép ngắn:** spec/giả định mỗi phase, nhật ký dùng AI (gồm token/chi phí ước tính), retro.

Không commit API key, token hay `.env`. Gửi link repo theo hướng dẫn của Coach.

## Đánh giá (100 điểm)

| Hạng mục | Điểm |
|---|---|
| Test tự động ẩn (headless, gồm kiểm tra lại phase trước) | 30 |
| Kiểm chứng & bằng chứng của bạn | 20 |
| Quy trình SDLC & harness AI | 15 |
| Evaluation & retro (gồm cách bạn dùng token) | 10 |
| Hiệu năng & ổn định | 10 |
| Chất lượng sản phẩm (đúng yêu cầu, chơi được) | 10 |
| Video demo | 5 |

## Quy định

- Dùng AI thoải mái; không sao chép repo của người khác.
- Bằng chứng phải thật: test luôn đạt hay output sửa tay là vi phạm.
- Nhân vật, bối cảnh là bản gốc của lab; asset bên ngoài chỉ dùng loại CC0/CC-BY/MIT hoặc tự tạo, ghi nguồn trong `CREDITS.md`.
