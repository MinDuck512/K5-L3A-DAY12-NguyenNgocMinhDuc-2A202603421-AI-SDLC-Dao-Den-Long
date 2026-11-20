# Tiến độ và bằng chứng

## Phạm vi đã nhận

- Theo yêu cầu của người dùng: làm từng bước, bám đề, không thêm file hoặc tính năng không cần thiết.
- Làm lần lượt Checkpoint 0, rồi Phase 1 theo tài liệu đã công bố. Không triển khai ticket chưa được đọc.
- Nguồn: sáu tài liệu lab trong repo và PRD-0/Test Contract v1.0 tại https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW.

## Quyết định chuẩn bị

- JavaScript + Three.js, Vite, Node.js >=22.12: máy có sẵn Node, bản web phù hợp bàn giao macOS/Linux; chưa cài thêm engine.
- `src/simulation.js` độc lập hiển thị, dùng đồng hồ cố định 60 tick/giây cho web và Node.
- Cảnh thử một đèn trên đảo chỉ dùng kiểm tra WebGL. Lệnh headless CP0 chỉ kiểm tra môi trường; chưa khai báo đáp ứng Test Contract.
- Chưa chọn thông số gameplay, chưa tạo `game.contract.json` để tránh khai báo các cơ chế chưa tồn tại.
- Giữ nguyên tài liệu lab, thêm hướng dẫn chạy hiện tại ở đầu README.

## Kiểm chứng CP0

Thực hiện ngày 20/11/2026 trên Windows, Node.js 24.21.0, npm 11.19.0.

| Kiểm tra | Kết quả thực tế |
|---|---|
| `npm run verify` | Đạt: kiểm tra cú pháp ba module, chạy headless 60 tick, build bằng Vite 8.3.8; mã thoát 0 |
| Headless 60 tick | `{"mode":"environment-check","ticks":60,"simulated_seconds":1}` |
| Headless 0 tick | Đạt: mã thoát 0, tick cuối là 0 |
| Chạy lại cùng 60 tick | Đạt: stdout giống hệt nhau |
| `--ticks` âm, thập phân, không phải số, vượt số nguyên an toàn | Đạt: mã thoát 2, thông báo ra stderr, stdout rỗng |
| `--out` | Đạt: file ghi ra giống stdout của cùng lần chạy 60 tick |
| Bản sao sạch không có `node_modules`/`dist` | Đạt: sao chép các file nguồn và lockfile sang thư mục tạm, `npm ci --offline --no-audit --no-fund`, sau đó `npm run verify` trả mã 0; đã xóa thư mục tạm của lần kiểm tra thành công |
| HTTP dev server | Đạt: `http://127.0.0.1:5173/` trả 200 |
| Giao diện thật | Đạt: quan sát bằng trình duyệt thấy đảo tròn, một đèn phát sáng, trạng thái WebGL đang chạy và tick tăng tới 450 |

Đây là kiểm chứng môi trường, không phải test gameplay. Bản sao sạch được tạo từ file đang sửa, chưa phải clone từ một commit/tag đã phát hành. Bằng chứng hiện là kết quả lệnh và quan sát ghi trong bảng; chưa có bằng chứng Phase 1.

Vite cảnh báo bundle JavaScript 536,10 kB trước gzip (133,25 kB sau gzip); build vẫn thành công. Chưa có ngưỡng hiệu năng nào của ticket sau được áp dụng.

Sự cố khi chuẩn bị: mạng/cache trong sandbox làm preview và cài offline lần đầu thất bại. Khởi động lại dev server với quyền mạng localhost và dùng đúng cache của lần cài đã khắc phục; không đổi cấu hình bảo mật của máy. Lần kiểm tra CLI đầu tiên vấp lỗi dọn thư mục tạm trong lệnh kiểm tra; sửa lệnh dọn thư mục và chạy lại toàn bộ nhóm kiểm tra đó đạt.

## Những việc cần thông tin hoặc thuộc phase sau

- Phase 2–4 đang khóa trên lab board khi kiểm tra lại sau phần triển khai Phase 1. Không tự đoán nội dung ticket.
- Chưa có Release/video cuối cùng hoặc LICENSE cho bản phát hành. Đây là các việc bàn giao cuối; không đánh dấu đã hoàn thành.
- Chưa kiểm chứng trực tiếp trên macOS/Linux. Đã cấu hình CI Ubuntu; chưa coi CI là đã xanh khi chưa có kết quả GitHub.
- Đăng nhập/hỏi trợ giảng Claude và giờ bắt đầu/hạn cụ thể do Coach thông báo chưa được xác nhận. Không tự đặt mốc giờ hoặc sửa ngày của tag.

## Kế hoạch Phase 1 (ghi trước khi triển khai)

