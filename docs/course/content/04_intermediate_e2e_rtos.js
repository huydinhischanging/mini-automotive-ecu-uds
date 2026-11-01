// Intermediate, chapters 6-7: E2E protection and FreeRTOS on the Control ECU.
module.exports = {
  level: { id: 'intermediate' },
  chapters: [
    {
      id: 'c06', t: 'Bảo vệ đầu-cuối (E2E)',
      lessons: [
        {
          id: '6.1', t: 'Counter, CRC và bên nhận',
          subs: [
            {
              id: '6.1.1', t: 'Thuật toán CRC-8 SAE J1850', min: 30, pre: ['2.1.1'],
              concepts: [
                ['CRC', 'Cyclic Redundancy Check: số kiểm tra tính từ dữ liệu bằng phép chia đa thức trên GF(2). Dữ liệu đổi một bit → CRC đổi.'],
                ['Đa thức 0x1D', 'x⁸ + x⁴ + x³ + x² + 1, đa thức của SAE J1850 (cũng là của AUTOSAR E2E Profile 1).'],
                ['Init / xor-out', 'Giá trị ban đầu 0xFF và phép XOR cuối 0xFF, giúp phát hiện cả chuỗi toàn số 0.'],
                ['Check value', 'CRC của chuỗi ASCII "123456789": dùng để xác nhận cài đặt đúng. Ở đây là 0x4B.'],
              ],
              goal: `Bạn tự tính được CRC-8 bằng tay cho vài byte, hiểu vì sao cài đặt từng bit chậm hơn bảng tra nhưng được chọn, và kiểm chứng bằng check value.`,
              bg: `XOR là phép cộng không nhớ trong GF(2). Chia đa thức trên GF(2) chỉ gồm dịch trái và XOR. CRC chính là **phần dư** của phép chia đó. Nó phát hiện mọi lỗi một bit, mọi lỗi hai bit trong khung ngắn và mọi chùm lỗi dài không quá 8 bit.`,
              th: `**Input:** mảng byte và độ dài. **Output:** 1 byte CRC.

**Thuật toán từng bit:**
1. ⟦crc = 0xFF⟧ (init).
2. Với mỗi byte: ⟦crc ^= byte⟧, rồi lặp 8 lần: nếu bit cao nhất của ⟦crc⟧ là 1 thì ⟦crc = (crc << 1) ^ 0x1D⟧, ngược lại ⟦crc = crc << 1⟧.
3. Trả ⟦crc ^ 0xFF⟧ (xor-out).

**Độ phức tạp:** thời gian O(8·n) phép dịch/XOR, bộ nhớ O(1). Với n = 7 byte mỗi khung, 100 khung/s → khoảng 5 600 vòng lặp mỗi giây, không đáng kể ở 170 MHz.

**Phương án khác (kiến thức bổ trợ):** bảng tra 256 byte, mỗi byte chỉ một lần tra + XOR (O(n)). Đổi 256 byte flash lấy tốc độ. Project chọn bản từng bit vì nhỏ gọn, dễ kiểm chứng, và tốc độ thừa đủ.`,
              use: `Cùng hàm ⟦Crc8_SaeJ1850⟧ được ⟦E2e_Protect⟧ dùng để tạo byte 7, và ⟦E2e_Check⟧ dùng để kiểm tra. Unit test xác nhận check value 0x4B ({{tests/test_e2e.c@static void test_crc8_check_value}}).`,
              code: [
                { f: 'common/e2e/crc8.c', from: '#define CRC8_POLY', to: 'return (uint8_t)(crc ^ CRC8_XOR_OUT);', hl: ['crc ^= data[i];', 'crc = (uint8_t)((uint8_t)(crc << 1U) ^ CRC8_POLY);'],
                  ex: [['#define CRC8_POLY', 'Đa thức 0x1D (bit x⁸ ngầm định, không cần lưu).'], ['crc ^= data[i];', 'Đưa byte mới vào thanh ghi CRC.'], ['if ((crc & 0x80U) != 0U)', 'Bit cao nhất là 1: "trừ" (XOR) đa thức sau khi dịch.'], ['return (uint8_t)(crc ^ CRC8_XOR_OUT);', 'Đảo toàn bộ bit ở cuối.']] },
                { f: 'tests/test_e2e.c', from: 'static void test_crc8_check_value(void)', n: 6, hl: ['CHECK_EQ(0x4B, Crc8_SaeJ1850(data, 9U));'],
                  ex: [['CHECK_EQ(0x4B, Crc8_SaeJ1850(data, 9U));', 'Check value của danh mục CRC: khớp thì cài đặt đúng chuẩn.'], ['CHECK_EQ(0x00, Crc8_SaeJ1850(NULL, 3U));', 'Con trỏ NULL trả 0 thay vì treo.']] },
              ],
              explain: `Để ý ép kiểu kép ⟦(uint8_t)((uint8_t)(crc << 1U) ^ CRC8_POLY)⟧: dịch trái một ⟦uint8_t⟧ cho ra ⟦int⟧ có thể có bit 8; ép về 8 bit trước khi XOR là đúng ý nghĩa của thanh ghi 8 bit (và đúng MISRA). Dùng công cụ ở phần Minh họa để xem từng bước.`,
              run: ['⟦E2e_Protect⟧ gọi ⟦Crc8_SaeJ1850(frame, 7)⟧.', 'crc = 0xFF; byte 0 vào, 8 bước dịch/XOR.', 'Lặp cho byte 1..6.', 'XOR 0xFF, ghi vào ⟦frame[7]⟧.', 'Bên nhận tính lại trên byte 0..6 và so với byte 7.'],
              fig: { type: 'widget', name: 'crc' },
              figCap: 'Công cụ chạy đúng thuật toán của ⟦crc8.c⟧, in từng bước dịch. Thử check value: phải ra 0x4B.',
              video: { t: 'CRC-8 bằng tay', d: '3:00', goal: 'Hiểu phép chia đa thức bằng XOR.',
                s: ['Thanh ghi 8 bit bắt đầu 0xFF.', 'XOR byte đầu, dịch từng bit; bit cao = 1 thì XOR 0x1D.', 'Lặp cho các byte còn lại.', 'XOR 0xFF cuối cùng.', 'Đổi một bit dữ liệu: CRC khác hoàn toàn.'] },
              pit: [
                ['Quên xor-out hoặc init', 'Cài "gần đúng" vẫn cho ra số, nhưng không khớp bên kia. Luôn kiểm bằng check value.'],
                ['Tính CRC trên cả 8 byte', 'CRC chỉ tính trên byte 0..6; byte 7 là chỗ chứa CRC.'],
              ],
              ex: { task: `Dùng công cụ ở phần Minh họa: tính CRC của ⟦03 E8 05 00 01 00 05⟧, rồi đổi byte đầu thành ⟦83⟧ (lật bit 7, đúng như mode BAD_CRC bạn sẽ viết ở bài [[5.1.4]]). Hai CRC có giống nhau không?`, sol: `Khác nhau. Mọi lỗi một bit đều làm CRC đổi, nên bên nhận chắc chắn trả ⟦E2E_ERR_CRC⟧.` },
              quiz: [
                ['Check value của CRC-8 SAE J1850 trên "123456789" là?', ['0x00', '0x1D', '0x4B', '0xFF'], 2, 'Được kiểm trong ⟦test_crc8_check_value⟧.'],
                ['Độ phức tạp thời gian của cài đặt từng bit cho n byte?', ['O(1)', 'O(n)·8 phép dịch, tức O(n)', 'O(n²)', 'O(256·n)'], 1, 'Mỗi byte đúng 8 vòng; bộ nhớ O(1).'],
              ],
              sum: ['CRC = phần dư phép chia đa thức trên GF(2), cài bằng dịch + XOR.', 'J1850: đa thức 0x1D, init 0xFF, xor-out 0xFF, check 0x4B.', 'Bản từng bit: O(n) thời gian, O(1) bộ nhớ.'],
            },
            {
              id: '6.1.2', t: 'Alive counter và phép trừ modulo 16', min: 20, pre: ['6.1.1'],
              concepts: [
                ['Alive counter', 'Số 0..15 tăng 1 mỗi khung, quay về 0 sau 15.'],
                ['Delta modulo 16', '⟦(new − last) & 0x0F⟧: khoảng cách giữa hai counter, đúng cả khi quay vòng (15 → 0 là +1).'],
                ['Max delta', 'Khoảng cách lớn nhất vẫn chấp nhận: 3, tức mất tối đa 2 khung.'],
              ],
              goal: `Bạn tính được delta cho mọi cặp counter, kể cả khi quay vòng, và biết mỗi giá trị delta dẫn tới trạng thái nào.`,
              bg: `CRC phát hiện dữ liệu hỏng, nhưng **không** phát hiện khung bị mất, bị lặp, hay bên gửi bị treo gửi mãi dữ liệu cũ (CRC của khung cũ vẫn đúng!). Counter giải quyết những trường hợp đó.`,
              th: `Bên gửi: ⟦frame[6] = counter & 0x0F⟧, sau đó ⟦counter = (counter + 1) & 0x0F⟧.

Bên nhận tính ⟦delta = (counter − lastCounter) & 0x0F⟧:

| delta | Ý nghĩa | Trạng thái |
|---|---|---|
| 0 | Khung lặp / bên gửi treo | ⟦E2E_ERR_REPEATED⟧, giữ lastCounter |
| 1 | Bình thường | ⟦E2E_OK⟧ |
| 2–3 | Mất 1–2 khung, vẫn chấp nhận | ⟦E2E_OK_SOME_LOST⟧ |
| 4–15 | Mất quá nhiều hoặc sai thứ tự | ⟦E2E_ERR_WRONG_SEQ⟧, đồng bộ lại theo khung này |

Phép trừ không dấu rồi AND 0x0F tự xử lý quay vòng: last = 15, new = 0 → (0 − 15) & 15 = 1.`,
              use: `⟦E2e_Protect⟧ dùng ở bên gửi cho cả ba khung chu kỳ (0x100, 0x101 của Sensor; 0x200 của Control). Bên nhận Control kiểm 0x100 và 0x101.`,
              code: [
                { f: 'common/e2e/e2e.c', from: 'void E2e_Protect(uint8_t frame[E2E_FRAME_LEN], uint8_t *counter)', to: '*counter = (uint8_t)((*counter + 1U) & E2E_COUNTER_MASK);', hl: ['frame[E2E_COUNTER_BYTE] = (uint8_t)(*counter & E2E_COUNTER_MASK);'],
                  ex: [['frame[E2E_COUNTER_BYTE] =', 'Ghi counter trước…'], ['frame[E2E_CRC_BYTE]     = Crc8_SaeJ1850(frame, E2E_CRC_BYTE);', '…rồi mới tính CRC, để counter cũng được CRC bảo vệ.'], ['*counter = (uint8_t)((*counter + 1U) & E2E_COUNTER_MASK);', 'Tăng và quay vòng 0..15 cho khung sau.']] },
                { f: 'common/e2e/e2e.c', from: '/* Modulo-16 distance, so 15 -> 0 counts as +1. */', to: 'return E2E_ERR_WRONG_SEQ;', hl: ['delta = (uint8_t)((counter - state->lastCounter) & E2E_COUNTER_MASK);'],
                  ex: [['delta = (uint8_t)((counter - state->lastCounter) & E2E_COUNTER_MASK);', 'Khoảng cách modulo 16.'], ['return E2E_ERR_REPEATED;   /* keep lastCounter */', 'Lặp: không cập nhật lastCounter.'], ['state->lastCounter = counter;', 'Các trường hợp khác: khung này thành mốc mới.'], ['/* Too many lost: reject this frame, the next one is judged against it. */', 'Sai thứ tự: bỏ dữ liệu nhưng đồng bộ lại, để khung kế được đánh giá bình thường.']] },
              ],
              explain: `Thứ tự trong ⟦E2e_Protect⟧ quan trọng: counter được ghi **trước** khi tính CRC. Nếu ngược lại, kẻ phá hoại (hoặc lỗi bộ nhớ) đổi counter mà CRC vẫn đúng.`,
              run: ['Khung tới với counter 9, lastCounter = 5.', 'delta = (9 − 5) & 15 = 4 > 3.', 'Trả ⟦E2E_ERR_WRONG_SEQ⟧, lastCounter = 9.', 'Khung kế counter 10: delta 1 → ⟦E2E_OK⟧.'],
              fig: { type: 'widget', name: 'e2e' },
              figCap: 'Nhập một dãy counter (thêm "x" cho khung CRC sai) và xem trạng thái từng khung, đúng logic của ⟦E2e_Check⟧.',
              video: { t: 'Đồng hồ 16 giờ', d: '1:30', goal: 'Hình dung phép trừ modulo.',
                s: ['Vòng tròn 0..15 như mặt đồng hồ.', 'Từ 15 sang 0: đi một nấc theo chiều kim.', 'Từ 5 sang 9: bốn nấc → mất 3 khung.', 'Bảng delta → trạng thái.'] },
              pit: [
                ['Tính delta bằng số có dấu', '⟦0 − 15 = −15⟧ sai ý nghĩa. Phải AND 0x0F trên số không dấu.'],
                ['Cập nhật lastCounter khi khung lặp', 'Khung lặp liên tục sẽ luôn được coi là "mới". Project giữ nguyên lastCounter.'],
              ],
              ex: { task: `Tính trạng thái cho dãy counter: ⟦13 14 15 0 2 2 7⟧ (khung đầu là khung đầu tiên sau khởi động). Kiểm bằng công cụ.`, sol: `13 INITIAL; 14 OK; 15 OK; 0 OK (delta 1); 2 OK_SOME_LOST (delta 2); 2 ERR_REPEATED; 7 ERR_WRONG_SEQ (delta 5).` },
              quiz: [
                ['lastCounter = 14, counter mới = 1. Delta và trạng thái?', ['13, WRONG_SEQ', '3, OK_SOME_LOST', '1, OK', '0, REPEATED'], 1, '(1 − 14) & 15 = 3 ≤ 3.'],
                ['Vì sao cần counter khi đã có CRC?', ['Để tính CRC nhanh hơn', 'CRC không phát hiện khung mất, lặp hay bên gửi bị treo', 'Bắt buộc của CAN', 'Để mã hóa dữ liệu'], 1, 'Khung cũ gửi lại vẫn có CRC đúng.'],
              ],
              sum: ['Counter 4 bit ở byte 6, tăng mỗi khung.', '⟦delta = (new − last) & 0x0F⟧ xử lý quay vòng.', '0 lặp · 1 OK · 2–3 mất ít · ≥ 4 sai thứ tự.'],
            },
            {
              id: '6.1.3', t: 'E2e_Check: thứ tự kiểm tra, trạng thái và hồi phục lỗi', min: 25, pre: ['6.1.2'],
              concepts: [
                ['CRC trước counter', 'Khung CRC sai không được chạm vào trạng thái counter.'],
                ['Đồng bộ lần đầu', 'Khung đầu sau khởi động hoặc reset chỉ để lấy mốc: ⟦E2E_INITIAL⟧, vẫn dùng được.'],
                ['Healing', 'Lỗi E2E chỉ được xóa sau 10 khung tốt liên tiếp, chống bật tắt liên tục.'],
                ['Profile 1 (so sánh)', 'AUTOSAR E2E Profile 1 còn đưa Data ID vào CRC để phát hiện khung sai nguồn; project không làm phần này.'],
              ],
              goal: `Bạn đọc được trọn ⟦E2e_Check⟧, giải thích từng quyết định thứ tự, và nối nó với logic hồi phục ở Control ECU.`,
              bg: `ISO 26262 liệt kê các lỗi truyền thông cần phát hiện cho tín hiệu an toàn: lặp, mất, trễ, chèn, giả mạo/sai địa chỉ, sai thứ tự, hỏng dữ liệu. E2E (counter + CRC) cùng với timeout phủ phần lớn danh sách này.`,
              th: `Thứ tự trong ⟦E2e_Check⟧:
1. Tham số NULL hoặc khung ngắn hơn 8 byte → ⟦E2E_ERR_LENGTH⟧.
2. **CRC sai → ⟦E2E_ERR_CRC⟧**, không đụng trạng thái (byte counter trong khung hỏng không đáng tin).
3. Chưa đồng bộ → lưu counter làm mốc, ⟦E2E_INITIAL⟧.
4. Tính delta và phân loại ([[6.1.2]]).

Ở Control ECU (⟦HandleSpeedFrame⟧):
- Trạng thái hợp lệ → cập nhật tốc độ, thời điểm khung hợp lệ cuối, tăng ⟦goodStreak⟧ (tối đa 10); khi đã đủ 10 thì khung tốt tiếp theo xóa ⟦e2eError⟧.
- Không hợp lệ → **bỏ dữ liệu**, ⟦e2eError = true⟧, ⟦goodStreak = 0⟧.

**Phủ lỗi:** hỏng → CRC; lặp → delta 0; mất, sai thứ tự → delta; trễ hoặc mất hẳn → timeout 100 ms. **Chưa phủ:** giả mạo/sai địa chỉ (không có Data ID).`,
              use: `Soft reset (⟦11 03⟧) gọi ⟦E2e_InitRx⟧ để đồng bộ lại ({{control_ecu/CM4/Core/App/control_app.c@void ControlApp_SoftReset(void)}}).`,
              code: [
                { f: 'common/e2e/e2e.c', from: 'E2e_Status_t E2e_Check(E2e_RxState_t *state', to: 'return E2E_INITIAL;', hl: ['return E2E_ERR_CRC;', 'return E2E_INITIAL;'],
                  ex: [['return E2E_ERR_LENGTH;', 'Phòng thủ: khung ngắn không đủ chỗ cho counter và CRC.'], ['/* CRC first: a corrupted frame must never touch the counter state. */', 'Quyết định quan trọng nhất của hàm, có comment giải thích.'], ['if (!state->synced)', 'Khung đầu: lấy mốc, không có gì để so.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'static void HandleSpeedFrame(const CanDrv_Frame_t *frame)', to: '(void)osMutexRelease(s_viewMutex);', hl: ['if (E2e_IsValid(status))', 's_view.e2eError = false;', 's_view.e2eError   = true;'],
                  ex: [['if (E2e_IsValid(status))', 'OK, OK_SOME_LOST, INITIAL: dữ liệu dùng được.'], ['s_view.lastValidTick = osKernelGetTickCount();', 'Mốc cho monitor timeout: chỉ khung hợp lệ mới làm "trẻ lại".'], ['s_view.e2eError = false;', 'Chỉ xóa lỗi khi đã có đủ ⟦E2E_HEAL_FRAMES⟧ khung tốt liên tiếp.'], ['s_view.e2eError   = true;   /* data discarded, output keeps last good value */', 'Dữ liệu bị bỏ; Monitor sẽ thấy lỗi E2E và đưa PWM về 0.']] },
              ],
              explain: `Hai tầng tách bạch: ⟦e2e.c⟧ chỉ **phân loại** một khung; ⟦control_app.c⟧ **quyết định chính sách** (bỏ dữ liệu, khi nào xóa lỗi). Đổi chính sách (ví dụ heal sau 20 khung) không cần sửa module E2E.`,
              run: ['Khung 0x100 tới ComRx.', '⟦E2e_Check⟧: CRC sai → ⟦ERR_CRC⟧.', 'Khóa mutex view: ⟦crc++⟧, ⟦e2eError = true⟧, ⟦goodStreak = 0⟧.', 'Monitor (≤ 10 ms sau) thấy ⟦e2eError⟧ → ⟦SPEED_E2E⟧ SET, PWM 0.', 'Sau 11 khung tốt liên tiếp → ⟦e2eError = false⟧ → lỗi cleared, PWM trở lại.'],
              fig: { type: 'flow', nodes: [['Khung 0x100 tới', 'start'], ['dlc < 8?', 'dec'], ['→ ERR_LENGTH', 'bad'], ['CRC tính lại ≠ byte 7?', 'dec'], ['→ ERR_CRC (không đụng trạng thái)', 'bad'], ['Chưa đồng bộ?', 'dec'], ['→ INITIAL (lấy mốc)', 'ok'], 'delta = (counter − last) & 0x0F', ['0 → REPEATED · 1 → OK · 2–3 → SOME_LOST · ≥ 4 → WRONG_SEQ', 'end']] },
              video: { t: 'Khung đi qua E2e_Check', d: '2:00', goal: 'Thứ tự kiểm tra và chính sách hồi phục.',
                s: ['Khung tốt đi thẳng tới OK.', 'Khung hỏng dừng ở CRC.', 'Khung lặp dừng ở delta 0.', 'Control: 10 khung tốt mới xóa lỗi.', 'Bảng phủ lỗi theo ISO 26262.'] },
              pit: [
                ['Xóa lỗi ngay khi có một khung tốt', 'Nhiễu thưa làm lỗi bật tắt liên tục và PWM nhảy. Cần chuỗi khung tốt (healing).'],
                ['Nói project "đúng AUTOSAR Profile 1"', 'Chỉ chung đa thức CRC. Profile 1 có Data ID và state machine đầy đủ hơn. Nói chính xác để không bị bắt bẻ.'],
              ],
              ex: { task: `Với mode BAD_CRC trong bài tập [[5.1.4]] (1 trên 10 khung hỏng), tính ⟦goodStreak⟧ lớn nhất đạt được giữa hai khung hỏng. Lỗi E2E có bao giờ được xóa không?`, sol: `9 khung tốt → ⟦goodStreak⟧ lên tới 9, chưa tới 10 nên không bao giờ xóa. Lỗi giữ liên tục, đúng chủ đích thiết kế ([[5.1.4]]).` },
              quiz: [
                ['Vì sao ⟦E2e_Check⟧ kiểm CRC trước counter?', ['Vì CRC nhanh hơn', 'Vì byte counter trong khung hỏng không đáng tin, không được cập nhật trạng thái', 'Theo thứ tự byte', 'Không lý do'], 1, 'Comment trong code nói rõ.'],
                ['Loại lỗi truyền thông nào project CHƯA phát hiện?', ['Hỏng dữ liệu', 'Lặp khung', 'Giả mạo / sai nguồn (masquerade)', 'Mất khung'], 2, 'Cần Data ID trong CRC như Profile 1.'],
              ],
              sum: ['Thứ tự: độ dài → CRC → đồng bộ → delta.', 'e2e.c phân loại; control_app.c quyết định chính sách.', 'Heal sau 10 khung tốt liên tiếp.', 'Chưa có Data ID: không phát hiện masquerade.'],
            },
          ],
        },
      ],
    },
    {
      id: 'c07', t: 'FreeRTOS trên Control ECU',
      lessons: [
        {
          id: '7.1', t: 'Task, queue, mutex và chu kỳ',
          subs: [
            {
              id: '7.1.1', t: 'Task, độ ưu tiên và trình tự khởi động', min: 25, pre: ['2.3.2'],
              concepts: [
                ['Task', 'Một luồng chạy độc lập với stack riêng; scheduler quyết định task nào chạy.'],
                ['Preemptive scheduling', 'Task ưu tiên cao sẵn sàng chạy sẽ cắt ngang task ưu tiên thấp ngay lập tức.'],
                ['CMSIS-RTOS2', 'API chuẩn của Arm (⟦osThreadNew⟧, ⟦osMessageQueueNew⟧…) bọc quanh FreeRTOS.'],
                ['SysTick', 'Timer của lõi Cortex-M tạo nhịp 1 ms cho scheduler.'],
              ],
              goal: `Bạn biết Control ECU có những task nào, ưu tiên ra sao, và firmware khởi động theo thứ tự nào cho tới khi scheduler chạy.`,
              bg: `Control ECU làm nhiều việc có nhịp khác nhau: nhận khung bất kỳ lúc nào, chạy monitor đúng 10 ms, phục vụ UDS. RTOS cho phép tách thành các task độc lập thay vì nhồi vào một vòng lặp.`,
              th: `| Task | Ưu tiên | Việc |
|---|---|---|
| ⟦ComRx⟧ | AboveNormal | Lấy khung từ queue, E2E, ISO-TP/UDS; chờ queue tối đa 2 ms để timer ISO-TP/UDS vẫn chạy |
| ⟦Monitor⟧ | Normal | Mỗi 10 ms: đánh giá lỗi, DTC, PWM, gửi 0x200, log |
| ⟦defaultTask⟧ | (CubeMX tạo) | Không làm việc của ứng dụng |

Mỗi task 2 KB stack (⟦512U * 4U⟧). ComRx ưu tiên cao hơn vì phải rút queue nhanh; việc của nó ngắn.

**Trình tự trong ⟦main⟧ (production mode):** IPCC + OpenAMP → UART7 (để mọi bước sau in log được) → chỉnh kernel clock FDCAN (**trước** ⟦MX_FDCAN1_Init⟧) → GPIO, FDCAN, TIM1 → ⟦osKernelInitialize⟧ → ⟦ControlApp_Init⟧ (tạo queue, mutex, task) → ⟦osKernelStart⟧ (không bao giờ quay lại).`,
              use: `Bug bring-up đầu tiên của project nằm ngay ở đây: SysTick không tới FreeRTOS nên tick đứng yên ở 0 ([[15.1.1]]). Cách sửa nằm trong vùng USER CODE của ⟦FreeRTOSConfig.h⟧.`,
              code: [
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'static const osThreadAttr_t k_comRxAttr =', to: '};', after: 'static uint32_t s_startTick;', hl: ['.priority = osPriorityAboveNormal'],
                  ex: [['.stack_size = 512U * 4U', 'Stack tính theo byte: 2 KB.'], ['.priority = osPriorityAboveNormal', 'ComRx ưu tiên hơn Monitor (Normal).']] },
                { f: 'control_ecu/CM4/Core/Src/main.c', from: '/* Must precede MX_FDCAN1_Init(): see CanDrv_PrepareKernelClock(). */', to: 'osKernelStart();', hl: ['CanDrv_PrepareKernelClock()', 'if (!ControlApp_Init())', 'osKernelStart();'],
                  ex: [['CanDrv_PrepareKernelClock()', 'Phải chạy trước ⟦MX_FDCAN1_Init⟧, vì HAL khởi tạo FDCAN cần clock đã đúng.'], ['osKernelInitialize();', 'Khởi tạo kernel, chưa chạy task nào.'], ['if (!ControlApp_Init())', 'Ứng dụng tạo queue, mutex và hai task trong vùng USER CODE RTOS_THREADS.'], ['osKernelStart();', 'Scheduler chạy; từ đây code chạy trong các task.']] },
                { f: 'control_ecu/CM4/Core/Inc/FreeRTOSConfig.h', from: '#undef  USE_CUSTOM_SYSTICK_HANDLER_IMPLEMENTATION', n: 2, hl: ['#define USE_CUSTOM_SYSTICK_HANDLER_IMPLEMENTATION 0'],
                  ex: [['#define USE_CUSTOM_SYSTICK_HANDLER_IMPLEMENTATION 0', 'Ghi đè lựa chọn sai của CubeMX, trong vùng USER CODE nên không bị mất khi sinh lại code.']] },
              ],
              explain: `Mọi đối tượng RTOS được tạo **trước** ⟦osKernelStart⟧. Khi scheduler chạy, không còn cấp phát nào nữa ([[2.3.1]]).`,
              run: ['Linux nạp firmware, M4 chạy ⟦main⟧.', 'Khởi tạo IPCC/OpenAMP, UART7, kernel clock FDCAN, ngoại vi.', '⟦osKernelInitialize⟧, rồi ⟦ControlApp_Init⟧ tạo queue 32, 4 mutex, 2 task, khởi động CAN và diag.', '⟦osKernelStart⟧: ComRx chạy trước (ưu tiên cao), chờ queue; Monitor chạy, chờ 10 ms.'],
              fig: { type: 'flow', nodes: [['Linux remoteproc khởi động M4', 'start'], 'MX_IPCC_Init, MX_OPENAMP_Init (production mode)', 'MX_UART7_Init: log có trước mọi thứ', 'CanDrv_PrepareKernelClock: chuyển FDCAN sang HSE', 'MX_GPIO_Init, MX_FDCAN1_Init, MX_TIM1_Init', 'osKernelInitialize', 'ControlApp_Init: queue, mutex, IoDrv, CanDrv, DiagApp, 2 task', ['osKernelStart: scheduler chạy mãi', 'end']] },
              video: { t: 'Từ reset tới scheduler', d: '1:45', goal: 'Thứ tự khởi động và lý do.',
                s: ['Log boot của Control ECU dòng đầu tiên.', 'Vì sao UART khởi động sớm nhất.', 'Vì sao clock FDCAN chỉnh trước MX_FDCAN1_Init.', 'ControlApp_Init tạo task.', 'osKernelStart: ComRx và Monitor bắt đầu.'] },
              pit: [
                ['Tạo task trong một task khác lúc chạy', 'Cấp phát heap lúc chạy, khó dự đoán. Project tạo mọi thứ trước ⟦osKernelStart⟧.'],
                ['Sửa ⟦FreeRTOSConfig.h⟧ ngoài vùng USER CODE', 'Lần sinh code CubeMX sau sẽ xóa mất. Luôn sửa trong ⟦USER CODE BEGIN/END⟧.'],
              ],
              ex: { task: `Nếu đổi ưu tiên ComRx xuống thấp hơn Monitor, chuyện gì có thể xảy ra khi tester gửi request dài trong lúc có 100 khung/s?`, sol: `Monitor chạy mỗi 10 ms và có thể giữ CPU lâu hơn (log, gửi 0x200); khung dồn trong queue. Nếu queue 32 đầy, ISR bỏ khung (⟦qovf⟧ tăng) và ISO-TP có thể mất CF → lỗi sai SN. Ưu tiên hiện tại đảm bảo queue luôn được rút nhanh.` },
              quiz: [
                ['Task nào có ưu tiên cao hơn?', ['Monitor', 'ComRx', 'defaultTask', 'Bằng nhau'], 1, 'ComRx: osPriorityAboveNormal.'],
                ['Vì sao ⟦CanDrv_PrepareKernelClock⟧ phải chạy trước ⟦MX_FDCAN1_Init⟧?', ['Để in log', 'HAL cần FDCAN có clock đúng khi khởi tạo', 'Vì FreeRTOS', 'Không bắt buộc'], 1, 'Xem comment ngay trên dòng gọi.'],
              ],
              sum: ['Hai task ứng dụng: ComRx (AboveNormal), Monitor (Normal).', 'Mọi đối tượng RTOS tạo trước ⟦osKernelStart⟧.', 'Thứ tự khởi động có lý do: log trước, clock FDCAN trước FDCAN.'],
            },
            {
              id: '7.1.2', t: 'Mẫu ISR → queue → task', min: 20, pre: ['7.1.1'],
              concepts: [
                ['Message queue', 'Hàng đợi FIFO của RTOS chứa bản sao dữ liệu; ISR gửi, task nhận và có thể ngủ chờ.'],
                ['Timeout 0 trong ISR', 'ISR không được chờ: nếu queue đầy thì bỏ ngay.'],
                ['Chờ có thời hạn', 'Task chờ queue tối đa N ms rồi làm việc định kỳ dù không có dữ liệu.'],
              ],
              goal: `Bạn hiểu đường đi của một khung từ ngắt FDCAN tới đúng hàm xử lý trong ComRx, và vì sao ComRx chờ queue chỉ 2 ms.`,
              bg: `So với ring buffer ở Sensor ([[2.3.2]]), queue của RTOS thêm một khả năng: task **ngủ** khi không có dữ liệu và được đánh thức ngay khi ISR gửi. CPU không phải hỏi liên tục.`,
              th: `- ISR (⟦OnCanRx⟧): ⟦osMessageQueuePut(s_rxQueue, frame, 0, 0)⟧. Thất bại → ⟦s_rxQueueOverflow++⟧.
- ⟦ComRxTask⟧: vòng lặp vô hạn ⟦osMessageQueueGet(…, 2U)⟧.
  - Có khung → ⟦switch (frame.id)⟧: 0x100 → ⟦HandleSpeedFrame⟧; 0x101 → kiểm E2E, đếm; 0x7E0/0x7DF/0x7E8 → ⟦DiagApp_OnFrame⟧.
  - Hết 2 ms không có khung → vẫn gọi ⟦DiagApp_MainFunction⟧.
- Sau mỗi khung cũng gọi ⟦DiagApp_MainFunction⟧: ISO-TP gửi CF tiếp, kiểm timeout, UDS kiểm S3.

Vì sao 2 ms? ISO-TP cần được gọi đều đặn (STmin tính theo ms, timeout N_Bs/N_Cr) kể cả khi bus im lặng. 2 ms là đủ mịn mà không tốn CPU.`,
              use: `Toàn bộ chẩn đoán chạy trong ngữ cảnh của ComRx. Điều này quan trọng: ⟦uds_server⟧ và link ISO-TP không re-entrant, nên chỉ một task được gọi chúng.`,
              code: [
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'static void ComRxTask(void *argument)', to: ' * Monitoring and output', hl: ['if (osMessageQueueGet(s_rxQueue, &frame, NULL, 2U) != osOK)', 'HandleSpeedFrame(&frame);', 'DiagApp_OnFrame(&frame);'],
                  ex: [['if (osMessageQueueGet(s_rxQueue, &frame, NULL, 2U) != osOK)', 'Chờ tối đa 2 ms.'], ['continue;', 'Hết hạn mà không có khung: vẫn chạy timer chẩn đoán.'], ['case CANID_SENSOR_ALIVE:', 'Khung 0x101 chỉ kiểm E2E và đếm.'], ['DiagApp_OnFrame(&frame);', 'Khung chẩn đoán đi vào ISO-TP.']] },
              ],
              explain: `Một ⟦switch⟧ theo CAN ID là "bộ định tuyến" của ECU. Thêm khung mới là thêm một ⟦case⟧ (và mở filter phần cứng).`,
              run: ['FDCAN nhận 0x100, ngắt, driver gọi ⟦OnCanRx⟧.', '⟦osMessageQueuePut⟧ chép 12 byte ⟦CanDrv_Frame_t⟧ vào queue.', 'FreeRTOS đánh thức ComRx (ưu tiên cao) ngay khi ISR thoát.', '⟦switch⟧ → ⟦HandleSpeedFrame⟧ → E2E, cập nhật view.', '⟦DiagApp_MainFunction⟧, rồi quay lại chờ queue.'],
              fig: { type: 'seq', actors: ['FDCAN', 'OnCanRx (ISR)', 'RX queue', 'ComRxTask', 'HandleSpeedFrame', 'DiagApp'], msgs: [[0, 1, 'ngắt RX'], [1, 2, 'Put, timeout 0'], [2, 3, 'đánh thức, Get'], [3, 4, 'id 0x100'], [4, 3, 'view cập nhật'], [3, 5, 'DiagApp_MainFunction()'], [3, 2, 'Get, chờ ≤ 2 ms']] },
              video: { t: 'Một khung đi qua RTOS', d: '1:30', goal: 'ISR → queue → task.',
                s: ['Ngắt tới, ISR chỉ Put.', 'ComRx đang ngủ trên queue được đánh thức.', 'switch theo ID.', 'Không có khung 2 ms: vẫn chạy timer.'] },
              pit: [
                ['Gọi UDS trực tiếp trong ISR', 'Xử lý request có thể dài, và UDS không re-entrant. Mọi thứ phải qua queue sang ComRx.'],
                ['Chờ queue mãi (⟦osWaitForever⟧)', 'Bus im lặng thì ISO-TP không bao giờ hết timeout và session không bao giờ hết S3.'],
              ],
              ex: { task: `Một khung chiếm bao nhiêu byte trong queue, và queue tốn bao nhiêu RAM?`, sol: `⟦sizeof(CanDrv_Frame_t)⟧ = 2 (id) + 1 (dlc) + 8 (data) = 11, căn lề thành 12 byte. 32 phần tử ≈ 384 byte, cộng chi phí quản lý của FreeRTOS.` },
              quiz: [
                ['ISR gửi vào queue với timeout bao nhiêu?', ['osWaitForever', '2 ms', '0', '10 ms'], 2, 'ISR không bao giờ được chờ.'],
                ['Vì sao ComRx gọi ⟦DiagApp_MainFunction⟧ cả khi không có khung?', ['Để in log', 'Để timer ISO-TP và S3 của UDS vẫn chạy khi bus im lặng', 'Để gửi 0x200', 'Để kiểm E2E'], 1, 'Comment ngay trên lời gọi ⟦osMessageQueueGet⟧.'],
              ],
              sum: ['ISR: Put với timeout 0, đếm overflow.', 'ComRx: Get chờ ≤ 2 ms, switch theo ID.', 'Chẩn đoán chỉ chạy trong ComRx.'],
            },
            {
              id: '7.1.3', t: 'Mutex và dữ liệu dùng chung giữa các task', min: 25, pre: ['7.1.2'],
              concepts: [
                ['Race condition', 'Hai task đọc/ghi cùng dữ liệu xen kẽ nhau, cho kết quả sai tùy thời điểm.'],
                ['Mutex', 'Khóa cho phép đúng một task vào vùng găng tại một thời điểm. Mutex FreeRTOS có kế thừa ưu tiên.'],
                ['Snapshot', 'Chép nhanh dữ liệu dùng chung ra biến cục bộ dưới khóa, rồi xử lý trên bản sao.'],
                ['Re-entrant', 'Hàm an toàn khi được gọi đồng thời từ nhiều luồng. HAL TX của FDCAN không phải vậy.'],
              ],
              goal: `Bạn chỉ ra được 4 mutex của Control ECU, mỗi cái bảo vệ cái gì, và vì sao Monitor chép cả struct thay vì đọc từng trường.`,
              bg: `ComRx ghi tốc độ, Monitor đọc tốc độ. Nếu Monitor đọc giữa lúc ComRx đang ghi dở (tốc độ mới nhưng thời điểm cũ), quyết định timeout sẽ sai. Cần một khóa.`,
              th: `| Mutex | Bảo vệ | Người dùng |
|---|---|---|
| ⟦s_viewMutex⟧ | ⟦SensorView_t s_view⟧ (tốc độ, status, thời điểm, cờ E2E, bộ đếm) | ComRx ghi, Monitor chép, UDS đọc tốc độ |
| ⟦s_txMutex⟧ | ⟦CanDrv_Write⟧ / HAL TX FIFO | Monitor (0x200), ComRx (response UDS) |
| ⟦s_logMutex⟧ | ⟦vprintf⟧ ra UART | Mọi chỗ in log |
| ⟦s_dtcMutex⟧ | Mảng DTC trong ⟦dtc_manager⟧ | Monitor báo kết quả, ComRx (UDS 0x19/0x14) |

**Snapshot:** Monitor khóa, chép ⟦view = s_view⟧ (một phép gán struct), mở khóa, rồi xử lý trên bản sao. Vùng găng chỉ vài µs.

**DTC manager** không biết RTOS: nó nhận hai hàm ⟦lock⟧/⟦unlock⟧ qua ⟦DtcMgr_Init⟧ (dependency injection lần nữa). Trên PC truyền ⟦NULL⟧.`,
              use: `Priority inversion (task thấp giữ khóa, task cao chờ, task giữa chen vào) được giảm nhờ mutex FreeRTOS có kế thừa ưu tiên, và vì mọi vùng găng đều rất ngắn.`,
              code: [
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: '(void)osMutexAcquire(s_viewMutex, osWaitForever);', after: 'static void MonitorTask(void *argument)', n: 3, hl: ['view = s_view;'],
                  ex: [['view = s_view;', 'Chép cả struct dưới khóa: mọi trường trong bản sao nhất quán với nhau.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'bool ControlApp_CanSend(uint16_t id', to: 'return ok;', hl: ['/* HAL_FDCAN_AddMessageToTxFifoQ is not re-entrant: serialise both tasks. */'],
                  ex: [['/* HAL_FDCAN_AddMessageToTxFifoQ is not re-entrant: serialise both tasks. */', 'Hai task cùng gửi CAN: phải tuần tự hóa.'], ['ok = (CanDrv_Write(&frame) == CANDRV_OK);', 'Vùng găng chỉ gồm lời gọi driver.']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'static void DtcLock(void)', n: 2, hl: ['static void DtcLock(void)'],
                  ex: [['static void DtcLock(void)', 'Hàm khóa truyền cho ⟦DtcMgr_Init⟧: DTC manager gọi nó mà không biết đó là FreeRTOS.']] },
              ],
              explain: `Cùng một nguyên tắc ở cả bốn chỗ: **vùng găng thật ngắn**, không bao giờ gọi hàm chậm (printf, chờ) khi đang giữ khóa của người khác.`,
              run: ['ComRx nhận khung hợp lệ → khóa view, ghi 5 trường, mở khóa.', 'Monitor tới chu kỳ → khóa view, chép struct, mở khóa.', 'Monitor xử lý bản sao; ComRx có thể ghi tiếp ngay.', 'Monitor gọi ⟦DtcMgr_ReportResult⟧ → ⟦DtcLock⟧/⟦DtcUnlock⟧ bên trong.', 'Monitor gửi 0x200 → ⟦ControlApp_CanSend⟧ khóa TX.'],
              fig: { type: 'seq', actors: ['ComRx', 's_viewMutex', 's_view', 'Monitor'], msgs: [[0, 1, 'Acquire'], [0, 2, 'ghi speed, lastValidTick…'], [0, 1, 'Release'], [3, 1, 'Acquire'], [3, 2, 'view = s_view (chép)'], [3, 1, 'Release'], [3, 3, 'xử lý bản sao: monitor, PWM']] },
              video: { t: 'Race condition và cách tránh', d: '2:00', goal: 'Thấy dữ liệu "nửa cũ nửa mới".',
                s: ['Không khóa: Monitor đọc speed mới, lastValidTick cũ.', 'Kết quả: tính sai tuổi khung.', 'Có khóa + snapshot: bản sao nhất quán.', 'Bốn mutex của Control ECU.'] },
              pit: [
                ['Giữ ⟦s_viewMutex⟧ trong lúc in log', 'ComRx bị chặn hàng ms, queue dồn. Monitor in log từ bản sao, sau khi đã mở khóa.'],
                ['Gọi ⟦DtcMgr_…⟧ từ ISR', 'Hàm lock dùng ⟦osMutexAcquire(osWaitForever)⟧, không được phép trong ISR.'],
              ],
              ex: { task: `⟦ControlApp_GetSpeedX10⟧ được UDS (DID 0x0100) gọi từ ComRx. Nó có cần mutex không, khi chính ComRx là bên ghi tốc độ?`, sol: `Có. Monitor cũng đọc ⟦s_view⟧ và về nguyên tắc hàm có thể được gọi từ task khác. Hàm hiện khóa ⟦s_viewMutex⟧, chi phí nhỏ và an toàn nếu sau này có người gọi từ chỗ khác.` },
              quiz: [
                ['Vì sao cần ⟦s_txMutex⟧?', ['Vì CAN chậm', 'Vì hàm thêm khung vào TX FIFO của HAL không re-entrant mà hai task cùng gửi', 'Để tiết kiệm RAM', 'Cho log'], 1, 'Comment trong ⟦ControlApp_CanSend⟧.'],
                ['DTC manager khóa dữ liệu bằng cách nào mà vẫn chạy được trên PC?', ['Dùng FreeRTOS trực tiếp', 'Nhận hàm lock/unlock qua DtcMgr_Init, trên PC truyền NULL', 'Không khóa', 'Dùng volatile'], 1, 'Dependency injection.'],
              ],
              sum: ['4 mutex: view, TX, log, DTC.', 'Snapshot dưới khóa, xử lý ngoài khóa.', 'Vùng găng ngắn, không printf/chờ khi giữ khóa.', 'DTC manager nhận lock qua con trỏ hàm.'],
            },
            {
              id: '7.1.4', t: 'Monitor task: chu kỳ 10 ms, năm monitor và safe state', min: 30, pre: ['7.1.3', '6.1.3'],
              concepts: [
                ['osDelayUntil', 'Ngủ tới một thời điểm tuyệt đối; chu kỳ không bị trôi theo thời gian xử lý.'],
                ['Monitor', 'Đoạn code đánh giá một điều kiện lỗi mỗi chu kỳ và báo kết quả (pass/fail).'],
                ['Startup grace', 'Không báo timeout trong 500 ms đầu khi chưa từng nhận khung, để Sensor kịp khởi động.'],
                ['Fault mask', 'Byte gộp 5 cờ lỗi, gửi trong 0x200 và DID 0x0101.'],
              ],
              goal: `Bạn đọc được trọn ⟦MonitorTask⟧: từng monitor tính thế nào, khi nào output về 0, và vì sao mọi kết quả (cả pass) đều được báo cho DTC manager.`,
              bg: `Phát hiện lỗi trong ECU thường là **định kỳ**: mỗi chu kỳ kiểm một điều kiện. Chu kỳ phải đều, nếu không thời gian phát hiện lỗi không còn đảm bảo.`,
              th: `**Chu kỳ chính xác:** ⟦next += 10; osDelayUntil(next);⟧. Khác ⟦osDelay(10)⟧ (đếm từ lúc gọi, cộng dồn thời gian xử lý).

**Năm monitor (mỗi 10 ms, trên bản sao view):**
| Lỗi | Điều kiện | Cắt output? |
|---|---|---|
| SPEED_TIMEOUT | tuổi khung > 100 ms (sau thời gian chờ khởi động 500 ms nếu chưa từng nhận) | Có |
| SPEED_RANGE | đã nhận và tốc độ > 2500 | Có |
| SPEED_E2E | ⟦e2eError⟧ | Có |
| SENSOR_ADC | bit ADC_ERROR trong status | Không (chỉ DTC) |
| OUTPUT_LOCAL | nút USER1 bật lỗi giả lập | Có |

**Báo mọi kết quả:** vòng ⟦for⟧ gọi ⟦DiagApp_ReportFault(i, s_faults[i])⟧ cho cả 5, kể cả khi pass. DTC manager cần kết quả pass để tắt bit testFailed, xóa bit "chưa test", và reset bộ đếm debounce ([[10.1.2]]).

**Safe state:** có lỗi tốc độ hoặc lỗi output → duty = 0; ngược lại duty = speed × 1000 / 2500.

**Thời gian phát hiện timeout:** 100 ms + tối đa 10 ms chu kỳ → 100–110 ms. Log M4: Sensor ngừng lúc 39,7 s, Control báo lúc 39,8 s.`,
              use: `Mỗi 100 ms Monitor gửi 0x200 (fault mask, số DTC confirmed, duty) có E2E; mỗi 1 s in log ([[1.2.1]]).`,
              code: [
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'static void MonitorTask(void *argument)', to: 'LogStatus(&view, ageMs, duty);', hl: ['(void)osDelayUntil(next);', 'DiagApp_ReportFault(i, s_faults[i]);', 'duty = speedFault ? 0U'],
                  ex: [['next += MONITOR_PERIOD_MS;', 'Mốc tuyệt đối tăng đều 10 ms.'], ['ageMs = view.received ? (now - view.lastValidTick) : (now - s_startTick);', 'Tuổi khung: tính từ khung hợp lệ cuối, hoặc từ lúc khởi động nếu chưa từng nhận.'], ['(view.received || ((now - s_startTick) > STARTUP_GRACE_MS)));', 'Chờ khởi động 500 ms trước khi báo timeout lần đầu.'], ['DiagApp_ReportFault(i, s_faults[i]);', 'Báo cả pass lẫn fail cho DTC manager.'], ['duty = speedFault ? 0U', 'Safe state: không bao giờ điều khiển bằng dữ liệu cũ hoặc vô lý.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'static void SetFault(Fault_t fault, bool active)', n: 8,
                  ex: [['if (s_faults[fault] != active)', 'Chỉ in log khi trạng thái đổi, không in lặp mỗi 10 ms.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'static void SendStatusFrame(uint16_t duty)', to: '(void)ControlApp_CanSend(CANID_CONTROL_STATUS, data, CONTROL_STATUS_DLC);', hl: ['E2e_Protect(data, &counter);'],
                  ex: [['static uint8_t counter = 0U;', 'Counter E2E riêng cho khung 0x200, giữ giữa các lần gọi nhờ ⟦static⟧ cục bộ.'], ['E2e_Protect(data, &counter);', 'Control ECU cũng bảo vệ khung nó gửi.']] },
              ],
              explain: `Để ý SENSOR_ADC **không** nằm trong ⟦speedFault⟧: Sensor vẫn gửi giá trị tốt cuối cùng khi ADC lỗi, nên đó là lỗi cần ghi nhận nhưng chưa cần cắt output. Đây là một quyết định thiết kế, không phải sơ suất.`,
              run: ['Thức dậy ở mốc ⟦next⟧, chép view dưới khóa.', 'Tính tuổi khung; đánh giá 5 monitor qua ⟦SetFault⟧ (log khi đổi).', 'Báo 5 kết quả cho DTC manager.', 'Tính duty, ⟦IoDrv_SetPwm(duty)⟧; ⟦CanDrv_MainFunction⟧.', 'Mỗi 10 chu kỳ gửi 0x200; mỗi 100 chu kỳ in log; ngủ tới mốc kế.'],
              fig: { type: 'flow', nodes: [['osDelayUntil(next): đúng mỗi 10 ms', 'start'], 'Snapshot view dưới s_viewMutex', 'Tuổi khung > 100 ms? (sau 500 ms khởi động) → SPEED_TIMEOUT', 'Tốc độ > 250,0? → SPEED_RANGE · e2eError? → SPEED_E2E', 'Bit ADC_ERROR? → SENSOR_ADC · USER1? → OUTPUT_LOCAL', 'DiagApp_ReportFault × 5 (pass và fail)', ['Lỗi tốc độ hoặc output? → PWM 0 % (safe state)', 'bad'], ['Còn lại → PWM = tốc độ / 250 km/h', 'ok'], ['mỗi 100 ms: 0x200 · mỗi 1 s: log', 'end']] },
              video: { t: 'Một chu kỳ của Monitor task', d: '2:00', goal: 'Từng monitor và safe state.',
                s: ['osDelayUntil vs osDelay trên trục thời gian.', 'Năm monitor đánh giá trên bản sao view.', 'Báo cả pass cho DTC manager.', 'Rút dây: tuổi khung vượt 100 ms, PWM về 0.', 'Log: SPEED_TIMEOUT SET.'] },
              pit: [
                ['Dùng ⟦osDelay(10)⟧', 'Chu kỳ thật là 10 ms + thời gian xử lý, trôi dần; thời gian phát hiện lỗi không còn chắc chắn.'],
                ['Chỉ báo DTC khi fail', 'DTC manager không bao giờ biết test đã pass: bit testFailed không tắt, debounce không reset. Project báo mọi kết quả.'],
                ['Không có thời gian chờ khởi động', 'Control khởi động trước Sensor sẽ ghi DTC timeout ngay lúc bật nguồn.'],
              ],
              ex: { task: `Sensor gửi khung cuối lúc t = 1000 ms. Monitor chạy ở các mốc 1005, 1015, … Ở mốc nào ⟦SPEED_TIMEOUT⟧ được SET?`, sol: `Điều kiện là tuổi > 100 ms. Ở 1095 tuổi 95, 1105 tuổi 105 > 100 → SET ở mốc 1105, tức 105 ms sau khung cuối (nằm trong khoảng 100–110 ms).` },
              quiz: [
                ['Lỗi nào KHÔNG làm PWM về 0?', ['SPEED_TIMEOUT', 'SPEED_E2E', 'SENSOR_ADC', 'OUTPUT_LOCAL'], 2, '⟦speedFault⟧ không gồm SENSOR_ADC.'],
                ['Vì sao Monitor báo cả kết quả pass cho DTC manager?', ['Để in log', 'Để tắt testFailed, xóa bit chưa test và reset bộ đếm debounce', 'Vì MISRA', 'Không cần thiết'], 1, 'Xem [[10.1.2]].'],
              ],
              sum: ['⟦osDelayUntil⟧: chu kỳ 10 ms không trôi.', '5 monitor trên bản sao view; báo mọi kết quả cho DTC.', 'Lỗi tốc độ/output → PWM 0 %.', 'Phát hiện timeout trong 100–110 ms.'],
            },
          ],
        },
      ],
    },
  ],
};
