# ADR-001: Nhiên liệu đèn và thắng tại bình minh

## Quyết định

Đèn dùng trạng thái `lit`, `fuelTicks`, `ever_lit`, `deposited` và `relit_count`. `fuelTicks` lưu số nguyên theo đơn vị 1/60 nhiên liệu; snapshot mới đổi sang `fuel` và làm tròn một chữ số. Khi hết dầu, đèn tắt, xóa tiến độ nạp nhưng giữ `ever_lit` để lần sau dùng giá thắp lại 5.

Game không còn kết thúc khi mọi đèn sáng. Sau toàn bộ cập nhật của tick bình minh, mô phỏng ưu tiên thua `no_flames`, rồi thắng `dawn_survived` nếu số đèn còn sáng đạt `ceil(0.6 × tổng đèn)`; nếu không thì thua `dawn`.

## Lý do và hệ quả

Số nguyên tránh sai số tích lũy trong hao dầu/hút dầu. Tách `ever_lit` khỏi `lit` cho phép tắt và thắp lại mà không mất lịch sử. Các test thắng sớm và điểm theo thời gian của v1.1 phải đổi sang fixture bình minh v1.2.