1. Logic dùng chung cho web và headless, thông số đọc từ `game.contract.json`.
2. Kiểm tra input/scenario, CLI và JSONL đúng Test Contract v1.0.
3. Test cơ chế riêng, scenario thắng/thua và kiểm tra output tất định.
4. Giao diện 3D: Mây đội nón lá có đèn nhỏ, 5 đèn lớn, đom đóm, Bóng Mực; HUD, chơi lại và sáng dần.
5. Chạy kiểm chứng thật, cập nhật bằng chứng/README; chỉ gắn tag khi đã đủ bàn giao.

### Giả định PRD-0 chưa quy định

- Thông số gameplay nằm trong `game.contract.json`; đây là lựa chọn triển khai, không phải số do đề bắt buộc. Đảo bán kính 32 m, 5 đèn trên vòng tròn bán kính 20 m, 80 đom đóm ban đầu. Không thêm loại thực thể hoặc màn chơi ngoài đề.
- Mây có 3 ngọn lửa (máu), chạy 6 m/s, chứa tối đa 10 đom đóm; mỗi đèn cần 10. Đứng trong bán kính nhặt sẽ tự nhặt; tương tác một lần nạp tối đa số còn thiếu vào đèn chưa sáng gần nhất.
- Nhảy với vận tốc đầu 6 m/s, trọng lực 18 m/s². Khoảng cách tương tác vẫn tính trên XZ theo contract. Không phạt rơi: chặn người chơi ở mép đảo; `fall_enabled=false`.
- Bị chạm mất 1 ngọn lửa, bất tử 1,5 s, không rơi đom đóm (`hit_drop_ratio=0`). Không có sự kiện rơi khỏi đảo.
- Tỏa sáng tốn 3 đom đóm, bán kính 6 m, choáng 2 s, đẩy 3 m, hồi chiêu 1 s. Một Bóng Mực đang choáng không được cộng thêm điểm choáng khi bị tỏa sáng tiếp.
- Mặc định có 3 Bóng Mực ở rìa, sinh thêm mỗi 12 s, tối đa 8 con. `random_shades=false` tắt sinh ngẫu nhiên. Đom đóm không tự sinh lại; danh sách scenario thay thế danh sách mặc định.
- Thứ tự mỗi tick: di chuyển/nhảy → nhặt → nạp đèn → tỏa sáng → di chuyển và va chạm Bóng Mực → xét kết thúc. Mất hết máu ưu tiên thua; sau đó đủ 5 đèn ưu tiên thắng; sau đó hết thời gian thua do bình minh.
- Điểm: 10 mỗi đom đóm nhặt, 100 mỗi đèn, 5 mỗi lần làm choáng mới; khi thắng cộng phần nguyên giây còn lại và 50 mỗi ngọn lửa còn lại. Không cộng điểm hoặc phát sự kiện trong lúc dựng scenario.
- Hạt giống mặc định khi chơi web là 1. Headless dùng `--seed` được truyền vào; mọi ID và số ngẫu nhiên chỉ lấy từ mô phỏng có seed.

### Tiêu chí và cách nghiệm thu

| Yêu cầu | Kiểm chứng dự kiến |
|---|---|
| Đi lại, nhảy, camera | Test tốc độ/chéo/yaw/nhảy; thao tác trong trình duyệt |
| Nhặt và sức chứa | Scenario ở đúng biên bán kính, vượt sức chứa |
| Nạp, đủ 5 đèn thì thắng | Scenario tương tác bằng cạnh lên; chạy route thắp đủ 5 đèn |
| Bóng Mực, sát thương, bất tử | Scenario vị trí cố định, nhiều tick chạm |
| Tỏa sáng, giá và choáng/đẩy | Scenario đủ/thiếu tài nguyên, hết choáng, giữ nút |
| Bóng Mực sợ đèn | Kiểm tra không vào vùng an toàn của đèn đã sáng |
| Thua, điểm và chơi lại | Scenario hết máu/hết giờ; kiểm tra điểm; chơi lại trong trình duyệt |
| Contract | CLI, snapshot tick 0, thứ tự tick, JSONL, mã lỗi 2, cùng đầu vào cùng output |
| Giao diện/phong cách | Quan sát Mây, nón lá/đèn nhỏ, 5 đèn, đom đóm/Bóng Mực, HUD, ánh sáng thay đổi |

### Kết quả Phase 1

