// Intermediate, chapters 8-9: ISO-TP transport and the UDS server.
module.exports = {
  level: { id: 'intermediate' },
  chapters: [
    {
      id: 'c08', t: 'ISO-TP (ISO 15765-2)',
      lessons: [
        {
          id: '8.1', t: 'Tách và ghép message dài',
          subs: [
            {
              id: '8.1.1', t: 'Vì sao cần ISO-TP và bốn loại khung', min: 25, pre: ['3.1.2', '2.2.2'],
              concepts: [
                ['ISO-TP', 'Tầng vận chuyển chia message tới 4095 byte thành các khung CAN 8 byte và ghép lại ở bên nhận.'],
                ['PCI', 'Protocol Control Information: nibble cao của byte 0 cho biết loại khung (0 SF, 1 FF, 2 CF, 3 FC).'],
                ['Flow Control', 'Khung bên nhận gửi để cho phép bên gửi tiếp tục, kèm BS và STmin.'],
                ['Padding', 'Byte thừa của khung được điền 0xCC để khung luôn đủ 8 byte.'],
              ],
              goal: `Bạn đọc được byte đầu của mọi khung ISO-TP, tự tách một message bất kỳ thành khung, và biết vì sao response 13 byte cần 3 khung.`,
              bg: `UDS cần gửi message dài hơn 7 byte (ví dụ phiên bản phần mềm 13 byte, danh sách DTC). Khung Classic CAN chỉ có 8 byte. ISO-TP thêm 1–2 byte điều khiển vào mỗi khung để đánh số và điều phối luồng.`,
              th: `| Loại | Byte 0 (PCI) | Nội dung | Ai gửi |
|---|---|---|---|
| SF Single Frame | ⟦0L⟧ (L = 1..7) | tối đa 7 byte | bên gửi |
| FF First Frame | ⟦1L LL⟧ (độ dài 12 bit, 8..4095) | 6 byte đầu | bên gửi |
| CF Consecutive Frame | ⟦2N⟧ (N = số thứ tự 0..15, bắt đầu từ 1) | 7 byte tiếp | bên gửi |
| FC Flow Control | ⟦3S BS STmin⟧ (S: 0 CTS, 1 WAIT, 2 OVFLW) | điều khiển | bên nhận |

**Ví dụ thật** (22 F1 95, response 13 byte):
~~~text
0x7E0  03 22 F1 95 CC CC CC CC   SF: request 3 byte
0x7E8  10 0D 62 F1 95 43 54 52   FF: tổng 0x00D = 13 byte, 6 byte đầu
0x7E0  30 00 00 CC CC CC CC CC   FC: CTS, BS 0, STmin 0
0x7E8  21 4C 2D 30 2E 33 2E 30   CF: SN 1, 7 byte cuối "L-0.3.0"
~~~
Số khung cho n byte: n ≤ 7 → 1; ngược lại 1 FF + ⌈(n − 6) / 7⌉ CF + số FC.`,
              use: `ISO-TP chạy trên cả hai phía: link của ECU trong ⟦diag_app.c⟧ (TX 0x7E8, RX 0x7E0) và link của tester trong ⟦tester_app.c⟧ (ngược lại). Cùng một file ⟦isotp.c⟧.`,
              code: [
                { f: 'common/isotp/isotp.h', from: ' * Splits messages of up to 4095 bytes', to: ' *   FC  Flow Control', hl: [' *   FF  First Frame'],
                  ex: [[' *   SF  Single Frame', 'L là độ dài 1..7, nằm ở nibble thấp của byte 0.'], [' *   FF  First Frame', 'Độ dài 12 bit: 4 bit thấp của byte 0 và cả byte 1.'], [' *   CF  Consecutive Frame', 'N quay vòng 0..15; CF đầu tiên có N = 1.']] },
                { f: 'common/isotp/isotp.c', from: 'void IsoTp_RxFrame(IsoTp_Link_t *link', to: 'break;   /* reserved PCI type: ignore */', hl: ['switch (data[0] >> 4U)'],
                  ex: [['switch (data[0] >> 4U)', 'Nibble cao của byte 0 = loại khung.'], ['case PCI_TYPE_FC:', 'Khung FC thuộc về phía gửi của link: bên nhận cho phép gửi tiếp.'], ['break;   /* reserved PCI type: ignore */', 'Loại 4..15 là dự trữ: bỏ qua.']] },
              ],
              explain: `Một hàm nhận duy nhất ⟦IsoTp_RxFrame⟧ phân loại theo PCI rồi gọi 4 hàm con. FC được xử lý ở phía gửi vì nó là phản hồi cho message mình đang gửi.`,
              run: ['UDS server tạo response 13 byte.', '⟦IsoTp_Transmit⟧: 13 > 7 → gửi FF ⟦10 0D⟧ + 6 byte, chuyển sang chờ FC.', 'Tester nhận FF, gửi FC ⟦30 00 00⟧.', 'ECU nhận FC (CTS), gửi CF ⟦21⟧ + 7 byte.', 'Tester nhận đủ 13 byte, gọi callback ⟦rxIndication⟧.'],
              fig: { type: 'widget', name: 'isotp' },
              figCap: 'Nhập payload (mặc định là response của 22 F1 95), chọn BS/STmin và xem chuỗi khung.',
              video: { t: 'Gửi 13 byte qua khung 8 byte', d: '2:00', goal: 'Đọc byte PCI.',
                s: ['Chuỗi 62 F1 95 "CTRL-0.3.0".', 'FF: 10 0D, 6 byte đầu.', 'FC: bên nhận cho phép.', 'CF: 21 và 7 byte còn lại.', 'Bên nhận ghép lại đủ 13 byte.'] },
              pit: [
                ['Quên padding', 'Một số ECU/tester yêu cầu khung đủ 8 byte. ⟦InitFrame⟧ điền 0xCC trước mỗi khung.'],
                ['Đánh SN của CF đầu là 0', 'CF đầu tiên luôn là 1 (⟦21⟧). SN 0 xuất hiện sau khi quay vòng từ 15.'],
              ],
              ex: { task: `Response 59 02 7F với 3 DTC (mỗi DTC 4 byte) dài bao nhiêu byte và cần những khung nào? Kiểm bằng công cụ.`, sol: `3 + 12 = 15 byte → FF (6 byte) + FC + CF1 (7 byte) + CF2 (2 byte, phần còn lại padding) = 4 khung trên bus.` },
              quiz: [
                ['Byte 0 của khung là ⟦0x23⟧. Đây là khung gì?', ['SF dài 3', 'CF với SN = 3', 'FC WAIT', 'FF'], 1, 'Nibble cao 2 = CF, nibble thấp 3 = SN.'],
                ['Ai gửi khung Flow Control?', ['Bên gửi message', 'Bên nhận message', 'Cả hai', 'FDCAN tự gửi'], 1, 'FC là bên nhận điều phối bên gửi.'],
              ],
              sum: ['ISO-TP: tới 4095 byte trên khung 8 byte.', 'PCI: 0 SF, 1 FF, 2 CF, 3 FC.', 'Response 13 byte = FF + FC + 1 CF.'],
            },
            {
              id: '8.1.2', t: 'Bên gửi: máy trạng thái, block size và STmin', min: 30, pre: ['8.1.1'],
              concepts: [
                ['Block size (BS)', 'Số CF bên gửi được gửi trước khi phải chờ FC tiếp. 0 = không giới hạn.'],
                ['STmin', 'Khoảng cách tối thiểu giữa hai CF, do bên nhận đặt (0..127 ms hoặc 100..900 µs).'],
                ['FC.WAIT', 'Bên nhận xin thêm thời gian; bên gửi chờ tiếp, tối đa WFTmax = 10 lần.'],
              ],
              goal: `Bạn vẽ được máy trạng thái phía gửi và giải thích từng chuyển trạng thái bằng code thật, kể cả xử lý driver bận.`,
              bg: `Bên nhận có thể chậm (buffer nhỏ, CPU bận). Flow Control cho nó quyền điều tốc: "gửi tiếp BS khung, mỗi khung cách nhau ít nhất STmin". Bên gửi phải tuân thủ.`,
              th: `Trạng thái gửi (⟦IsoTp_TxState_t⟧):
- **IDLE** → ⟦IsoTp_Transmit⟧ → **SEND_FIRST** (gửi SF/FF; driver bận thì giữ trạng thái này và thử lại ở MainFunction).
- SF gửi xong → **IDLE**, gọi ⟦txConfirmation(OK)⟧.
- FF gửi xong → **WAIT_FC**, bật timer N_Bs.
- FC CTS → lưu BS, STmin → **SEND_CF** và gửi ngay.
- Trong SEND_CF: gửi CF khi đã qua STmin; đủ BS khung (nếu BS ≠ 0) → **WAIT_FC**; gửi hết → **IDLE** + ⟦txConfirmation(OK)⟧.
- FC WAIT → reset timer (tối đa 10 lần, quá thì ⟦ERR_WFT_OVRN⟧); FC OVFLW → ⟦ERR_OVERFLOW⟧; hết N_Bs → ⟦ERR_TIMEOUT_BS⟧.

**Chi tiết STmin:** với đồng hồ 1 ms, điều kiện ⟦elapsed >= STmin⟧ có thể đúng chỉ sau một phần của ms (gửi lúc x.99, kiểm lúc x+1.00). Code dùng ⟦elapsed <= STmin⟧ để chờ thêm một tick, đảm bảo bên nhận luôn có ít nhất STmin.`,
              use: `ECU gửi response; tester gửi request dài (ví dụ ⟦22⟧ với 3 DID, 7 byte vẫn là SF; 9 byte ở self-test là FF + CF). Self-test của Control đặt BS 2, STmin 1 ms ở phía tester để ép ECU chạy qua nhánh flow control.`,
              code: [
                { f: 'common/isotp/isotp.c', from: 'static bool TxSendFirst(IsoTp_Link_t *link)', to: 'static void TxSendConsecutiveFrames', hl: ['TxFinish(link, ISOTP_OK);', 'link->txState      = ISOTP_TX_WAIT_FC;'] },
                { f: 'common/isotp/isotp.c', from: 'static void TxOnFlowControl(IsoTp_Link_t *link', to: 'TxFinish(link, ISOTP_ERR_INVALID_FS);', hl: ['link->txState      = ISOTP_TX_SEND_CF;', 'TxFinish(link, ISOTP_ERR_WFT_OVRN);'],
                  ex: [['return;   /* unexpected FC is ignored, as required by the standard */', 'FC đến khi không chờ FC: bỏ qua theo chuẩn.'], ['link->txLastCfTime = Now(link) - (link->txStMinMs + 1U);', 'Mẹo: đặt mốc "CF trước" vào quá khứ để CF đầu của block gửi được ngay.'], ['link->txWaitCount++;', 'Đếm số FC.WAIT liên tiếp.']] },
                { f: 'common/isotp/isotp.c', from: 'static void TxSendConsecutiveFrames(IsoTp_Link_t *link)', to: '/* BS = 0: keep sending until STmin or the driver stops us */', hl: ['(Elapsed(link, link->txLastCfTime) <= link->txStMinMs)', 'link->txSeq        = (uint8_t)((link->txSeq + 1U) & SEQ_MASK);'],
                  ex: [['bool keepSending = true;', 'Vòng lặp dùng cờ thay vì hai ⟦break⟧ (sửa theo MISRA 15.4).'], ['(Elapsed(link, link->txLastCfTime) <= link->txStMinMs)', 'Chưa đủ STmin (tính dư một tick): dừng, MainFunction sẽ gọi lại.'], ['keepSending = false;   /* driver busy, try again next MainFunction */', 'TX FIFO đầy: không mất khung, thử lại sau.'], ['link->txState      = ISOTP_TX_WAIT_FC;', 'Đủ một block: chờ FC tiếp.']] },
              ],
              explain: `Không có hàm nào chờ (busy-wait) trong ISO-TP. Mọi "chờ" đều là trạng thái + thời điểm bắt đầu, được kiểm lại mỗi lần ⟦IsoTp_MainFunction⟧ chạy ([[8.1.4]]).`,
              run: ['Transmit 13 byte → SEND_FIRST → FF gửi được → WAIT_FC, timer N_Bs bắt đầu.', 'FC CTS (BS 0, STmin 0) tới → SEND_CF, gửi CF1 ngay.', 'txOffset = 13 ≥ 13 → TxFinish(OK) → IDLE.', '⟦txConfirmation⟧ của ECU chạy ⟦Uds_ExecutePendingReset⟧ (nếu có).'],
              fig: { type: 'fsm', states: ['IDLE', 'SEND_FIRST', 'WAIT_FC', 'SEND_CF'], edges: [['IDLE', 'SEND_FIRST', 'IsoTp_Transmit'], ['SEND_FIRST', 'IDLE', 'SF đã gửi → txConfirmation(OK)'], ['SEND_FIRST', 'WAIT_FC', 'FF đã gửi, bật N_Bs'], ['WAIT_FC', 'SEND_CF', 'FC CTS: lưu BS, STmin'], ['WAIT_FC', 'WAIT_FC', 'FC WAIT: reset timer (≤ 10 lần)'], ['SEND_CF', 'WAIT_FC', 'đã gửi BS khung (BS ≠ 0)'], ['SEND_CF', 'IDLE', 'gửi hết → OK'], ['WAIT_FC', 'IDLE', 'hết N_Bs, FC OVFLW, quá nhiều WAIT → lỗi']] },
              video: { t: 'Bên gửi ISO-TP từng bước', d: '2:30', goal: 'Máy trạng thái gửi.',
                s: ['Message 30 byte, BS = 2, STmin = 5 ms.', 'FF → chờ FC.', 'FC CTS → CF1, CF2 cách nhau > 5 ms.', 'Đủ 2 CF → chờ FC tiếp.', 'Hết CF → txConfirmation.'] },
              pit: [
                ['Dùng ⟦elapsed >= STmin⟧ với đồng hồ 1 ms', 'Có thể gửi sớm hơn STmin thật vì độ phân giải. Code chờ dư một tick.'],
                ['Bỏ qua FC.WAIT vô hạn', 'Bên nhận lỗi có thể giữ bên gửi mãi. Giới hạn ⟦ISOTP_MAX_WFT = 10⟧.'],
              ],
              ex: { task: `Message 100 byte, bên nhận đặt BS = 4. Bên gửi gửi bao nhiêu CF và nhận bao nhiêu FC?`, sol: `100 − 6 = 94 byte → ⌈94/7⌉ = 14 CF. FC: 1 sau FF, rồi sau mỗi 4 CF nếu còn dữ liệu: sau CF4, CF8, CF12 → tổng 4 FC.` },
              quiz: [
                ['FC đến khi bên gửi đang IDLE. Code làm gì?', ['Báo lỗi', 'Bỏ qua', 'Gửi lại FF', 'Reset link'], 1, 'FC không mong đợi bị bỏ qua theo chuẩn.'],
                ['Driver CAN bận khi gửi CF. Chuyện gì xảy ra?', ['Mất CF', 'Dừng vòng gửi, MainFunction thử lại sau', 'Báo ERR_TIMEOUT', 'Gửi lại từ FF'], 1, 'Không mất dữ liệu, trạng thái vẫn SEND_CF.'],
              ],
              sum: ['IDLE → SEND_FIRST → (WAIT_FC ↔ SEND_CF) → IDLE.', 'BS và STmin do bên nhận đặt.', 'Không busy-wait; driver bận thì thử lại.'],
            },
            {
              id: '8.1.3', t: 'Bên nhận: ghép khung, kiểm số thứ tự và tràn buffer', min: 25, pre: ['8.1.2'],
              concepts: [
                ['Sequence number', 'Bên nhận mong đợi SN tăng dần; sai SN → hủy message.'],
                ['FC.OVFLW', 'Bên nhận báo message quá dài so với buffer của nó.'],
                ['Unexpected PDU', 'SF hoặc FF mới đến khi đang nhận dở: message cũ bị hủy, message mới được nhận.'],
              ],
              goal: `Bạn đọc được ba hàm nhận và biết mỗi kiểm tra phòng chống loại lỗi nào.`,
              bg: `Bên nhận phải phòng thủ: khung có thể đến sai thứ tự, thiếu, hoặc message khai báo dài hơn buffer. Không kiểm là ghi tràn bộ nhớ.`,
              th: `- **SF:** độ dài phải 1..7, không vượt DLC − 1 và không vượt buffer; nếu đang nhận dở message khác → báo ⟦ERR_UNEXP_PDU⟧ cho message cũ; chép và báo OK ngay.
- **FF:** phải đủ 8 byte và độ dài > 7; nếu độ dài > buffer → gửi **FC OVFLW** và bỏ; ngược lại chép 6 byte, ⟦rxSeq = 1⟧, gửi **FC CTS** (BS, STmin của link).
- **CF:** bỏ qua nếu không đang nhận; SN sai → ⟦ERR_WRONG_SN⟧; chép tối đa 7 byte (byte cuối cùng có thể ít hơn), reset timer N_Cr; đủ → OK; nếu BS ≠ 0 và đủ một block → gửi FC CTS tiếp.
- Nếu không gửi được FC (driver bận) → ⟦rxFcPending⟧, MainFunction gửi lại.`,
              use: `Link ECU có buffer 256 byte: request lớn hơn sẽ nhận FC OVFLW. Unit test ⟦test_rx_message_too_long_sends_overflow⟧ kiểm đúng trường hợp này.`,
              code: [
                { f: 'common/isotp/isotp.c', from: 'static void RxOnFirstFrame(IsoTp_Link_t *link', to: 'RxSendFlowControl(link, FC_STATUS_CTS);', hl: ['RxSendFlowControl(link, FC_STATUS_OVFLW);', 'RxSendFlowControl(link, FC_STATUS_CTS);'],
                  ex: [['uint16_t length = (uint16_t)((((uint16_t)data[0] & 0x0FU) << 8U) | data[1]);', 'Ghép độ dài 12 bit từ nibble thấp byte 0 và byte 1.'], ['RxFinish(link, ISOTP_ERR_UNEXP_PDU);', 'FF mới cắt ngang message đang nhận: báo lỗi cho message cũ.'], ['RxSendFlowControl(link, FC_STATUS_OVFLW);', 'Quá buffer: từ chối ngay, không chép byte nào.']] },
                { f: 'common/isotp/isotp.c', from: 'static void RxOnConsecutiveFrame(IsoTp_Link_t *link', to: '/* BS = 0: sender continues without further FC */', hl: ['RxFinish(link, ISOTP_ERR_WRONG_SN);', 'link->rxTimerStart = Now(link);'],
                  ex: [['return;   /* CF without FF: ignore */', 'CF lạc (không có FF trước) bị bỏ.'], ['RxFinish(link, ISOTP_ERR_WRONG_SN);', 'Mất hoặc lặp CF: hủy cả message.'], ['chunk     = (remaining > CF_MAX_DATA) ? (uint16_t)CF_MAX_DATA : remaining;', 'CF cuối chỉ chép phần còn lại, padding bị bỏ qua.'], ['link->rxTimerStart = Now(link);', 'Mỗi CF tốt khởi động lại timer N_Cr.']] },
              ],
              explain: `Mọi đường lỗi đều gọi ⟦RxFinish⟧ với mã lỗi, nên tầng trên (UDS hoặc tester) luôn được báo và trạng thái luôn trở về IDLE: không có đường nào để link kẹt.`,
              run: ['FF độ dài 9 tới (tester gửi 22 với 4 DID ở self-test).', 'Chép 6 byte, rxSeq = 1, gửi FC CTS (BS 0, STmin 0 của ECU).', 'CF ⟦21⟧ tới: SN khớp, chép 3 byte còn lại.', 'rxOffset = 9 = rxLength → RxFinish(OK) → ⟦OnEcuRequest⟧ → UDS.'],
              fig: { type: 'flow', nodes: [['Khung tới IsoTp_RxFrame', 'start'], ['SF? độ dài hợp lệ → chép, OK (hủy message dở nếu có)', 'dec'], ['FF? > buffer → FC OVFLW; ngược lại chép 6 byte, FC CTS', 'dec'], ['CF? đang nhận và SN đúng → chép ≤ 7 byte', 'dec'], ['SN sai → ERR_WRONG_SN', 'bad'], ['Đủ độ dài → rxIndication(OK)', 'ok'], ['BS ≠ 0 và đủ block → FC CTS tiếp', 'end']] },
              video: { t: 'Bên nhận ISO-TP phòng thủ', d: '1:45', goal: 'Các kiểm tra chống tràn và sai thứ tự.',
                s: ['FF khai 300 byte, buffer 256: FC OVFLW.', 'CF SN 3 khi mong đợi 2: hủy.', 'SF mới khi đang nhận dở: message cũ báo lỗi.', 'Message tốt: rxIndication.'] },
              pit: [
                ['Không kiểm độ dài FF với buffer', 'CF sau đó ghi tràn buffer. Code gửi OVFLW trước khi chép.'],
                ['Chấp nhận CF với SN sai', 'Dữ liệu ghép sai thứ tự mà vẫn báo OK: UDS xử lý một request rác.'],
              ],
              ex: { task: `Đọc test {{tests/test_isotp.c@static void test_rx_sequence_number_wraps}}. Nó kiểm điều gì và vì sao quan trọng?`, sol: `Message đủ dài để SN đi 1..15 rồi về 0, 1… Test chắc rằng bên nhận dùng ⟦& 0x0F⟧ đúng chỗ; nếu không, mọi message dài hơn 6 + 15×7 = 111 byte sẽ lỗi ở CF thứ 16.` },
              quiz: [
                ['Request khai báo 400 byte gửi tới ECU (buffer 256). ECU trả gì?', ['FC CTS', 'FC WAIT', 'FC OVFLW', 'Không trả gì'], 2, '⟦length > rxBufferSize⟧ → OVFLW.'],
                ['CF với SN sai thì link làm gì?', ['Bỏ qua CF đó, chờ CF đúng', 'Hủy message, báo ERR_WRONG_SN', 'Gửi FC WAIT', 'Chép bình thường'], 1, 'Hủy cả message.'],
              ],
              sum: ['SF/FF/CF đều được kiểm độ dài và trạng thái.', 'Quá buffer → FC OVFLW; sai SN → hủy.', 'Mọi lỗi đi qua RxFinish: link không bao giờ kẹt.'],
            },
            {
              id: '8.1.4', t: 'Timer, MainFunction và phép trừ chống tràn', min: 20, pre: ['8.1.3'],
              concepts: [
                ['N_Bs / N_Cr', 'Timeout bên gửi chờ FC / bên nhận chờ CF. Mặc định 1000 ms.'],
                ['Wrap-around', 'Bộ đếm ms 32 bit tràn về 0 sau khoảng 49,7 ngày.'],
                ['MainFunction', 'Hàm định kỳ lo mọi thứ phụ thuộc thời gian: timeout, gửi CF chờ STmin, gửi lại FC.'],
              ],
              goal: `Bạn hiểu ⟦IsoTp_MainFunction⟧ làm gì mỗi lần được gọi, và vì sao ⟦(uint32_t)(now − start)⟧ đúng cả khi đồng hồ tràn.`,
              bg: `Mọi giao thức có timeout cần đo thời gian. Cách an toàn trên MCU: lưu thời điểm bắt đầu và so **khoảng đã trôi qua** với timeout, không so trực tiếp hai thời điểm.`,
              th: `**Phép trừ không dấu:** ⟦Elapsed = (uint32_t)(Now() − start)⟧. Ví dụ start = 0xFFFFFF00, now = 0x00000100 (đã tràn): now − start = 0x200 = 512 ms, đúng. Trong khi so ⟦now > start + timeout⟧ sẽ sai lúc tràn.

**⟦IsoTp_MainFunction⟧ mỗi lần gọi:**
1. Có FC đang chờ gửi (lần trước driver bận) → gửi lại.
2. Đang nhận và quá N_Cr → ⟦ERR_TIMEOUT_CR⟧.
3. Phía gửi: SEND_FIRST → thử gửi lại SF/FF (quá N_Bs thì lỗi); WAIT_FC → quá N_Bs thì lỗi; SEND_CF → gửi tiếp CF.

**STmin:** ⟦DecodeStMin⟧ đổi mã thô sang ms: 0x00–0x7F là ms, 0xF1–0xF9 (100–900 µs) làm tròn lên 1 ms, giá trị dự trữ coi như 127 ms.

Trên Control ECU, MainFunction được ComRx gọi sau mỗi khung và ít nhất mỗi 2 ms ([[7.1.2]]).`,
              use: `Cùng kỹ thuật ⟦now − start⟧ dùng ở UDS (S3 timeout), tester (timeout 1000 ms) và Monitor (tuổi khung).`,
              code: [
                { f: 'common/isotp/isotp.c', from: '/* Unsigned subtraction stays correct when the ms counter wraps at 2^32. */', n: 4, hl: ['return (uint32_t)(Now(link) - start);'],
                  ex: [['return (uint32_t)(Now(link) - start);', 'Phép trừ modulo 2³² cho khoảng thời gian đúng kể cả khi tràn.']] },
                { f: 'common/isotp/isotp.c', from: 'static uint32_t DecodeStMin(uint8_t raw)', to: 'return STMIN_MAX_MS;', hl: ['return 1U;'],
                  ex: [['return 1U;', '100–900 µs làm tròn lên 1 ms, độ phân giải của đồng hồ.'], ['return STMIN_MAX_MS;', 'Giá trị dự trữ: an toàn nhất là chậm nhất (127 ms).']] },
                { f: 'common/isotp/isotp.c', from: 'void IsoTp_MainFunction(IsoTp_Link_t *link)', to: 'bool IsoTp_IsTxBusy(const IsoTp_Link_t *link)', hl: ['RxFinish(link, ISOTP_ERR_TIMEOUT_CR);', 'TxFinish(link, ISOTP_ERR_TIMEOUT_BS);'],
                  ex: [['if (link->rxFcPending)', 'FC chưa gửi được lần trước: gửi lại.'], ['RxFinish(link, ISOTP_ERR_TIMEOUT_CR);', 'Bên gửi im lặng quá N_Cr: hủy message đang nhận.'], ['case ISOTP_TX_SEND_FIRST:', 'SF/FF chưa vào được driver: thử lại cho tới N_Bs.'], ['TxSendConsecutiveFrames(link);', 'Gửi các CF đang chờ STmin.']] },
              ],
              explain: `Thiết kế "trạng thái + timer + MainFunction" là cách chuẩn để viết giao thức trên MCU mà không cần RTOS: module không bao giờ chặn, mọi thứ tiến triển mỗi lần MainFunction chạy.`,
              run: ['ECU gửi FF lúc t = 5000, vào WAIT_FC, txTimerStart = 5000.', 'Tester không trả FC.', 'MainFunction mỗi ≤ 2 ms: Elapsed tăng dần.', 't = 6000: Elapsed = 1000 ≥ N_Bs → TxFinish(ERR_TIMEOUT_BS) → IDLE.', '⟦txConfirmation⟧ được gọi với lỗi, reset (nếu có) không chạy.'],
              fig: { type: 'flow', nodes: [['IsoTp_MainFunction()', 'start'], 'rxFcPending? → gửi lại FC', ['Đang nhận và (now − rxTimerStart) ≥ N_Cr? → ERR_TIMEOUT_CR', 'dec'], ['SEND_FIRST: thử gửi lại · quá N_Bs → lỗi', 'dec'], ['WAIT_FC: quá N_Bs → ERR_TIMEOUT_BS', 'dec'], ['SEND_CF: gửi CF khi qua STmin', 'end']] },
              video: { t: 'Đồng hồ tràn mà không sai', d: '1:15', goal: 'Phép trừ modulo 2³².',
                s: ['Bộ đếm 32 bit gần 0xFFFFFFFF.', 'start trước khi tràn, now sau khi tràn.', 'now − start (không dấu) vẫn ra 512.', 'So sánh sai cách: now > start + timeout.'] },
              pit: [
                ['So hai thời điểm thay vì khoảng thời gian', 'Sai khi đồng hồ tràn (49,7 ngày với ms 32 bit). Luôn tính ⟦now − start⟧.'],
                ['Gọi MainFunction quá thưa', 'STmin và timeout bị trễ theo chu kỳ gọi. Control ECU gọi ít nhất mỗi 2 ms.'],
              ],
              ex: { task: `Đọc test {{tests/test_isotp.c@static void test_tx_timeout_n_bs}}. Test làm thế nào để "chờ" 1000 ms?`, sol: `Nó tăng biến ⟦g_now⟧ của clock giả rồi gọi ⟦IsoTp_MainFunction⟧, kiểm rằng ⟦txConfirmation⟧ nhận ⟦ISOTP_ERR_TIMEOUT_BS⟧ đúng lúc ngưỡng bị vượt.` },
              quiz: [
                ['start = 0xFFFFFFF0, now = 0x00000010. ⟦(uint32_t)(now − start)⟧ bằng?', ['0', '32', '0xFFFFFFE0', 'âm'], 1, '0x10 − 0xFFFFFFF0 = 0x20 = 32 (mod 2³²).'],
                ['STmin thô 0xF5 được hiểu là?', ['245 ms', '500 µs, làm tròn lên 1 ms', '127 ms', 'Lỗi'], 1, '0xF1–0xF9 = 100–900 µs.'],
              ],
              sum: ['Đo thời gian bằng ⟦now − start⟧ không dấu: đúng khi tràn.', 'MainFunction lo timeout, CF chờ STmin, FC gửi lại.', 'Không chặn; tiến triển theo mỗi lần gọi.'],
            },
          ],
        },
      ],
    },
    {
      id: 'c09', t: 'UDS server (ISO 14229-1)',
      lessons: [
        {
          id: '9.1', t: 'uds_server.c và diag_app.c',
          subs: [
            {
              id: '9.1.1', t: 'Mô hình request/response, SID + 0x40 và NRC', min: 20, pre: ['8.1.1'],
              concepts: [
                ['SID', 'Service Identifier, byte đầu của request: 0x10 session, 0x22 đọc DID, 0x19 đọc DTC…'],
                ['Response dương', 'Byte đầu = SID + 0x40 (0x22 → 0x62), theo sau là dữ liệu.'],
                ['NRC', 'Negative Response Code: ⟦7F <SID> <NRC>⟧, ví dụ 0x31 requestOutOfRange.'],
                ['Sub-function', 'Byte thứ hai của nhiều service, bit 7 là cờ chặn response dương.'],
              ],
              goal: `Bạn đọc được mọi request/response trong log và biết ý nghĩa 7 NRC mà server dùng.`,
              bg: `UDS là giao thức hỏi-đáp: tester gửi request, ECU trả đúng một response (dương hoặc âm), hoặc im lặng trong vài trường hợp được quy định. UDS không quan tâm khung CAN, chỉ thấy message hoàn chỉnh từ ISO-TP.`,
              th: `**6 service của project:**
| SID | Service | Ví dụ |
|---|---|---|
| 0x10 | DiagnosticSessionControl | ⟦10 03⟧ → ⟦50 03 00 32 01 F4⟧ |
| 0x11 | ECUReset | ⟦11 01⟧ → ⟦51 01⟧ (chỉ extended) |
| 0x14 | ClearDiagnosticInformation | ⟦14 FF FF FF⟧ → ⟦54⟧ |
| 0x19 | ReadDTCInformation | ⟦19 02 FF⟧ → ⟦59 02 7F …⟧ |
| 0x22 | ReadDataByIdentifier | ⟦22 F1 95⟧ → ⟦62 F1 95 …⟧ |
| 0x3E | TesterPresent | ⟦3E 00⟧ → ⟦7E 00⟧ |

**NRC dùng trong server:** 0x11 service không hỗ trợ · 0x12 sub-function không hỗ trợ · 0x13 sai độ dài · 0x14 response quá dài · 0x31 ngoài phạm vi (DID lạ, group lạ) · 0x7E sub-function không hỗ trợ trong session hiện tại · 0x7F service không hỗ trợ trong session hiện tại.

Ví dụ: ⟦22 12 34⟧ → ⟦7F 22 31⟧ (DID 0x1234 không tồn tại).`,
              use: `Server không biết ISO-TP: ⟦diag_app⟧ đưa vào một request hoàn chỉnh và nhận lại response trong buffer ([[9.1.6]]).`,
              code: [
                { f: 'common/uds/uds_server.h', from: '#define UDS_SID_DIAG_SESSION_CONTROL', to: '#define UDS_NRC_SERVICE_NOT_SUPP_IN_SESSION', hl: ['#define UDS_POSITIVE_OFFSET'],
                  ex: [['#define UDS_POSITIVE_OFFSET', 'Response dương = SID + 0x40.'], ['#define UDS_SID_NEGATIVE_RESPONSE', 'Byte đầu của mọi response âm.'], ['#define UDS_NRC_REQUEST_OUT_OF_RANGE', 'Dùng cho DID lạ, group DTC lạ.']] },
                { f: 'common/uds/uds_server.c', from: 'static uint16_t Negative(Ctx_t *c, uint8_t nrc)', to: 'return 3U;', hl: ['c->resp[0] = UDS_SID_NEGATIVE_RESPONSE;'],
                  ex: [['c->resp[1] = c->req[0];', 'Lặp lại SID của request để tester biết NRC trả lời cho request nào.'], ['return 3U;', 'Response âm luôn đúng 3 byte.']] },
              ],
              explain: `Mỗi hàm service trả về ⟦0⟧ (thành công, response đã nằm trong ⟦c->resp⟧) hoặc một mã NRC. Một chỗ duy nhất (⟦Uds_ProcessRequest⟧) biến NRC thành ⟦7F SID NRC⟧ ([[9.1.2]]).`,
              run: ['Tester gửi ⟦22 12 34⟧.', '⟦ReadDid⟧ không tìm thấy DID nào → trả ⟦0x31⟧.', '⟦Uds_ProcessRequest⟧ gọi ⟦Negative⟧ → ⟦7F 22 31⟧ (3 byte).', 'ISO-TP gửi Single Frame ⟦03 7F 22 31 CC CC CC CC⟧ trên 0x7E8.'],
              fig: { type: 'seq', actors: ['Tester', 'ISO-TP', 'Uds_ProcessRequest', 'Service'], msgs: [[0, 1, '22 F1 95'], [1, 2, 'request hoàn chỉnh'], [2, 3, 'ReadDid(&c)'], [3, 2, '0 (OK), resp = 62 F1 95 …'], [2, 1, '13 byte'], [1, 0, 'FF + CF'], [0, 1, '22 12 34'], [2, 3, 'ReadDid(&c)'], [3, 2, 'NRC 0x31'], [2, 0, '7F 22 31']] },
              video: { t: 'Đọc response UDS', d: '1:30', goal: 'Dương, âm, NRC.',
                s: ['Bảng 6 service và response tương ứng.', '62 = 22 + 40.', '7F 22 31: SID lặp lại, NRC 31.', 'Log M5: nhận diện từng dòng.'] },
              pit: [
                ['Nhầm byte 2 của response âm là SID', 'Thứ tự là ⟦7F⟧, SID của request, rồi NRC.'],
                ['Trả NRC 0x11 cho DID lạ', 'DID lạ là 0x31 (ngoài phạm vi); 0x11 là cả service không hỗ trợ.'],
              ],
              ex: { task: `Đoán response cho: (a) ⟦85 01⟧ physical, (b) ⟦10 05⟧, (c) ⟦3E⟧ (thiếu byte). Kiểm bằng tab Mô phỏng của trang 3D hoặc đọc code.`, sol: `(a) ⟦7F 85 11⟧; (b) ⟦7F 10 12⟧ (session 05 không hỗ trợ); (c) ⟦7F 3E 13⟧ (sai độ dài).` },
              quiz: [
                ['Response dương của ⟦19⟧ bắt đầu bằng byte nào?', ['0x19', '0x59', '0x7F', '0x99'], 1, '0x19 + 0x40 = 0x59.'],
                ['⟦11 01⟧ ở default session nhận NRC nào?', ['0x11', '0x12', '0x7E', '0x31'], 2, 'Reset chỉ được phép trong extended.'],
              ],
              sum: ['Dương: SID + 0x40; âm: ⟦7F SID NRC⟧.', '6 service: 10, 11, 14, 19, 22, 3E.', '7 NRC, mỗi cái một ý nghĩa rõ ràng.'],
            },
            {
              id: '9.1.2', t: 'Bộ điều phối Uds_ProcessRequest, Ctx_t, functional và bit suppress', min: 25, pre: ['9.1.1'],
              concepts: [
                ['Dispatcher', 'Hàm nhận mọi request và chọn hàm service theo SID bằng ⟦switch⟧.'],
                ['Ctx_t', 'Struct gom con trỏ request/response và trạng thái tạm cho một request, truyền cho hàm service.'],
                ['SPRMIB', 'suppressPosRspMsgIndicationBit: bit 7 sub-function = 1 → ECU không gửi response dương.'],
                ['Chặn NRC functional', 'Với request gửi tới mọi ECU (0x7DF), một số NRC không được gửi để ECU không hỗ trợ khỏi làm ồn bus.'],
              ],
              goal: `Bạn đọc hiểu hàm trung tâm của server và hai quy tắc ISO 14229 hay bị quên: bit suppress và chặn NRC cho request functional.`,
              bg: `Server có nhiều service nhưng các bước chung giống nhau: kiểm tham số, cập nhật S3, chọn service, đổi NRC thành response âm, áp dụng các quy tắc chặn. Gom các bước chung vào một chỗ giúp mỗi service ngắn gọn.`,
              th: `⟦Uds_ProcessRequest(req, len, functional, resp, respMax)⟧:
1. Kiểm NULL, độ dài 0 → trả 0 (không gửi gì).
2. Dựng ⟦Ctx_t c⟧ (req, resp, respMax, respLen = 0, suppressPositive = false).
3. Cập nhật ⟦s_lastRequestMs⟧: **mọi request đều giữ session sống** (S3).
4. ⟦switch (req[0])⟧ → hàm service, nhận về ⟦nrc⟧.
5. Có NRC: nếu functional và NRC thuộc {11, 12, 31, 7E, 7F} → trả 0 (im lặng); ngược lại trả ⟦7F SID NRC⟧.
6. Không NRC: nếu service đặt ⟦suppressPositive⟧ → trả 0; ngược lại trả ⟦c.respLen⟧.

Giá trị trả về là **độ dài response**, 0 nghĩa là "không gửi gì". Bit suppress được hỗ trợ cho 0x10, 0x11, 0x3E (⟦3E 80⟧ giữ session mà không có response).`,
              use: `⟦RespondTo⟧ trong ⟦diag_app.c⟧ gọi hàm này và chỉ gọi ⟦IsoTp_Transmit⟧ khi độ dài > 0.`,
              code: [
                { f: 'common/uds/uds_server.c', from: 'typedef struct', to: '} Ctx_t;', hl: ['bool           suppressPositive;'],
                  ex: [['const uint8_t *req;', 'Request chỉ đọc.'], ['uint16_t       respMax;', 'Giới hạn buffer do caller cấp: không service nào được ghi quá.'], ['bool           suppressPositive;', 'Service đặt cờ này nếu bit 7 của sub-function bật.']] },
                { f: 'common/uds/uds_server.c', from: 'uint16_t Uds_ProcessRequest(const uint8_t *req', to: 'return c.suppressPositive ? 0U : c.respLen;', hl: ['s_lastRequestMs = (s_cfg.getTimeMs != NULL) ? s_cfg.getTimeMs() : 0U;', 'if (functional && IsSuppressedForFunctional(nrc))'],
                  ex: [['/* Any request keeps a non-default session alive (S3 timer). */', 'Mọi request, kể cả request lỗi, làm mới timer S3.'], ['default:                           nrc = UDS_NRC_SERVICE_NOT_SUPPORTED; break;', 'SID không có trong bảng → NRC 0x11.'], ['if (functional && IsSuppressedForFunctional(nrc))', 'Functional: im lặng thay vì gửi các NRC "không hỗ trợ".'], ['return c.suppressPositive ? 0U : c.respLen;', 'Bit suppress: thành công nhưng không gửi gì.']] },
                { f: 'common/uds/uds_server.c', from: 'static bool IsSuppressedForFunctional(uint8_t nrc)', to: '(nrc == UDS_NRC_SERVICE_NOT_SUPP_IN_SESSION);',
                  ex: [['(nrc == UDS_NRC_SERVICE_NOT_SUPPORTED) ||', 'Năm NRC bị chặn; các NRC khác (ví dụ 0x13 sai độ dài) vẫn được gửi.']] },
              ],
              explain: `Trả về độ dài thay vì gửi trực tiếp giữ cho server **không biết tầng vận chuyển**: cùng hàm được dùng với ISO-TP trên board, với test C (gọi thẳng) và với ⟦SimulatedEcu⟧ trong C++.`,
              run: ['Tester gửi ⟦85 01⟧ trên 0x7DF (functional).', 'diag_app thấy SF trên 0x7DF, gọi ⟦RespondTo(data, len, true)⟧.', 'switch: SID 0x85 không có → nrc = 0x11.', 'functional và 0x11 thuộc danh sách chặn → trả 0.', '⟦RespondTo⟧ không gửi gì; tester bước "silent" PASS sau 300 ms.'],
              fig: { type: 'flow', nodes: [['Uds_ProcessRequest(req, len, functional, …)', 'start'], 'Dựng Ctx_t, cập nhật s_lastRequestMs (S3)', 'switch (req[0]) → hàm service → nrc', ['nrc ≠ 0 và functional và nrc ∈ {11,12,31,7E,7F} → 0 (im lặng)', 'dec'], ['nrc ≠ 0 → 7F SID NRC', 'bad'], ['suppressPositive → 0 (im lặng)', 'dec'], ['→ c.respLen (response dương)', 'ok']] },
              video: { t: 'Một request đi qua dispatcher', d: '1:45', goal: 'Các nhánh trả về.',
                s: ['Request physical hợp lệ: response dương.', 'Request lỗi: 7F SID NRC.', '3E 80: thành công nhưng im lặng.', 'Functional với service lạ: im lặng.'] },
              pit: [
                ['Gửi NRC 0x11 cho request functional', 'Mọi ECU không hỗ trợ service đó sẽ cùng trả lời, làm ngập bus. Chuẩn yêu cầu chặn.'],
                ['Chặn cả NRC 0x13 cho functional', 'Sai độ dài vẫn phải báo. Danh sách chặn chỉ có 5 mã.'],
              ],
              ex: { task: `Đọc test {{tests/test_uds.c@static void test_functional_suppression_keeps_other_nrcs}}. NRC nào vẫn được gửi cho request functional?`, sol: `Test kiểm rằng NRC 0x13 (incorrectMessageLength) vẫn được trả cho request functional, trong khi NRC 0x11/0x31 bị chặn.` },
              quiz: [
                ['⟦Uds_ProcessRequest⟧ trả 0 nghĩa là gì?', ['Lỗi', 'Không gửi response nào', 'Response dương rỗng', 'Reset'], 1, 'Caller chỉ gửi khi độ dài > 0.'],
                ['⟦3E 80⟧ physical, server trả gì?', ['7E 00', '7E 80', 'Không gì (bit suppress)', '7F 3E 12'], 2, 'Bit 7 bật → suppressPositive.'],
              ],
              sum: ['Một dispatcher, mỗi service trả 0 hoặc NRC.', 'Mọi request làm mới S3.', 'Functional: chặn 5 NRC; bit 7 sub-function chặn response dương.', 'Trả độ dài: server không biết tầng vận chuyển.'],
            },
            {
              id: '9.1.3', t: 'Session, P2/P2* và timeout S3', min: 20, pre: ['9.1.2'],
              concepts: [
                ['Default session (0x01)', 'Session khi xe chạy bình thường; chỉ các service an toàn.'],
                ['Extended session (0x03)', 'Mở thêm service như ECUReset.'],
                ['P2 / P2*', 'Thời gian server hứa trả lời (50 ms) / thời gian tối đa sau NRC 0x78 (5000 ms).'],
                ['S3', 'Không có request trong 5 s → server tự về default session.'],
              ],
              goal: `Bạn giải mã được response ⟦50 03 00 32 01 F4⟧, và hiểu cơ chế tự về default khi tester mất kết nối.`,
              bg: `Session là "chế độ" của ECU đối với chẩn đoán. Thao tác nguy hiểm chỉ mở trong session đặc biệt, và session đặc biệt phải tự hết hạn nếu tester biến mất (rút cáp), để ECU không kẹt ở chế độ chẩn đoán khi xe chạy.`,
              th: `**⟦10 03⟧ → ⟦50 03 00 32 01 F4⟧:**
- ⟦50⟧ = 0x10 + 0x40; ⟦03⟧ = session.
- ⟦00 32⟧ = P2 = 50 ms (đơn vị 1 ms).
- ⟦01 F4⟧ = 500 × 10 ms = P2* = 5000 ms (đơn vị 10 ms).

**S3:** mỗi request cập nhật ⟦s_lastRequestMs⟧. ⟦Uds_MainFunction⟧ (gọi từ ComRx) thấy session ≠ default và ⟦now − last ≥ 5000⟧ → về default. Tester muốn giữ extended phải gửi request ít nhất mỗi 5 s, thường là ⟦3E 80⟧.

Project chưa dùng NRC 0x78 (responsePending) vì mọi service trả lời ngay; client C++ đã hỗ trợ nó (chuyển sang chờ P2*).`,
              use: `ECUReset kiểm ⟦s_session != UDS_SESSION_EXTENDED⟧ → NRC 0x7E ([[9.1.5]]). Sau reset, session luôn về default.`,
              code: [
                { f: 'common/uds/uds_server.c', from: 'static uint8_t SessionControl(Ctx_t *c)', to: 'return 0U;', hl: ['c->suppressPositive = ((c->req[1] & SPRMIB) != 0U);', '(uint8_t)((uint16_t)(UDS_P2STAR_SERVER_MS / 10U) >> 8U)'],
                  ex: [['session = (uint8_t)(c->req[1] & SUBFUNCTION_MASK);', 'Bỏ bit 7 (suppress) để lấy số session.'], ['return UDS_NRC_SUBFUNCTION_NOT_SUPPORTED;', 'Chỉ hỗ trợ 01 và 03.'], ['/* sessionParameterRecord: P2 in 1 ms, P2* in 10 ms resolution */', 'Hai đơn vị khác nhau theo chuẩn ISO 14229-2.'], ['(uint8_t)((uint16_t)UDS_P2_SERVER_MS >> 8U)', 'Ép ⟦uint16_t⟧ trước khi dịch: đây là chỗ sửa MISRA rule 12.2.']] },
                { f: 'common/uds/uds_server.c', from: 'void Uds_MainFunction(void)', to: 's_session = UDS_SESSION_DEFAULT;   /* tester gone: fall back to default */', hl: ['if ((uint32_t)(now - s_lastRequestMs) >= UDS_S3_SERVER_MS)'],
                  ex: [['if ((s_session == UDS_SESSION_DEFAULT) || (s_cfg.getTimeMs == NULL))', 'Default thì không có gì để hết hạn.'], ['if ((uint32_t)(now - s_lastRequestMs) >= UDS_S3_SERVER_MS)', 'Cùng kỹ thuật trừ không dấu như ISO-TP.']] },
              ],
              explain: `Unit test ⟦test_s3_timeout_returns_to_default⟧ và GoogleTest ⟦S3TimeoutReturnsToDefaultSession⟧ cùng kiểm hành vi này, bằng clock giả.`,
              run: ['t = 0: ⟦10 03⟧ → extended, last = 0.', 't = 3000: ⟦3E 80⟧ → last = 3000, không response.', 't = 8000: MainFunction: 8000 − 3000 = 5000 ≥ 5000 → default.', 't = 8100: ⟦11 01⟧ → ⟦7F 11 7E⟧.'],
              fig: { type: 'fsm', states: ['Default (01)', 'Extended (03)'], edges: [['Default (01)', 'Extended (03)', '10 03'], ['Extended (03)', 'Default (01)', '10 01'], ['Extended (03)', 'Extended (03)', 'mọi request: làm mới S3'], ['Extended (03)', 'Default (01)', 'không request 5 s (S3)'], ['Extended (03)', 'Default (01)', 'ECU reset được thực thi']] },
              video: { t: 'Session tự hết hạn', d: '1:15', goal: 'P2, P2*, S3.',
                s: ['Giải mã 50 03 00 32 01 F4.', 'Tester vào extended, gửi 3E 80 mỗi 2 s.', 'Ngừng gửi: sau 5 s về default.', 'Reset bị từ chối vì đã về default.'] },
              pit: [
                ['Quên gửi TesterPresent trong session dài', 'Sau 5 s về default, các service cần extended bắt đầu trả 0x7E.'],
                ['Đọc P2* theo đơn vị ms', '⟦01 F4⟧ là 500 đơn vị 10 ms = 5 s, không phải 500 ms.'],
              ],
              ex: { task: `Response session là ⟦50 01 00 32 01 F4⟧. Client C++ giải mã thành ⟦SessionTiming⟧ thế nào? Xem {{tester/src/uds_client.cpp@Result<SessionTiming> UdsClient::startSession}}.`, sol: `⟦p2 = be16(b[2], b[3]) = 50 ms⟧, ⟦p2Star = be16(b[4], b[5]) × 10 = 5000 ms⟧; client kiểm độ dài 6 và byte session khớp request.` },
              quiz: [
                ['⟦01 F4⟧ trong response session tương ứng P2* bằng?', ['500 ms', '5000 ms', '50 ms', '0x1F4 µs'], 1, 'Đơn vị 10 ms.'],
                ['Điều gì làm timer S3 được làm mới?', ['Chỉ 3E 00', 'Mọi request tới server', 'Chỉ request thành công', 'Không gì'], 1, '⟦s_lastRequestMs⟧ cập nhật ở đầu ⟦Uds_ProcessRequest⟧.'],
              ],
              sum: ['Default 01, extended 03.', 'P2 = 50 ms (1 ms/đơn vị), P2* = 5 s (10 ms/đơn vị).', 'S3 = 5 s không request → về default.'],
            },
            {
              id: '9.1.4', t: 'ReadDataByIdentifier: nhiều DID và bảng DID bằng con trỏ hàm', min: 20, pre: ['9.1.2'],
              concepts: [
                ['DID', 'Data Identifier 2 byte: F195 phiên bản phần mềm, 0100 tốc độ, 0101 fault mask.'],
                ['Bảng DID', 'Mảng ⟦{id, length, read()}⟧ do ứng dụng cấp; server chỉ tra bảng.'],
                ['Đọc nhiều DID', 'Một request ⟦22 A B C⟧ trả về các DID theo đúng thứ tự, bỏ qua DID không biết.'],
              ],
              goal: `Bạn hiểu cách server đọc dữ liệu ứng dụng mà không biết ứng dụng là gì, và quy tắc xử lý DID không tồn tại.`,
              bg: `Server UDS nằm trong ⟦common/⟧, không được biết tốc độ hay fault mask là gì. Ứng dụng đăng ký mỗi DID với một hàm đọc; server chỉ gọi hàm đó khi cần.`,
              th: `- Độ dài request phải là 1 + 2k (k ≥ 1), ngược lại NRC 0x13.
- Với mỗi DID: tra bảng (⟦FindDid⟧, tìm tuyến tính); **không thấy thì bỏ qua**; thấy thì kiểm còn chỗ (⟦respLen + 2 + length ≤ respMax⟧, không thì NRC 0x14), ghi ID rồi gọi ⟦read()⟧ ghi đúng ⟦length⟧ byte.
- Không DID nào hợp lệ → NRC 0x31.

**Response không có độ dài từng DID**: client phải biết trước độ dài (C++ có ⟦DidSpec⟧ ⟦{id, length}⟧ cho việc này).

Bảng của Control ECU: F195 (10 byte, "CTRL-0.3.0"), 0100 (2 byte tốc độ), 0101 (1 byte fault mask). Hàm đọc tốc độ khóa mutex view ([[7.1.3]]).`,
              use: `Self-test bước 3 đọc 4 DID (⟦F195 0100 0101 F195⟧) để kiểm cả việc ECU nhận request nhiều khung (9 byte → FF + CF).`,
              code: [
                { f: 'common/uds/uds_server.c', from: 'static uint8_t ReadDid(Ctx_t *c)', to: 'return anyFound ? 0U : UDS_NRC_REQUEST_OUT_OF_RANGE;', hl: ['continue;   /* unknown DIDs are skipped; NRC only if none is known */', 'did->read(&c->resp[c->respLen]);'],
                  ex: [['if ((c->reqLen < 3U) || (((c->reqLen - 1U) % 2U) != 0U))', 'Phải có ít nhất một DID và số byte DID chẵn.'], ['continue;   /* unknown DIDs are skipped; NRC only if none is known */', 'Quy tắc ISO 14229-1: DID lạ bị bỏ qua.'], ['return UDS_NRC_RESPONSE_TOO_LONG;', 'Không đủ chỗ trong buffer: báo 0x14 thay vì cắt bớt.'], ['did->read(&c->resp[c->respLen]);', 'Gọi hàm của ứng dụng ghi thẳng vào buffer response.']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'static void ReadSpeed(uint8_t *out)', to: '{ 0x0101U, 1U,             ReadFaults },', hl: ['{ 0xF195U, FW_VERSION_LEN, ReadVersion },'],
                  ex: [['uint16_t speed = ControlApp_GetSpeedX10();', 'Đọc tốc độ qua API có khóa mutex.'], ['{ 0xF195U, FW_VERSION_LEN, ReadVersion },', 'F195 = system supplier software version theo ISO 14229.']] },
              ],
              explain: `Đây là dependency injection lần thứ ba trong project: bảng dữ liệu + con trỏ hàm. Thêm DID mới không cần sửa ⟦uds_server.c⟧.`,
              run: ['Request ⟦22 F1 95 01 00 01 01⟧ (7 byte, SF).', 'nDids = 3; F195 → ghi ⟦F1 95⟧ + 10 byte; 0100 → ⟦01 00⟧ + 2 byte; 0101 → ⟦01 01⟧ + 1 byte.', 'Response 1 + 12 + 4 + 3 = 20 byte → FF + FC + 2 CF.'],
              fig: { type: 'bytes', title: 'Response ⟦62 F1 95 … 01 00 … 01 01 …⟧', cells: [['1', '62', 'SID + 0x40'], ['2 + 10', 'F1 95 "CTRL-0.3.0"', 'phiên bản'], ['2 + 2', '01 00 HI LO', 'tốc độ ×10'], ['2 + 1', '01 01 MASK', 'fault mask']] },
              video: { t: 'Một request, ba DID', d: '1:15', goal: 'Thứ tự và độ dài.',

                s: ['Request 22 với 3 DID.', 'Server tra bảng từng DID.', 'Response nối liền, không có độ dài.', 'Client tách bằng độ dài biết trước.'] },
              pit: [
                ['Trả NRC khi có một DID lạ trong nhiều DID', 'Chuẩn: bỏ qua DID lạ, chỉ NRC khi không DID nào hợp lệ.'],
                ['Hàm ⟦read⟧ ghi khác ⟦length⟧ byte', 'Response lệch, client tách sai. Hàm đọc phải ghi đúng số byte đã đăng ký.'],
              ],
              ex: { task: `Thêm (trên giấy) DID ⟦0x0102⟧ trả 4 byte uptime của Control ECU. Cần sửa file nào?`, sol: `Chỉ ⟦diag_app.c⟧: viết ⟦static void ReadUptime(uint8_t *out)⟧ và thêm ⟦{ 0x0102U, 4U, ReadUptime }⟧ vào ⟦k_dids⟧. Nếu tester C++ cần đọc, thêm vào ⟦control_ecu.hpp⟧.` },
              quiz: [
                ['Request ⟦22 12 34 F1 95⟧. Response?', ['7F 22 31', '62 F1 95 … (bỏ qua 1234)', '7F 22 13', '62 12 34 …'], 1, 'Có ít nhất một DID hợp lệ.'],
                ['Vì sao client C++ cần ⟦DidSpec⟧ với độ dài?', ['Để tính CRC', 'Vì response không chứa độ dài của từng DID', 'Để mã hóa', 'Không cần'], 1, 'Xem ⟦UdsClient::readDids⟧.'],
              ],
              sum: ['Bảng ⟦{id, length, read}⟧ do ứng dụng cấp.', 'DID lạ bỏ qua; không DID nào hợp lệ → 0x31.', 'Không đủ chỗ → 0x14.'],
            },
            {
              id: '9.1.5', t: 'ECUReset: thực thi sau khi response đã gửi, và SysDrv_Restart', min: 25, pre: ['9.1.3', '8.1.2'],
              concepts: [
                ['Reset trì hoãn', 'Server chỉ ghi nhận yêu cầu reset; reset thật chạy khi response đã ra bus.'],
                ['txConfirmation', 'Callback ISO-TP báo message đã gửi xong (hoặc lỗi).'],
                ['Hard reset (01) / soft reset (03)', 'Hard: khởi động lại firmware. Soft: bắt đầu operation cycle mới, đồng bộ lại E2E.'],
                ['Reset vector', 'Địa chỉ hàm ⟦Reset_Handler⟧ ở ô thứ 2 của bảng vector ngắt.'],
              ],
              goal: `Bạn hiểu chuỗi 4 file tham gia một lệnh ⟦11 01⟧, và vì sao trên STM32MP157 không dùng được ⟦NVIC_SystemReset()⟧.`,
              bg: `Nếu ECU reset ngay khi nhận ⟦11 01⟧, response ⟦51 01⟧ chưa kịp gửi: tester tưởng ECU không trả lời. Chuẩn yêu cầu gửi response trước rồi mới reset.`,
              th: `**Chuỗi thực thi:**
1. ⟦EcuReset⟧ (server): kiểm độ dài, loại reset (01/03), session phải là extended; ghi ⟦s_pendingReset = type⟧, tạo ⟦51 type⟧.
2. ⟦diag_app⟧ gửi response qua ISO-TP.
3. Khi gửi xong, ISO-TP gọi ⟦OnEcuResponseSent⟧ → ⟦Uds_ExecutePendingReset()⟧ → về default, gọi callback ⟦ecuReset(type)⟧ của ứng dụng.
4. ⟦EcuReset⟧ (diag_app): 03 → ⟦ControlApp_SoftReset⟧ (đồng bộ lại E2E, operation cycle mới); 01 → ⟦SysDrv_Restart⟧.

**Vì sao không ⟦NVIC_SystemReset⟧?** Trên MP157 ở production mode, Linux quản lý vòng đời M4. Reset hệ thống đưa M4 vào reset và nó **bị giữ ở đó** (⟦RCC_MP_GCR.BOOT_MCU = 0⟧) vì Linux không biết cần khởi động lại. ⟦SysDrv_Restart⟧ thay vào đó: tắt ngắt, dừng SysTick, xóa mọi ngắt NVIC, reset ngoại vi của M4 (FDCAN, TIM1, TIM7, UART7), về main stack, nạp lại stack pointer ban đầu và nhảy tới ⟦Reset_Handler⟧. RAM được khởi tạo lại như lúc bật nguồn, nên **DTC (chỉ ở RAM) cũng mất**.`,
              use: `Tester M5 kiểm chuỗi này: ⟦10 03⟧, ⟦11 01⟧, chờ 3 s, rồi ⟦3E 00⟧ và ⟦22 F1 95⟧ phải trả lời ([[5.1.5]]).`,
              code: [
                { f: 'common/uds/uds_server.c', from: 'static uint8_t EcuReset(Ctx_t *c)', to: 'return 0U;', hl: ['return UDS_NRC_SUBFUNC_NOT_SUPP_IN_SESSION;', 's_pendingReset = type;   /* executed after the response is on the bus */'],
                  ex: [['/* Design choice of this ECU: resets only from the extended session. */', 'Quyết định thiết kế, không phải yêu cầu bắt buộc của chuẩn.'], ['s_pendingReset = type;   /* executed after the response is on the bus */', 'Chỉ ghi nhận, chưa reset.']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'static void OnEcuResponseSent(void *ctx, IsoTp_Result_t result)', n: 8, hl: ['Uds_ExecutePendingReset();   /* a reset only after its response is on the bus */'],
                  ex: [['if (result == ISOTP_OK)', 'Gửi lỗi (ví dụ timeout FC) thì không reset.']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'static void EcuReset(uint8_t resetType)', to: 'SysDrv_Restart();   /* see sys_drv.h: the core must not really reset */', hl: ['ControlApp_SoftReset();'] },
                { f: 'control_ecu/CM4/Core/Mcal/sys_drv.c', from: 'void SysDrv_Restart(void)', to: 'resetHandler();', hl: ['__set_MSP(initialSp);', 'resetHandler();'],
                  ex: [['const uint32_t *vectors = (const uint32_t *)SCB->VTOR;', 'Đọc bảng vector: ô 0 là stack pointer ban đầu, ô 1 là địa chỉ Reset_Handler. Ép kiểu này là deviation D6.'], ['__HAL_RCC_FDCAN_FORCE_RESET();', 'Đưa ngoại vi của M4 về trạng thái reset để HAL khởi tạo lại từ đầu; FDCAN rời bus sạch sẽ.'], ['__set_CONTROL(0U);', 'Đang chạy trong task (process stack): quay về main stack, chế độ privileged, như sau reset.'], ['resetHandler();', 'Nhảy tới Reset_Handler: firmware khởi động lại như bật nguồn.']] },
              ],
              explain: `Một lệnh UDS đi qua 4 lớp: server (quyết định), ISO-TP (báo đã gửi), diag_app (chọn loại reset), MCAL (thực hiện). Mỗi lớp chỉ làm phần của mình.`,
              run: ['Tester: ⟦10 03⟧ → extended.', 'Tester: ⟦11 01⟧ → server ghi pending = 01, response ⟦51 01⟧.', 'ISO-TP gửi SF ⟦02 51 01⟧, gọi ⟦OnEcuResponseSent(OK)⟧.', '⟦Uds_ExecutePendingReset⟧ → ⟦EcuReset(1)⟧ → ⟦SysDrv_Restart⟧.', 'Firmware chạy lại từ Reset_Handler; vài trăm ms sau ECU trả lời lại tester.'],
              fig: { type: 'seq', actors: ['Tester', 'uds_server', 'ISO-TP', 'diag_app', 'sys_drv'], msgs: [[0, 1, '11 01'], [1, 1, 's_pendingReset = 1'], [1, 2, '51 01'], [2, 0, 'SF 02 51 01'], [2, 3, 'txConfirmation(OK)'], [3, 1, 'Uds_ExecutePendingReset()'], [1, 3, 'ecuReset(1)'], [3, 4, 'SysDrv_Restart()'], [4, 4, 'nhảy tới Reset_Handler']] },
              video: { t: 'Reset sau khi đã trả lời', d: '2:00', goal: 'Chuỗi 4 file và bài học trên MP157.',
                s: ['11 01 ở default: 7F 11 7E.', 'Vào extended, 11 01: response 51 01 ra bus trước.', 'txConfirmation kích reset.', 'Vì sao NVIC_SystemReset làm M4 chết hẳn.', 'Tester hỏi lại sau 3 s: ECU trả lời.'] },
              pit: [
                ['Reset ngay trong hàm service', 'Response không bao giờ ra bus, tester báo timeout.'],
                ['Dùng ⟦NVIC_SystemReset()⟧ trên M4 của MP157', 'M4 bị giữ trong reset cho tới khi Linux khởi động lại nó qua remoteproc.'],
                ['Nghĩ DTC còn sau hard reset', 'DTC chỉ ở RAM; ⟦Reset_Handler⟧ khởi tạo lại RAM. GoogleTest ⟦HardResetLosesDtcsBecauseTheyAreInRam⟧ ghi lại điều này.'],
              ],
              ex: { task: `Soft reset (⟦11 03⟧) làm những gì? Đọc {{control_ecu/CM4/Core/App/control_app.c@void ControlApp_SoftReset(void)}}.`, sol: `Đồng bộ lại hai bộ kiểm E2E (⟦E2e_InitRx⟧ cho 0x100 và 0x101), bắt đầu operation cycle mới cho DTC manager, in log. Không khởi động lại firmware, DTC vẫn còn.` },
              quiz: [
                ['Reset thật sự chạy ở đâu?', ['Trong EcuReset của server', 'Trong txConfirmation của ISO-TP, sau khi response đã gửi', 'Trong Monitor task', 'Trong ISR'], 1, '⟦OnEcuResponseSent⟧ gọi ⟦Uds_ExecutePendingReset⟧.'],
                ['Vì sao ⟦SysDrv_Restart⟧ không reset lõi M4?', ['Để nhanh hơn', 'Vì Linux sở hữu vòng đời M4; reset lõi làm M4 bị giữ trong reset', 'Vì MISRA', 'Vì thiếu bộ nhớ'], 1, 'Comment trong ⟦sys_drv.h⟧.'],
              ],
              sum: ['Server ghi nhận, ISO-TP báo đã gửi, diag_app thực hiện.', 'Hard reset = nhảy về Reset_Handler, không reset lõi.', 'Hard reset làm mất DTC (RAM).'],
            },
            {
              id: '9.1.6', t: 'diag_app.c: nối ISO-TP, UDS và DTC trên Control ECU', min: 20, pre: ['9.1.5'],
              concepts: [
                ['Glue code', 'Code mỏng nối các module độc lập với nhau và với nền tảng (RTOS, CAN).'],
                ['Functional request', 'Request trên 0x7DF; chỉ Single Frame, không qua link ISO-TP.'],
                ['Self-test', 'Link ISO-TP thứ hai đóng vai tester, chỉ bật trong loopback.'],
              ],
              goal: `Bạn thấy toàn cảnh chẩn đoán trên Control ECU: từ khung CAN tới UDS và ngược lại, trong một file duy nhất.`,
              bg: `⟦isotp.c⟧, ⟦uds_server.c⟧, ⟦dtc_manager.c⟧ không biết nhau và không biết nền tảng. ⟦diag_app.c⟧ là nơi duy nhất ghép chúng lại cho Control ECU.`,
              th: `⟦diag_app.c⟧ làm 5 việc:
1. **Cấu hình:** bảng DTC (5 mã), bảng DID (3), khởi tạo DTC manager với lock/unlock FreeRTOS, UDS server với clock + reset callback, link ISO-TP ECU (TX 0x7E8, RX 0x7E0, buffer 256, BS 0, STmin 0).
2. **Nhận:** ⟦DiagApp_OnFrame⟧: 0x7E0 → ⟦IsoTp_RxFrame⟧; 0x7DF → kiểm là SF hợp lệ rồi ⟦RespondTo(…, functional = true)⟧ trực tiếp; 0x7E8 → link tester (chỉ self-test).
3. **Xử lý:** ⟦OnEcuRequest⟧ (rxIndication) → ⟦RespondTo⟧ → ⟦Uds_ProcessRequest⟧ → nếu độ dài > 0 thì ⟦IsoTp_Transmit⟧.
4. **Định kỳ:** ⟦DiagApp_MainFunction⟧ → ⟦IsoTp_MainFunction⟧ + ⟦Uds_MainFunction⟧ (+ self-test).
5. **Cầu nối DTC:** ⟦DiagApp_ReportFault⟧ (Monitor gọi) và ⟦DiagApp_ConfirmedDtcCount⟧ (cho 0x200 và log).`,
              use: `Self-test 14 bước (M3) chạy khi ⟦CONTROL_APP_CAN_LOOPBACK⟧ = 1 ([[1.2.1]]).`,
              code: [
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'static void RespondTo(const uint8_t *req', to: 'static void OnEcuResponseSent', hl: ['uint16_t respLen = Uds_ProcessRequest(req, len, functional, s_respBuf, sizeof(s_respBuf));'],
                  ex: [['if (respLen > 0U)', 'Độ dài 0 nghĩa là im lặng (suppress hoặc NRC functional bị chặn).'], ['RespondTo(data, length, false);', 'Request physical hoàn chỉnh từ ISO-TP.']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'void DiagApp_OnFrame(const CanDrv_Frame_t *frame)', to: 'void DiagApp_MainFunction(void)', hl: ['if (((frame->data[0] >> 4U) == 0U) && (len > 0U) && (len < frame->dlc))', 'RespondTo(&frame->data[1], len, true);'],
                  ex: [['IsoTp_RxFrame(&s_ecuLink, frame->data, frame->dlc);', 'Physical: qua ISO-TP (có thể nhiều khung).'], ['/* Functional requests are single frames only (ISO 15765-2). */', 'Functional: chỉ SF, xử lý trực tiếp.'], ['if (((frame->data[0] >> 4U) == 0U) && (len > 0U) && (len < frame->dlc))', 'Kiểm PCI = SF và độ dài hợp lệ.']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'void DiagApp_ReportFault(uint8_t index, bool failed)', to: 'return DtcMgr_CountByStatusMask(DTC_STATUS_CDTC);', hl: ['DtcMgr_ReportResult(index, failed);'] },
              ],
              explain: `Response cho request functional vẫn đi qua link ISO-TP của ECU (trên 0x7E8), vì response có thể dài; chỉ request functional mới bị giới hạn SF.`,
              run: ['ComRx nhận khung 0x7DF ⟦02 3E 00 …⟧ → ⟦DiagApp_OnFrame⟧.', 'PCI 0 (SF), len 2 < 8 → ⟦RespondTo(3E 00, true)⟧.', 'Server trả ⟦7E 00⟧ (2 byte).', '⟦IsoTp_Transmit⟧ trên link ECU → SF trên 0x7E8.'],
              fig: { type: 'layers', rows: [['Vào', ['ComRx: DiagApp_OnFrame(0x7E0 / 0x7DF)', 'Monitor: DiagApp_ReportFault']], ['diag_app.c', ['IsoTp link ECU 0x7E8/0x7E0', 'RespondTo', 'OnEcuRequest', 'OnEcuResponseSent', 'EcuReset', 'bảng DID, bảng DTC', 'self-test (loopback)']], ['common/', ['isotp.c', 'uds_server.c', 'dtc_manager.c']], ['Ra', ['ControlApp_CanSend', 'SysDrv_Restart', 'ControlApp_SoftReset']]] },
              video: { t: 'diag_app: nơi mọi thứ gặp nhau', d: '1:45', goal: 'Toàn cảnh chẩn đoán.',
                s: ['Ba module common độc lập.', 'diag_app cấu hình và nối chúng.', 'Physical qua ISO-TP, functional trực tiếp.', 'Monitor báo lỗi qua DiagApp_ReportFault.'] },
              pit: [
                ['Đưa request functional nhiều khung vào ISO-TP', 'Chuẩn không cho phép; nhiều ECU sẽ cùng gửi FC. Code chỉ chấp nhận SF trên 0x7DF.'],
                ['Gọi ⟦DiagApp_…⟧ từ hai task khác nhau cho phần ISO-TP/UDS', 'Không re-entrant. ISO-TP/UDS chỉ chạy trong ComRx; Monitor chỉ đụng DTC (có khóa).'],
              ],
              ex: { task: `Liệt kê theo thứ tự các hàm được gọi khi tester gửi ⟦19 01 08⟧ physical, từ ⟦OnCanRx⟧ đến lúc response vào TX FIFO.`, sol: `⟦OnCanRx⟧ (ISR) → queue → ⟦ComRxTask⟧ → ⟦DiagApp_OnFrame⟧ → ⟦IsoTp_RxFrame⟧ → ⟦RxOnSingleFrame⟧ → ⟦RxFinish⟧ → ⟦OnEcuRequest⟧ → ⟦RespondTo⟧ → ⟦Uds_ProcessRequest⟧ → ⟦ReadDtc⟧ → ⟦DtcMgr_CountByStatusMask⟧ → ⟦IsoTp_Transmit⟧ → ⟦TxSendFirst⟧ → ⟦SendFrame⟧ → ⟦ControlApp_CanSend⟧ → ⟦CanDrv_Write⟧.` },
              quiz: [
                ['Request trên 0x7DF được xử lý thế nào?', ['Qua link ISO-TP như 0x7E0', 'Kiểm SF rồi gọi RespondTo trực tiếp với functional = true', 'Bỏ qua', 'Chuyển cho Monitor'], 1, 'Functional chỉ dùng SF.'],
                ['Hàm nào nối kết quả monitor với DTC manager?', ['RespondTo', 'DiagApp_ReportFault', 'OnEcuRequest', 'IsoTp_MainFunction'], 1, 'Monitor gọi ⟦DiagApp_ReportFault⟧ mỗi 10 ms.'],
              ],
              sum: ['diag_app = glue: cấu hình, nhận, xử lý, định kỳ, cầu nối DTC.', 'Physical qua ISO-TP; functional chỉ SF.', 'ISO-TP/UDS chỉ chạy trong ComRx.'],
            },
          ],
        },
      ],
    },
  ],
};
