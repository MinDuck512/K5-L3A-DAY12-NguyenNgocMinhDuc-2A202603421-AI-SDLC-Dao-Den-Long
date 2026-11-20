# Đảo Đèn Lồng — AI SDLC

Bản Phase 2: ba Đêm, bản đồ và thông số chuẩn Ticket-02, Contract **v1.1**. Mây gom đom đóm, thắp các đèn và tránh Bóng Mực/Gió Lạc trước bình minh. Phase 3–4 chưa triển khai. Video/Release cuối cùng chưa có.

## Cài và chạy

Node.js >=22.12, trình duyệt WebGL 2. Hai lệnh trên Windows/macOS/Linux:

```bash
npm ci
npm run dev
```

Mở địa chỉ Local, chọn **Bắt đầu**, đọc lời Ông Đăng rồi **Vào Đêm**. Thắng để sang Đêm tiếp theo; thua được thử lại Đêm hiện tại. Thắng Đêm 3 hiện Bình Minh với tổng điểm các Đêm đã thắng.

| Phím | Hành động |
|---|---|
| WASD / mũi tên | Di chuyển theo camera |
| Kéo chuột | Xoay camera |
| Space | Nhảy khi chạm đất |
| Shift | Lướt 14 m/s trong 0,2 s; hồi 1,5 s |
| E | Nạp vào một đèn chưa sáng gần nhất trong 2 m |
| F | Tỏa Sáng, tốn 3 đom đóm; hồi 3 s |
| Esc / P | Tạm dừng / tiếp tục |

Gom tối đa 10 đom đóm, mỗi đèn cần 10 và nhớ phần đã nạp. Điểm +10/đom đóm **nạp**, +100/đèn, +5/Bóng Mực trúng pulse (kể cả đang choáng); thắng cộng `floor(giây còn lại)*2 + 50*Ngọn Lửa`. Không cộng điểm khi nhặt. Đêm 1/2/3 có 5/6/7 đèn và 300/330/360 giây.

Bục tròn vàng tự phóng Mây qua đảo hoặc lên tầng; cầu tre không có lan can. Bùa đỏ viền vàng tăng tốc và bỏ hồi chiêu lướt trong 10 s. Gió Lạc cướp đom đóm; pulse lúc nó đang mang đồ trả lại đồ rơi. Rơi khỏi đảo mất 1 máu và toàn bộ đom đóm, chờ 1 s để hồi sinh. Tạm dừng có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. Âm lượng và độ nhạy được lưu trong trình duyệt.

## Kiểm chứng và headless

```bash
npm run verify
node src/headless.js --seed 1 --night 2 --scenario tests/scenarios/phase-2.json --inputs tests/scenarios/phase-2.inputs.json --ticks 120 --snapshot-every 10 --out output.jsonl
```

CLI hỗ trợ Đêm 1–3, snapshot mỗi 10 tick mặc định, `--seed` âm/dương, `--scenario`, `--inputs`. Logic 60 Hz độc lập DOM/GPU. Input giữ giá trị cũ nếu không được nhắc lại; nút kích hoạt ở cạnh lên. Pause chỉ tăng tick, mọi bộ đếm chạy theo sim_tick. Dữ liệu sai trả mã 2/stderr. Output JSONL có snapshot/event/end và các trường 1.1.

`npm run build` tạo web tĩnh ở `dist/`; `npm run preview` xem bản build. CI trên Ubuntu chạy test rồi build. [Contract và tuning](game.contract.json), [test cơ chế và CLI](tests/phase-2.test.js), [spec/giả định/retro](docs/progress.md).

Đo mẫu 1280×720 đạt trên 140 FPS trên máy kiểm tra; 21.600 tick headless với random/wind tắt chạy khoảng 0,12 s. Đây là kết quả theo cấu hình/kịch bản cụ thể; xem [số đo và cấu hình](docs/proof/phase-2-performance.json), cùng giới hạn kiểm chứng trong ghi chép.

Bằng chứng Phase 2: [test/build](docs/proof/phase-2-verify.txt), [JSONL mẫu](docs/proof/phase-2.jsonl), [Đêm 2](docs/proof/phase-2-night2.jpg), [Đêm 3](docs/proof/phase-2-night3.jpg). Scenario mẫu chỉ phục vụ kiểm thử, không thay bản đồ mặc định. Bằng chứng Phase 1 vẫn ở tag `phase-1`; một số test được cập nhật vì Ticket-02 thay luật, lý do nằm trong ghi chép.

## Sáng tạo của tôi

Chỉ triển khai phần lõi yêu cầu. Hình học và âm thanh được tạo bằng mã, không thêm nhân vật/kẻ địch ngoài đề. Xem [CREDITS.md](CREDITS.md).

---

## Đề bài lab ban đầu


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
