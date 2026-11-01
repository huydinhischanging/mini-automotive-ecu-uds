// Intermediate, chapter 10: the DTC manager.
module.exports = {
  level: { id: 'intermediate' },
  chapters: [
    {
      id: 'c10', t: 'Quản lý mã lỗi (DTC)',
      lessons: [
        {
          id: '10.1', t: 'dtc_manager.c',
          subs: [
            {
              id: '10.1.1', t: 'Status byte 8 bit theo ISO 14229-1', min: 25, pre: ['2.1.1', '9.1.1'],
              concepts: [
                ['testFailed (bit 0)', 'Kết quả của lần chạy test gần nhất là fail.'],
                ['pendingDTC (bit 2)', 'Đã fail trong operation cycle này hoặc cycle trước.'],
                ['confirmedDTC (bit 3)', 'Đã fail đủ số lần liên tiếp; giữ đến khi bị xóa.'],
                ['Availability mask', 'Các bit server hỗ trợ: 0x7F (mọi bit trừ bit 7 warningIndicator).'],
              ],
              goal: `Bạn đọc được mọi status byte (ví dụ 0x2F, 0x2E, 0x50) và giải thích từng bit nói gì về lịch sử của lỗi.`,
              bg: `Một DTC không chỉ có "có lỗi" hay "không lỗi". Thợ sửa xe cần biết: lỗi đang xảy ra không? Đã xảy ra trong chuyến đi này chưa? Đã được xác nhận chưa? Từ lần xóa cuối có từng lỗi không? Mỗi câu hỏi là một bit.`,
              th: `| Bit | Tên | Bật khi | Tắt khi |
|---|---|---|---|
| 0 | TF testFailed | lần test này fail | lần test này pass |
| 1 | TFTOC failed this op. cycle | fail trong cycle này | bắt đầu cycle mới |
| 2 | PDTC pending | fail | cycle mới mà cycle trước không fail |
| 3 | CDTC confirmed | fail đủ ngưỡng liên tiếp | chỉ khi xóa (0x14) |
| 4 | TNCSLC not completed since clear | sau khi xóa / khởi động | test chạy lần đầu |
| 5 | TFSLC failed since clear | fail | chỉ khi xóa |
| 6 | TNCTOC not completed this cycle | bắt đầu cycle | test chạy trong cycle |
| 7 | WIR warning indicator | (không hỗ trợ) | |

**Đọc nhanh vài giá trị:**
- ⟦0x50⟧ = TNCSLC | TNCTOC: vừa xóa/khởi động, chưa test.
- ⟦0x2F⟧ = TF | TFTOC | PDTC | CDTC | TFSLC: lỗi **đang** xảy ra và đã confirmed.
- ⟦0x2E⟧ = như trên nhưng TF tắt: lỗi **đã hết** nhưng lịch sử còn (log M5).
- ⟦0x00⟧: đã test, chưa bao giờ fail kể từ lần xóa.`,
              use: `Server trả status ⟦& 0x7F⟧ cho tester; client C++ có ⟦summarizeStatus⟧ để in "failed pending confirmed" ({{tester/src/dtc.cpp@std::string summarizeStatus}}).`,
              code: [
                { f: 'common/dtc/dtc_manager.h', from: ' *   bit 0  testFailed', to: '#define DTC_STATUS_AVAILABILITY_MASK', hl: ['#define DTC_STATUS_AVAILABILITY_MASK'],
                  ex: [[' *   bit 3  confirmedDTC', 'Ngưỡng confirm cấu hình riêng cho từng DTC.'], [' *   bit 7  warningIndicatorRequested', 'Không hỗ trợ: luôn 0.'], ['#define DTC_STATUS_AVAILABILITY_MASK', 'Mask 0x7F dựng từ hằng WIR (sửa MISRA 2.5: macro không dùng nay có công dụng).']] },
                { f: 'common/dtc/dtc_manager.c', from: '/* After a clear or at power-up, nothing has been tested yet. */', n: 2, hl: ['#define STATUS_INITIAL'],
                  ex: [['#define STATUS_INITIAL', 'Trạng thái ban đầu 0x50: chưa test từ lần xóa, chưa test trong cycle này.']] },
              ],
              explain: `Status byte là một **lịch sử nén** của test: chỉ 8 bit mà trả lời được 7 câu hỏi khác nhau. Dùng công cụ ở phần Minh họa để bật tắt từng bit.`,
              run: ['Khởi động: status = 0x50.', 'Monitor chạy lần đầu, pass: TNC bits tắt → 0x00.', 'Lỗi xuất hiện: TF, TFTOC, PDTC, TFSLC bật → 0x27; đủ ngưỡng → CDTC → 0x2F.', 'Lỗi hết (pass): TF tắt → 0x2E.', '⟦14 FF FF FF⟧: về 0x50.'],
              fig: { type: 'widget', name: 'dtcbits' },
              figCap: 'Nhập status (hex) hoặc bật/tắt từng bit; nhập mã 3 byte để đổi sang dạng SAE J2012.',
              video: { t: 'Đọc status byte trong 90 giây', d: '1:30', goal: '0x50, 0x2F, 0x2E.',
                s: ['8 ô bit, tên từng ô.', '0x50 sau khi xóa.', 'Lỗi đang xảy ra: 0x2F.', 'Lỗi đã hết: 0x2E.', 'Vì sao confirmed không tự mất.'] },
              pit: [
                ['Nghĩ confirmed nghĩa là lỗi đang xảy ra', 'Confirmed là lịch sử; lỗi đang xảy ra là bit 0 (TF).'],
                ['Đọc DTC bằng mask 0xFF ngay sau khởi động', 'Mọi DTC có 0x50 khớp mask → liệt kê cả DTC chưa từng lỗi. Client C++ dùng mask ⟦TF | PDTC | CDTC⟧ để tránh điều này.'],
              ],
              ex: { task: `Giải mã ⟦0x24⟧ và ⟦0x08⟧. Trường hợp nào có thể xảy ra trong project?`, sol: `⟦0x24⟧ = PDTC | TFSLC: đã fail (pending, failed since clear) nhưng chưa confirmed và lần test gần nhất pass, chưa fail trong cycle này: xảy ra sau soft reset khi cycle trước có fail chưa đủ ngưỡng. ⟦0x08⟧ chỉ CDTC thì không xảy ra, vì confirmed luôn đi cùng TFSLC (cả hai chỉ tắt khi xóa).` },
              quiz: [
                ['Status 0x2E nói gì?', ['Lỗi đang xảy ra', 'Lỗi đã confirmed, hiện đã hết (TF = 0)', 'Chưa test', 'Không có lỗi bao giờ'], 1, '0x2E = TFTOC | PDTC | CDTC | TFSLC.'],
                ['Bit nào chỉ tắt khi tester xóa DTC?', ['TF', 'TNCTOC', 'CDTC và TFSLC', 'PDTC'], 2, 'Không có aging trong project.'],
              ],
              sum: ['8 bit = lịch sử nén của một test.', '0x50 chưa test · 0x2F đang lỗi · 0x2E đã hết.', 'Mask hỗ trợ 0x7F.'],
            },
            {
              id: '10.1.2', t: 'Báo kết quả, debounce và ngưỡng confirm', min: 20, pre: ['10.1.1', '7.1.4'],
              concepts: [
                ['Debounce theo bộ đếm', 'Lỗi chỉ confirmed khi fail N lần liên tiếp; một lần pass reset bộ đếm.'],
                ['confirmThreshold', 'N của từng DTC: 1 cho timeout, 3 cho các DTC khác.'],
                ['Monitor-driven', 'DTC manager không tự kiểm gì; nó chỉ nhận kết quả pass/fail.'],
              ],
              goal: `Bạn mô phỏng được trong đầu từng lần gọi ⟦DtcMgr_ReportResult⟧ và tính được khi nào một DTC chuyển confirmed.`,
              bg: `Một lần fail đơn lẻ có thể là nhiễu. Debounce yêu cầu lỗi lặp lại để chắc chắn trước khi ghi nhận vĩnh viễn (confirmed).`,
              th: `⟦DtcMgr_ReportResult(index, failed)⟧, gọi mỗi 10 ms cho mỗi monitor:
1. Tắt TNCTOC và TNCSLC (test đã chạy).
2. **Fail:** bật TF, TFTOC, TFSLC, PDTC; tăng ⟦failCount⟧ (bão hòa 255); nếu ⟦failCount ≥ threshold⟧ → bật CDTC.
3. **Pass:** tắt TF; ⟦failCount = 0⟧ (fail phải liên tiếp).

Ngưỡng: U0100-87 (timeout) = 1 vì monitor timeout đã có độ trễ 100 ms sẵn; các DTC khác = 3, tức 3 chu kỳ = 30 ms fail liên tục.

**Độ phức tạp:** O(1) mỗi lần báo; bộ nhớ 2 byte mỗi DTC (status + failCount).`,
              use: `Monitor gọi ⟦DiagApp_ReportFault⟧ → ⟦DtcMgr_ReportResult⟧ cho cả 5 monitor mỗi chu kỳ ([[7.1.4]]). Trên PC, test ⟦test_confirmation_needs_consecutive_failures⟧ kiểm logic debounce.`,
              code: [
                { f: 'common/dtc/dtc_manager.c', from: 'void DtcMgr_ReportResult(uint8_t index, bool failed)', to: 'Unlock();', hl: ['if (e->failCount >= threshold)', 'e->failCount = 0U;                  /* debounce: failures must be consecutive */'],
                  ex: [['threshold = (s_table[index].confirmThreshold == 0U) ? 1U : s_table[index].confirmThreshold;', 'Phòng thủ: ngưỡng 0 được hiểu là 1.'], ['if (e->failCount < 0xFFU)', 'Bão hòa, không tràn về 0.'], ['e->status |= DTC_STATUS_CDTC;   /* stays set until cleared (no aging yet) */', 'Không có aging: confirmed giữ mãi đến khi xóa.'], ['e->failCount = 0U;                  /* debounce: failures must be consecutive */', 'Một lần pass xóa bộ đếm.']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'static const DtcMgr_Config_t k_dtcTable[] =', to: '};', hl: ['{ 0xC10087UL, 1U },'] },
              ],
              explain: `DTC manager không biết lỗi là gì (timeout hay E2E): nó chỉ có chỉ số 0..4 và kết quả. Thứ tự chỉ số phải khớp ⟦Fault_t⟧ ([[11.1.2]]).`,
              run: ['Chu kỳ 1: E2E fail → failCount 1, status 0x27.', 'Chu kỳ 2: fail → failCount 2.', 'Chu kỳ 3: fail → failCount 3 ≥ 3 → CDTC → 0x2F.', 'Chu kỳ 4: pass → TF tắt, failCount 0 → 0x2E.'],
              fig: { type: 'flow', nodes: [['DtcMgr_ReportResult(i, failed)', 'start'], 'Lock(); tắt TNCTOC, TNCSLC', ['failed?', 'dec'], ['Fail: bật TF, TFTOC, TFSLC, PDTC; failCount++', 'bad'], ['failCount ≥ threshold → bật CDTC', 'bad'], ['Pass: tắt TF; failCount = 0', 'ok'], ['Unlock()', 'end']] },
              video: { t: 'Debounce 3 lần liên tiếp', d: '1:15', goal: 'Khi nào confirmed.',
                s: ['Dãy fail fail pass fail fail fail.', 'failCount: 1 2 0 1 2 3.', 'Chỉ ở lần cuối CDTC bật.', 'Timeout: ngưỡng 1, confirmed ngay.'] },
              pit: [
                ['Chỉ gọi ReportResult khi fail', 'failCount không bao giờ về 0, các lần fail rời rạc cộng dồn thành confirmed sai.'],
                ['Đặt ngưỡng lớn cho timeout', 'Timeout đã chờ 100 ms; ngưỡng 3 làm DTC trễ thêm 20 ms mà không thêm giá trị.'],
              ],
              ex: { task: `Dãy kết quả cho DTC ngưỡng 3: ⟦F F P F F P F F F⟧. CDTC bật ở lần báo thứ mấy?`, sol: `failCount: 1 2 0 1 2 0 1 2 3 → bật ở lần thứ 9.` },
              quiz: [
                ['Ngưỡng confirm của U0100-87 là bao nhiêu?', ['0', '1', '3', '10'], 1, 'Timeout đã có độ trễ sẵn.'],
                ['Kết quả pass ảnh hưởng gì?', ['Xóa CDTC', 'Tắt TF và reset failCount', 'Không gì', 'Tắt PDTC'], 1, 'CDTC chỉ tắt khi xóa; PDTC chỉ tắt khi đổi cycle.'],
              ],
              sum: ['Mỗi chu kỳ báo pass/fail cho mỗi DTC.', 'Fail N lần liên tiếp → confirmed.', 'Pass reset bộ đếm, tắt TF.'],
            },
            {
              id: '10.1.3', t: 'Operation cycle, xóa DTC, đọc theo mask và mã SAE J2012', min: 25, pre: ['10.1.2'],
              concepts: [
                ['Operation cycle', 'Thường là một chu kỳ bật/tắt khóa điện. Ở đây bắt đầu bằng soft reset ⟦11 03⟧.'],
                ['Đọc theo mask', '⟦19 02 mask⟧ trả mọi DTC có ⟦status & mask & 0x7F ≠ 0⟧.'],
                ['SAE J2012', 'Định dạng mã: chữ cái hệ thống (P/C/B/U), 4 chữ số và failure type byte.'],
              ],
              goal: `Bạn hiểu ba thao tác còn lại của DTC manager và đổi được mã 3 byte (0xC10087) thành chuỗi quen thuộc (U0100-87).`,
              bg: `Pending phải được "làm già": nếu cả một chuyến đi không thấy lỗi, pending tắt. Đó là việc của ranh giới operation cycle.`,
              th: `**⟦DtcMgr_StartOperationCycle⟧:** với mỗi DTC, nếu cycle vừa qua **không** fail (TFTOC = 0) → tắt PDTC; tắt TFTOC; bật TNCTOC.

**⟦DtcMgr_ClearAll⟧** (từ ⟦14 FF FF FF⟧): mọi status về 0x50, failCount về 0.

**⟦DtcMgr_GetByStatusMask⟧** (từ ⟦19 02⟧): duyệt tuyến tính, ghi bản ghi 4 byte ⟦[code hi, mid, lo, status & 0x7F]⟧ cho DTC khớp; server kiểm đủ chỗ trước (NRC 0x14 nếu không).

**Mã SAE J2012:** byte 0 bit 7-6 chọn chữ (00 P, 01 C, 10 B, 11 U), bit 5-4 là chữ số đầu, bit 3-0 chữ số thứ hai (hex); byte 1 là hai chữ số tiếp; byte 2 là failure type. ⟦0xC10087⟧ → 1100 0001 → U, 0, 1 → ⟦U01⟧ + ⟦00⟧ → ⟦U0100⟧, failure type ⟦87⟧ = missing message. Bảng ánh xạ mã ↔ lỗi là riêng của project.`,
              use: `Client C++ có ⟦formatDtc⟧ và ⟦parseDtcRecords⟧ ({{tester/src/dtc.cpp}}); server tạo response ⟦59 02 7F …⟧ trong ⟦ReadDtc⟧ ({{common/uds/uds_server.c@static uint8_t ReadDtc(Ctx_t *c)}}).`,
              code: [
                { f: 'common/dtc/dtc_manager.c', from: 'void DtcMgr_StartOperationCycle(void)', to: 'void DtcMgr_ClearAll(void)', hl: ['e->status &= (uint8_t)~DTC_STATUS_PDTC;'],
                  ex: [['if ((e->status & DTC_STATUS_TFTOC) == 0U)', 'Cycle vừa qua không fail: pending hết.'], ['e->status |= DTC_STATUS_TNCTOC;', 'Cycle mới: chưa test lần nào.']] },
                { f: 'common/dtc/dtc_manager.c', from: 'uint8_t DtcMgr_GetByStatusMask(uint8_t mask', to: 'return n;', after: 'uint8_t DtcMgr_CountByStatusMask', hl: ['if ((status & mask & DTC_STATUS_AVAILABILITY_MASK) != 0U)'],
                  ex: [['if ((status & mask & DTC_STATUS_AVAILABILITY_MASK) != 0U)', 'Khớp khi có ít nhất một bit chung với mask.'], ['rec[3] = (uint8_t)(status & DTC_STATUS_AVAILABILITY_MASK);', 'Bản ghi thứ 4 byte: status chỉ gồm các bit được hỗ trợ.']] },
                { f: 'tester/src/dtc.cpp', from: 'std::string formatDtc(std::uint32_t code)', to: 'return s;', hl: ["s += kSystem[b0 >> 6];"],
                  ex: [["static constexpr char kSystem[] = {'P', 'C', 'B', 'U'};", 'Hai bit cao của byte 0 chọn chữ cái.'], ["s += static_cast<char>('0' + ((b0 >> 4) & 0x03));", 'Chữ số đầu chỉ 0..3 (2 bit).'], ['s += hex2(b2);   // failure type byte', 'Byte cuối sau dấu gạch.']] },
              ],
              explain: `Cả ba thao tác đều duyệt tuyến tính 5 DTC (O(n) với n ≤ 16). Với số DTC nhỏ, mảng tuyến tính đơn giản và nhanh hơn mọi cấu trúc phức tạp.`,
              run: ['Tester ⟦19 02 FF⟧ → ⟦ReadDtc⟧ đếm DTC khớp, kiểm đủ chỗ.', '⟦DtcMgr_GetByStatusMask(0xFF, …)⟧ ghi bản ghi U0100-87, status 0x2E.', 'Response ⟦59 02 7F C1 00 87 2E⟧ (7 byte, SF).', 'Client ⟦parseDtcRecords⟧ tách, ⟦formatDtc⟧ in "U0100-87 2E pending confirmed".'],
              fig: { type: 'bytes', title: '0xC10087 → U0100-87', cells: [['byte 0 bit 7-6', '11 → U', 'hệ thống'], ['byte 0 bit 5-4', '00 → 0', 'chữ số 1'], ['byte 0 bit 3-0', '0001 → 1', 'chữ số 2'], ['byte 1', '00', 'chữ số 3-4'], ['byte 2', '87', 'failure type: missing message']] },
              video: { t: 'Từ 3 byte tới U0100-87', d: '1:30', goal: 'Định dạng SAE J2012.',
                s: ['Viết 0xC1 dạng nhị phân.', 'Tách 2-2-4 bit.', 'Ghép với byte 1 và failure type.', 'Thử 0x9A0011 → B1A00-11.'] },
              pit: [
                ['Xóa DTC rồi đọc ngay với mask 0xFF', 'Mọi DTC đều 0x50 cho tới chu kỳ monitor kế tiếp, khớp mask và bị liệt kê.'],
                ['Nghĩ 0x14 chỉ xóa confirmed', 'Ở đây xóa sạch về 0x50, kể cả bộ đếm debounce.'],
              ],
              ex: { task: `Đổi các mã trong ⟦k_dtcTable⟧ sang dạng SAE bằng công cụ ở [[10.1.1]]: ⟦050100⟧, ⟦C40081⟧, ⟦050096⟧.`, sol: `⟦P0501-00⟧, ⟦U0400-81⟧, ⟦P0500-96⟧.` },
              quiz: [
                ['Khi bắt đầu operation cycle mới, PDTC tắt nếu…', ['Luôn luôn', 'Cycle vừa qua không fail (TFTOC = 0)', 'DTC đã confirmed', 'Không bao giờ'], 1, 'Quy tắc ISO 14229-1 D.2.'],
                ['0x9A0011 là mã nào?', ['P1A00-11', 'B1A00-11', 'U1A00-11', 'C1A00-11'], 1, '0x9A = 10 01 1010 → B, 1, A.'],
              ],
              sum: ['Cycle mới làm già pending.', '0x14 xóa về 0x50.', '0x19 02 lọc theo mask, bản ghi 4 byte.', 'SAE J2012: 2-2-4 bit + 1 byte + failure type.'],
            },
          ],
        },
      ],
    },
  ],
};