- `npm run verify`: 15/15 test đạt, không bỏ qua test; build thành công. Output thật được lưu tại [proof/verify.txt](proof/verify.txt), không chỉnh sửa kết quả bằng tay.
- Scenario contract [win.json](../tests/scenarios/win.json) + [win.inputs.json](../tests/scenarios/win.inputs.json): nhặt 50 đom đóm, thắp 5 đèn bằng 5 cạnh lên của interact, thắng tick 9, điểm 1449. Output thật: [proof/phase-1.jsonl](proof/phase-1.jsonl). Đây là tình huống kiểm thử có gom vị trí, không phải bản đồ mặc định.
- Test bản đồ mặc định seed 1: di chuyển/nhặt/nạp/tỏa sáng theo logic thật, thắng tại tick 3162 (52,7 giây mô phỏng), còn 3 ngọn lửa, 5 đèn sáng, sử dụng 8 lần tỏa sáng. Không sửa trạng thái game để thắng.
- Contract: test snapshot 0 trước input, đủ N bước, sim_tick, giữ input vắng mặt, seed âm, JSONL/end, lỗi định dạng/mã 2 và output tất định gồm ID.
- Giao diện thật: đã quan sát Mây/nón lá/đèn nhỏ, đom đóm và Bóng Mực; di chuyển W nhặt 2 đom đóm được 20 điểm; E nạp đèn L1 từ 0 lên 2/10, carried về 0; Space nhảy; kéo chuột đổi camera. Đã quan sát mất hết máu, màn thua và nút chơi lại khôi phục 3 ngọn lửa, 5 phút, điểm 0. [Ảnh gameplay thật](proof/phase-1.jpg).
- Đảo sáng dần được triển khai qua ánh sáng từng đèn và ánh sáng nền theo số đèn sáng. Nhánh thắng/thắp đèn/tỏa sáng được kiểm tra tự động; chưa quay video và chưa chơi thắng toàn màn bằng thao tác tay trên trình duyệt.
- Nguồn bằng chứng phải nằm cùng commit với code khi gắn `phase-1`. Hướng dẫn tái lập ở README. Test/build thành công không phải cam kết vượt mọi test ẩn.
- Kiểm tra clone sạch từ commit `2be9295`: `npm ci --offline` rồi `npm run verify` đạt 15/15 và build; chạy lại scenario bằng CLI khớp byte với file đã lưu, SHA-256 `15FF1CE5453243A5B974358B113AF3531484F3186B04E936528FB859396612A1`. Clone tạm được dọn sau khi kiểm tra. Thay đổi sau commit này chỉ bổ sung ghi chép kiểm chứng.
- Trang GitHub đọc không đăng nhập trả HTTP 200 và nhãn Public. Sau khi người dùng báo Coach đã mở Phase 2, tải lại lab board vẫn thấy tab Phase 2 “Chưa phát hành”; đã thông báo cần link cập nhật/trạng thái từ Coach, không vượt khóa hoặc đoán ticket.
- `.gitattributes` giữ nguyên byte các file bằng chứng. Log công cụ có khoảng trắng cuối dòng được giữ nguyên, không sửa tay để làm sạch báo cáo.

### Nhật ký AI và đánh giá

- Công cụ: OpenAI Codex đọc tài liệu, viết mã, chạy npm/test/CLI; computer-use kiểm tra cảnh và điều khiển trên trình duyệt. Không dùng subagent hoặc dịch vụ sinh asset.
- Dùng hướng dẫn Sites cho bản web trong checkout hiện tại; không tạo project hosting, starter hoặc manifest triển khai ngoài repo.
- Lỗi AI/triển khai đã phát hiện: lần sửa đầu có patch trùng thao tác cùng file nên công cụ từ chối, chưa sửa dở file. Một lệnh kiểm tra tạm dùng sai hàm xóa thư mục rỗng, đã sửa và chạy lại. CLI ban đầu không nhận seed âm; thêm test thấy lỗi, chuẩn hóa tham số số âm rồi chạy lại đạt. Kiểm tra giao diện phát hiện phím E rất nhanh bị bỏ lỡ giữa hai tick; thêm hàng đợi nút cho một tick và xác nhận nạp thật 2/10.
- Harness: AGENTS.md ghi phạm vi, lệnh, quy tắc bằng chứng và không bỏ qua test đỏ. `npm run verify` bắt buộc test đạt trước build; CI dùng cùng lệnh trên push/PR. Chưa có người/agent độc lập review; không nhận phần điểm đó như đã đạt.
- Token ước tính thủ công cho lượt chuẩn bị/triển khai: khoảng 30.000–50.000 token nội dung đọc và sinh, sai số lớn, không phải số đo tài khoản. Chi phí chưa xác định. Tiết kiệm bằng dùng một bộ logic/thông số, Node test có sẵn, hai dependency trực tiếp, một file ghi chép; không đoán phase sau hoặc sinh asset ngoài.
- Bài học: đọc contract trước giúp tách mô phỏng khỏi GPU. Test đơn vị không thay được thao tác trình duyệt: lỗi phím nhanh chỉ lộ khi thử thật. Phần cần bổ sung ở lượt sau là ticket mới và kiểm tra hồi quy; video/đo hiệu năng làm theo yêu cầu được công bố.
