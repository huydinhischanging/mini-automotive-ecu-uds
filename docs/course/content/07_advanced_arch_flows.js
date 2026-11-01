// Advanced, chapters 11-12: system architecture and end-to-end flows.
module.exports = {
  level: { id: 'advanced', t: 'Toàn hệ thống', d: 'Kiến trúc, luồng end-to-end, tester C++ và OOP, kiểm thử, bring-up, thuật toán và dựng lại project từ đầu.' },
  chapters: [
    {
      id: 'c11', t: 'Kiến trúc hệ thống',
      lessons: [
        {
          id: '11.1', t: 'Lớp, phụ thuộc và quyết định thiết kế',
          subs: [
            {
              id: '11.1.1', t: 'Kiến trúc phân lớp và ánh xạ sang AUTOSAR Classic', min: 25, pre: ['4.1.1', '9.1.6'],
              concepts: [
                ['AUTOSAR Classic', 'Kiến trúc phần mềm chuẩn cho ECU: Application (SWC) – RTE – Basic Software (Services, ECU Abstraction, MCAL).'],
                ['Dcm / Dem / CanTp', 'Module AUTOSAR cho chẩn đoán (UDS), quản lý lỗi (DTC) và transport protocol trên CAN.'],
                ['RTE', 'Runtime Environment: lớp sinh tự động nối SWC với nhau và với BSW. Project không có.'],
              ],
              goal: `Bạn trình bày được kiến trúc của project bằng từ vựng của ngành (AUTOSAR), và nói rõ chỗ nào giống, chỗ nào đơn giản hóa.`,
              bg: `Phỏng vấn automotive gần như luôn hỏi AUTOSAR ở mức khái niệm. Phần AUTOSAR dưới đây là **kiến thức bổ trợ**; phần ánh xạ là phân tích code thật của project.`,
              th: `| Lớp AUTOSAR | Trong project | Ghi chú |
|---|---|---|
| Application (SWC) | ⟦sensor_app⟧, ⟦control_app⟧, ⟦diag_app⟧, ⟦tester_app⟧ | logic chức năng |
| RTE | không có | app gọi thẳng service; dữ liệu chung qua mutex |
| Services: Dcm | ⟦uds_server⟧ | 6 service, NRC, session, S3 |
| Services: Dem | ⟦dtc_manager⟧ | status ISO 14229, debounce, operation cycle |
| Services: OS | FreeRTOS + CMSIS-RTOS2 | chỉ Control ECU |
| Services: NvM | không có | DTC chỉ ở RAM |
| Communication: CanTp | ⟦isotp⟧ | SF/FF/CF/FC, BS, STmin, timeout |
| Library: E2E | ⟦e2e⟧ + ⟦crc8⟧ | rút gọn, không Data ID |
| MCAL | ⟦can_drv⟧, ⟦adc_drv⟧, ⟦io_drv⟧, ⟦gpio_drv⟧, ⟦uart_drv⟧, ⟦time_drv⟧, ⟦sys_drv⟧ | chỉ lớp này gọi HAL |

**Ba nguyên tắc kiến trúc thật sự có trong code:**
1. Phụ thuộc một chiều: App → common → (qua con trỏ hàm) nền tảng. ⟦common/⟧ không include gì của phần cứng.
2. Server không biết transport: UDS nhận một message hoàn chỉnh và trả độ dài response.
3. Chính sách ở ứng dụng, cơ chế ở module: E2E phân loại, ⟦control_app⟧ quyết định heal và safe state.`,
              use: `Tab "Bản đồ hệ thống" của website có sơ đồ lớp và đồ thị include trích tự động từ code.`,
              code: [
                { f: 'common/uds/uds_server.h', from: ' * The transport (ISO-TP) is not part of this module', n: 2, hl: [' * The transport (ISO-TP) is not part of this module'],
                  ex: [[' * The transport (ISO-TP) is not part of this module', 'Nguyên tắc 2 được ghi ngay trong header.']] },
                { f: 'common/isotp/isotp.h', from: ' * Hardware independent: the CAN driver and the clock are injected through', n: 2,
                  ex: [[' * Hardware independent:', 'Nguyên tắc 1: phần cứng đi vào qua cấu hình.']] },
                { f: 'common/dtc/dtc_manager.h', from: ' * Storage is RAM only', n: 3, hl: [' * Storage is RAM only (no NVM on this platform yet). Hardware independent.'],
                  ex: [[' * Storage is RAM only (no NVM on this platform yet). Hardware independent.', 'Giới hạn được ghi thẳng thắn: chưa có NvM.'], [' * Not re-entrant by itself:', 'Đồng bộ là việc của người dùng (qua lock/unlock).']] },
              ],
              explain: `Đọc comment đầu của các header trong ⟦common/⟧ là cách nhanh nhất để thấy kiến trúc: mỗi header nói rõ nó **không** làm gì.`,
              run: ['Ứng dụng (SWC) đọc cảm biến, quyết định, gọi service.', 'Service (Dcm/Dem/CanTp/E2E) xử lý giao thức, không biết phần cứng.', 'MCAL chuyển lời gọi thành thao tác HAL.', 'HAL ghi thanh ghi.'],
              fig: { type: 'layers', rows: [['Application (SWC)', ['sensor_app', 'control_app', 'diag_app', 'tester_app']], ['RTE', ['(không có: gọi trực tiếp + mutex)']], ['Services', ['Dcm ≈ uds_server', 'Dem ≈ dtc_manager', 'OS ≈ FreeRTOS', 'NvM: chưa có']], ['Communication', ['CanTp ≈ isotp', 'E2E ≈ e2e + crc8', 'COM ≈ can_matrix.h']], ['MCAL', ['Can ≈ can_drv', 'Adc ≈ adc_drv', 'Pwm/Dio ≈ io_drv, gpio_drv']]] },
              video: { t: 'Project trong khung AUTOSAR', d: '2:00', goal: 'Trả lời câu hỏi phỏng vấn về AUTOSAR.',
                s: ['Sơ đồ AUTOSAR Classic chuẩn.', 'Đặt từng module của project vào đúng ô.', 'Ô trống: RTE, NvM.', 'Ba nguyên tắc kiến trúc trong code.'] },
              pit: [
                ['Nói project "dùng AUTOSAR"', 'Project lấy ý tưởng phân lớp của AUTOSAR, không dùng stack AUTOSAR hay công cụ cấu hình. Nói "AUTOSAR-inspired".'],
                ['Bỏ qua các ô trống', 'Chủ động nói không có RTE và NvM cho thấy bạn hiểu rõ giới hạn.'],
              ],
              ex: { task: `Nếu thêm NvM để lưu DTC qua reset, module mới nằm ở lớp nào, và ⟦dtc_manager⟧ cần thay đổi gì về giao diện?`, sol: `NvM là Service, dưới nó là driver flash ở MCAL. ⟦dtc_manager⟧ nên nhận thêm callback đọc/ghi (dependency injection như lock/unlock) để vẫn không phụ thuộc phần cứng và vẫn test được trên PC.` },
              quiz: [
                ['Module nào của project tương ứng Dem trong AUTOSAR?', ['uds_server', 'dtc_manager', 'isotp', 'e2e'], 1, 'Dem = Diagnostic Event Manager.'],
                ['Lớp AUTOSAR nào project KHÔNG có?', ['MCAL', 'RTE', 'Services', 'Application'], 1, 'Ứng dụng gọi thẳng service.'],
              ],
              sum: ['App → Services/Communication → MCAL → HAL.', 'Dcm ≈ uds_server, Dem ≈ dtc_manager, CanTp ≈ isotp.', 'Không có RTE và NvM.'],
            },
            {
              id: '11.1.2', t: 'Đồ thị phụ thuộc và các bảng ghép theo chỉ số', min: 20, pre: ['11.1.1', '10.1.2'],
              concepts: [
                ['Đồ thị include', 'Đồ thị có hướng: file A include file B. Website trích tự động từ code.'],
                ['Ghép theo chỉ số', 'Nhiều bảng ở nhiều file phải cùng thứ tự; trình biên dịch không kiểm được.'],
                ['Bản sao có chủ đích', 'Dữ liệu được lặp lại ở nơi khác (ví dụ bảng DTC trong SimulatedEcu) và phải giữ đồng bộ.'],
              ],
              goal: `Bạn biết những chỗ trong code mà sửa một nơi bắt buộc phải sửa nơi khác, và vì sao trình biên dịch không giúp được.`,
              bg: `Mọi hệ thống đều có "khớp nối ẩn": các giả định giữa module không được kiểu dữ liệu biểu diễn. Biết chúng là điều phân biệt người hiểu hệ thống với người chỉ đọc từng file.`,
              th: `**Khớp nối 1, chỉ số lỗi:** ⟦Fault_t⟧ (control_app.c) đánh số 0..4; Monitor gọi ⟦DiagApp_ReportFault(i, …)⟧ với chỉ số đó; ⟦k_dtcTable[i]⟧ (diag_app.c) phải là DTC tương ứng; ⟦enum class Monitor⟧ (tester C++) và ⟦kDtcTable⟧ trong ⟦simulated_ecu.cpp⟧ lặp lại cùng thứ tự. Bit trong fault mask (DID 0x0101, khung 0x200) cũng theo thứ tự này.

**Khớp nối 2, E2E và fault injection:** khi bạn thêm các mode E2E ([[5.1.4]]), chu kỳ hỏng trong ⟦sensor_app.c⟧ phải ≤ ⟦E2E_HEAL_FRAMES⟧ (control_app.c), nếu không lỗi E2E bật tắt.

**Khớp nối 3, filter:** ⟦MAX_STD_FILTERS⟧ (can_drv.c Control) phải khớp ⟦StdFiltersNbr⟧ của CubeMX.

**Khớp nối 4, phiên bản:** chuỗi ⟦"CTRL-0.3.0"⟧ có trong ⟦diag_app.c⟧ (và self-test), và trong ⟦simulated_ecu.cpp⟧.

Các khớp nối này được ghi trong ⟦CLAUDE.md⟧ và skill ⟦/ecu-check⟧ của repo để không bị quên.`,
              use: `Cách làm cho an toàn hơn (gợi ý, chưa làm): đặt bảng DTC vào ⟦common/⟧ và để cả firmware lẫn tester dùng chung, hoặc thêm một test so sánh hai bảng.`,
              code: [
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'typedef enum', to: '} Fault_t;', hl: ['FAULT_SPEED_TIMEOUT = 0,'] },
                { f: 'tester/include/uds/control_ecu.hpp', from: '/** Monitors of the Control ECU, in DTC table order. */', to: 'inline constexpr std::size_t kMonitorCount = 5U;', hl: ['SpeedTimeout,   ///< U0100-87'],
                  ex: [['/** Monitors of the Control ECU, in DTC table order. */', 'Comment ghi rõ giả định về thứ tự.']] },
                { f: 'tester/src/simulated_ecu.cpp', from: '// Same DTC table as diag_app.c: code, confirm threshold.', to: '};', hl: ['// Same DTC table as diag_app.c: code, confirm threshold.'],
                  ex: [['// Same DTC table as diag_app.c: code, confirm threshold.', 'Bản sao có chủ đích, có comment trỏ về nguồn.']] },
              ],
              explain: `So ba khối: cùng thứ tự timeout, range, E2E, ADC, output. Không có dòng code nào bắt lỗi nếu ai đó chèn một monitor vào giữa ở chỉ một nơi.`,
              run: ['Monitor đặt ⟦s_faults[FAULT_SPEED_E2E]⟧ (chỉ số 2).', '⟦DiagApp_ReportFault(2, true)⟧ → ⟦k_dtcTable[2]⟧ = U0400-81.', 'Fault mask bit 2 → 0x04 trong 0x200 và DID 0x0101.', 'Tester C++ hiểu bit 2 là ⟦Monitor::E2e⟧.'],
              fig: { type: 'layers', rows: [['control_app.c', ['Fault_t: TIMEOUT, RANGE, E2E, ADC, LOCAL', 'fault mask bit 0..4']], ['diag_app.c', ['k_dtcTable: U0100-87, P0501-00, U0400-81, P0500-96, B1A00-11']], ['tester C++', ['enum class Monitor (control_ecu.hpp)', 'kDtcTable (simulated_ecu.cpp)']], ['README', ['bảng Fault → DTC']]] },
              video: { t: 'Khớp nối mà trình biên dịch không thấy', d: '1:30', goal: 'Bốn chỗ phải sửa cùng lúc.',
                s: ['Mở 3 file cạnh nhau: cùng thứ tự.', 'Chèn thử một monitor ở chỉ một file.', 'Hậu quả: DTC sai, fault mask sai, tester hiểu sai.', 'Cách phòng: CLAUDE.md, /ecu-check, hoặc bảng dùng chung.'] },
              pit: [
                ['Thêm monitor mới ở cuối ⟦Fault_t⟧ mà quên ⟦k_dtcTable⟧', '⟦DtcMgr_ReportResult⟧ bỏ qua chỉ số ngoài bảng (an toàn nhưng lỗi im lặng không có DTC).'],
                ['Đổi phiên bản firmware mà quên self-test', 'Bước "ReadDID F195" của self-test so tiền tố đầy đủ chuỗi phiên bản và sẽ FAIL.'],
              ],
              ex: { task: `Viết một test (ý tưởng) bắt lỗi lệch bảng DTC giữa firmware và tester C++.`, sol: `Ví dụ: trong GoogleTest, gửi ⟦19 02 FF⟧ tới SimulatedEcu sau khi ⟦reportMonitor(Monitor::E2e, true)⟧ ba lần, kiểm DTC trả về là ⟦0xC40081⟧. Test này hiện chỉ bảo vệ bản sao trong SimulatedEcu; muốn bảo vệ cả ⟦diag_app.c⟧ thì phải đưa bảng vào một header chung.` },
              quiz: [
                ['Bit 2 của fault mask (0x04) nghĩa là lỗi gì?', ['Timeout', 'Range', 'E2E', 'Output cục bộ'], 2, 'Theo thứ tự ⟦Fault_t⟧.'],
                ['Vì sao trình biên dịch không phát hiện lệch thứ tự giữa ⟦Fault_t⟧ và ⟦k_dtcTable⟧?', ['Vì thiếu warning flag', 'Vì liên hệ chỉ là quy ước chỉ số, không được biểu diễn trong kiểu dữ liệu', 'Vì MISRA tắt kiểm tra', 'Vì khác file'], 1, 'Giả định nằm trong đầu người viết, không trong code.'],
              ],
              sum: ['Thứ tự lỗi khớp ở 4 nơi + README.', 'Chu kỳ fault injection ≤ heal frames.', 'Ghi khớp nối thành tài liệu và kiểm tra tự động.'],
            },
            {
              id: '11.1.3', t: 'Các quyết định thiết kế quan trọng và đánh đổi', min: 25, pre: ['11.1.2'],
              concepts: [
                ['Đánh đổi (trade-off)', 'Mỗi quyết định có cái được và cái mất; nêu được cả hai mới là hiểu.'],
                ['Fail-safe', 'Khi không chắc chắn, chọn hành vi an toàn (không lên bus, PWM 0).'],
                ['Giới hạn đã biết', 'Điểm yếu được ghi lại công khai thay vì giấu.'],
              ],
              goal: `Bạn giải thích được 8 quyết định thiết kế bằng lý do và cái giá phải trả, giống cách trả lời câu hỏi "vì sao" khi phỏng vấn.`,
              bg: `Đọc code cho biết hệ thống làm gì; hiểu quyết định thiết kế cho biết vì sao nó làm vậy và khi nào nên làm khác.`,
              th: `| # | Quyết định | Vì sao | Cái giá |
|---|---|---|---|
| 1 | Phần cứng tiêm qua con trỏ hàm | test trên PC, tái sử dụng 4 nơi | thêm một lớp gián tiếp |
| 2 | Không cấp phát lúc chạy | không phân mảnh, không thất bại giữa chừng | kích thước cố định (buffer 256, 16 DTC) |
| 3 | ISR chỉ chép/đặt cờ | ngắt ngắn, thời gian dễ đoán | thêm queue/ring buffer |
| 4 | Server UDS trả độ dài, không gửi | không biết transport | caller phải gửi |
| 5 | Reset sau khi response đã gửi | tester luôn nhận được response | thêm trạng thái chờ |
| 6 | Clock FDCAN lạ → không lên bus | sai bitrate làm hỏng cả bus | ECU mất CAN nếu clock lạ |
| 7 | Lỗi tốc độ → PWM 0 | không điều khiển bằng dữ liệu không tin được | mất chức năng khi có lỗi |
| 8 | Reset chỉ ở extended session | không reset được khi xe đang chạy bình thường | tester phải vào extended |

**Giới hạn đã biết** (nên tự nói): DTC chỉ ở RAM, E2E không có Data ID, timing mới đo bằng log, tester đang chạy trên Sensor ECU, UDS tối thiểu (chưa có 0x27, 0x2E, 0x31, 0x78), chưa có watchdog.`,
              use: `Mỗi quyết định đều có ở code; ba ví dụ bên dưới. Các bài [[2.2.2]], [[2.3.2]], [[9.1.5]], [[3.1.3]], [[7.1.4]] phân tích chi tiết.`,
              code: [
                { f: 'control_ecu/CM4/Core/Mcal/can_drv.c', from: 'return CANDRV_ERROR;   /* unknown clock: refuse to run with a wrong bitrate */', n: 1, hl: ['return CANDRV_ERROR;   /* unknown clock: refuse to run with a wrong bitrate */'],
                  ex: [['refuse to run with a wrong bitrate', 'Quyết định 6: fail-safe ở tầng driver.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: '/* Safe state: never drive the output from stale or implausible data. */', n: 5, hl: ['duty = speedFault ? 0U'],
                  ex: [['/* Safe state: never drive the output from stale or implausible data. */', 'Quyết định 7, ghi thành một câu trong code.']] },
                { f: 'common/uds/uds_server.c', from: '/* Design choice of this ECU: resets only from the extended session. */', n: 4, hl: ['return UDS_NRC_SUBFUNC_NOT_SUPP_IN_SESSION;'],
                  ex: [['/* Design choice of this ECU: resets only from the extended session. */', 'Quyết định 8, được đánh dấu rõ là lựa chọn của ECU này, không phải yêu cầu của chuẩn.']] },
              ],
              explain: `Code tốt **gắn nhãn** quyết định thiết kế bằng comment ngắn ("Design choice…", "Safe state…", "refuse to…"). Khi đọc code người khác, những comment này đáng giá hơn mọi comment mô tả "dòng này làm gì".`,
              run: ['Gặp tình huống không chắc chắn (clock lạ, dữ liệu cũ).', 'Code chọn hành vi an toàn đã định trước.', 'Ghi log/DTC để người dùng biết.', 'Không cố "đoán" để tiếp tục chạy.'],
              fig: { type: 'flow', nodes: [['Dữ liệu hoặc cấu hình có đáng tin không?', 'start'], ['Có → hoạt động bình thường', 'ok'], ['Không → hành vi an toàn: PWM 0, không lên bus, NRC', 'bad'], 'Ghi nhận: log, fault, DTC', ['Phục hồi có điều kiện: 10 khung tốt, phục hồi bus-off sau 100 ms', 'end']] },
              video: { t: 'Tám quyết định, tám cái giá', d: '3:00', goal: 'Trả lời "vì sao" bằng đánh đổi.',
                s: ['Bảng 8 quyết định.', 'Mỗi quyết định: được gì, mất gì.', 'Mẫu fail-safe xuyên suốt.', 'Giới hạn đã biết và cách nói về chúng.'] },
              pit: [
                ['Chỉ nêu lợi ích', 'Câu trả lời thiếu đánh đổi nghe như học thuộc. Luôn kèm cái giá.'],
                ['Giấu giới hạn', 'Người phỏng vấn thường đã thấy. Chủ động nói kèm hướng khắc phục tốt hơn nhiều.'],
              ],
              ex: { task: `Chọn quyết định 2 (không cấp phát lúc chạy). Nêu một tình huống mà nó gây khó, và cách giải quyết vẫn giữ nguyên tắc.`, sol: `Request UDS dài hơn 256 byte (ví dụ tải file) sẽ bị FC OVFLW. Giải quyết: tăng buffer tĩnh theo nhu cầu lớn nhất đã biết, hoặc xử lý theo luồng (stream) từng block thay vì cả message, vẫn không cần malloc.` },
              quiz: [
                ['Vì sao driver từ chối chạy khi clock FDCAN lạ?', ['Để tiết kiệm điện', 'Một node sai bitrate gây lỗi cho mọi node trên bus', 'Vì HAL không hỗ trợ', 'Vì MISRA'], 1, 'Fail-safe ở mức bus.'],
                ['Giới hạn nào là thật của project hiện tại?', ['Không có unit test', 'DTC chỉ lưu trong RAM', 'Không có CAN', 'Không có ISO-TP'], 1, 'Chưa có NvM.'],
              ],
              sum: ['Mỗi quyết định = lý do + cái giá.', 'Mẫu xuyên suốt: fail-safe.', 'Biết và nói được giới hạn của mình.'],
            },
          ],
        },
      ],
    },
    {
      id: 'c12', t: 'Luồng hoạt động end-to-end',
      lessons: [
        {
          id: '12.1', t: 'Bốn luồng chính',
          subs: [
            {
              id: '12.1.1', t: 'Tốc độ: từ biến trở tới PWM', min: 25, pre: ['5.1.2', '7.1.4'],
              concepts: [
                ['Độ trễ end-to-end', 'Thời gian từ khi tốc độ thật đổi tới khi PWM đổi: lọc (~40 ms) + tối đa 10 ms gửi + tối đa 10 ms monitor.'],
                ['Đường dữ liệu', 'Chuỗi hàm và vùng nhớ mà một giá trị đi qua.'],
              ],
              goal: `Bạn kể được không sót bước nào đường đi của một giá trị tốc độ qua 2 board, 3 ngữ cảnh thực thi và khoảng 12 hàm.`,
              bg: `Đây là bài tổng hợp, ghép các bài [[5.1.1]], [[6.1.2]], [[7.1.2]], [[7.1.4]] thành một chuỗi liền mạch.`,
              th: `**Sensor ECU:**
1. TIM6 ngắt → cờ 10 ms → ⟦SensorApp_Task10ms⟧.
2. ⟦SampleInput⟧ → ⟦AdcDrv_Read⟧ → ⟦FilterUpdate⟧ (trung bình 8 mẫu).
3. ⟦SendSpeedFrame⟧: ⟦AdcToSpeedX10⟧ → ⟦PutU16Be⟧ vào byte 0–1 → ⟦E2e_Protect⟧ (counter, CRC) → ⟦CanDrv_Write⟧.

**Bus:** khung 0x100 thắng phân xử nhờ ID nhỏ.

**Control ECU:**
4. FDCAN ngắt → ⟦HAL_FDCAN_RxFifo0Callback⟧ → ⟦OnCanRx⟧ → queue.
5. ⟦ComRxTask⟧ → ⟦HandleSpeedFrame⟧ → ⟦E2e_Check⟧ → ghi ⟦s_view⟧ (mutex).
6. ⟦MonitorTask⟧ (mỗi 10 ms) → snapshot → không lỗi → ⟦duty = speed × 1000 / 2500⟧ → ⟦IoDrv_SetPwm⟧ → CCR2 của TIM1.

**Độ trễ ước tính:** lọc khoảng 40 ms (trung bình), chờ chu kỳ gửi tối đa 10 ms, truyền khoảng 0,25 ms, chờ chu kỳ monitor tối đa 10 ms → cỡ 40–60 ms. (Ước tính từ code, chưa đo bằng thiết bị.)`,
              use: `Kịch bản "Đường đi của tốc độ" trong trang 3D minh họa đúng chuỗi này.`,
              code: [
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: 'frame.id  = CANID_SENSOR_SPEED;', n: 5, hl: ['PutU16Be(&frame.data[0], speed);'],
                  ex: [['PutU16Be(&frame.data[0], speed);', 'Bước 3: tốc độ vào byte 0–1.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'E2e_Status_t status = E2e_Check(&s_e2eSpeed, frame->data, frame->dlc);', n: 9, hl: ['s_view.speedX10      ='],
                  ex: [['E2e_Status_t status = E2e_Check(&s_e2eSpeed, frame->data, frame->dlc);', 'Bước 5: kiểm E2E.'], ['s_view.speedX10      =', 'Ghép big-endian, ghi vào view.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'duty = speedFault ? 0U', n: 3, hl: ['IoDrv_SetPwm(duty);'],
                  ex: [['IoDrv_SetPwm(duty);', 'Bước 6: tới phần cứng.']] },
              ],
              explain: `Ba đoạn code ở ba file, hai chip, ba ngữ cảnh (main loop Sensor, task ComRx, task Monitor). Giá trị tốc độ đi qua hai vùng đệm: TX FIFO / bus / RX FIFO, và ⟦s_view⟧.`,
              run: ['Vặn biến trở tới 2,0 V → ADC ≈ 2482.', 'Sau lọc → speed ≈ 1515 (151,5 km/h), khung ⟦05 EB …⟧.', 'Control nhận, E2E OK, ⟦s_view.speedX10 = 1515⟧.', 'Monitor: duty = 1515 × 1000 / 2500 = 606 → 60,6 %.', 'LED sáng 60,6 % thời gian.'],
              fig: { type: 'seq', actors: ['Biến trở', 'Sensor task', 'Bus', 'ISR + queue', 'ComRx', 'Monitor', 'TIM1'], msgs: [[0, 1, 'ADC + lọc 8 mẫu'], [1, 1, 'E2e_Protect'], [1, 2, '0x100'], [2, 3, 'RX FIFO → queue'], [3, 4, 'Get'], [4, 4, 'E2e_Check OK'], [4, 5, 's_view (mutex)', 'chờ tới chu kỳ 10 ms kế tiếp'], [5, 5, 'không lỗi'], [5, 6, 'CCR2 = duty']] },
              video: { t: 'Một giá trị, hai board', d: '2:30', goal: 'Đường đi trọn vẹn.',
                s: ['Vặn biến trở trên board Sensor.', 'Theo giá trị qua lọc, E2E, CAN.', 'Sang Control: ISR, queue, ComRx, view.', 'Monitor tính duty, LED đổi độ sáng.', 'Ước tính độ trễ.'] },
              pit: [
                ['Nghĩ PWM đổi ngay khi khung tới', 'PWM chỉ đổi ở chu kỳ Monitor kế tiếp (tối đa 10 ms sau).'],
                ['Bỏ qua độ trễ của bộ lọc', 'Bộ lọc thêm khoảng 40 ms, lớn nhất trong chuỗi.'],
              ],
              ex: { task: `Muốn giảm độ trễ end-to-end nhiều nhất, bạn sửa chỗ nào? Đánh đổi là gì?`, sol: `Giảm cửa sổ lọc (ví dụ 4 mẫu: trễ còn khoảng 20 ms) đổi lại nhiễu nhiều hơn. Hoặc cho Monitor tính PWM ngay khi có khung mới thay vì theo chu kỳ, đổi lại logic phức tạp hơn và chu kỳ monitor không còn đều.` },
              quiz: [
                ['Thành phần nào đóng góp độ trễ lớn nhất?', ['Truyền trên bus', 'Bộ lọc trung bình 8 mẫu', 'ISR', 'Mutex'], 1, 'Trung bình khoảng 40 ms.'],
                ['Giá trị tốc độ được chia sẻ giữa ComRx và Monitor qua đâu?', ['Queue', 's_view có mutex', 'Biến volatile', 'Khung 0x200'], 1, 'Monitor chép snapshot.'],
              ],
              sum: ['Sensor: ADC → lọc → đóng gói → E2E → CAN.', 'Control: ISR → queue → ComRx → view → Monitor → PWM.', 'Độ trễ ước tính 40–60 ms, chủ yếu do lọc.'],
            },
            {
              id: '12.1.2', t: 'Mất tín hiệu: lỗi → safe state → DTC → tester', min: 25, pre: ['12.1.1', '10.1.3'],
              concepts: [
                ['Chuỗi phản ứng lỗi', 'Phát hiện → phản ứng an toàn → ghi nhận → báo cáo → phục hồi.'],
                ['FTTI', 'Fault Tolerant Time Interval (ISO 26262): thời gian tối đa từ lỗi tới khi hệ thống phải ở trạng thái an toàn. Kiến thức bổ trợ.'],
              ],
              goal: `Bạn kể được chuỗi phản ứng đầy đủ khi tín hiệu tốc độ mất, kèm mốc thời gian, status DTC ở từng bước và các request tester dùng để đọc và xóa.`,
              bg: `An toàn chức năng quan tâm không chỉ "có phát hiện lỗi không" mà "phát hiện bao lâu" và "làm gì sau đó". Đây là luồng được kiểm trên phần cứng ở M4 và M5.`,
              th: `**Kịch bản SILENT (nút B1):**
| t (so với khung cuối) | Sự kiện | Status U0100-87 |
|---|---|---|
| 0 | Sensor ngừng gửi 0x100 | 0x00 |
| ~100–110 ms | Monitor: tuổi khung > 100 ms → SPEED_TIMEOUT SET, PWM 0 % | |
| cùng chu kỳ | ReportResult(fail), ngưỡng 1 → confirmed | 0x2F |
| sau đó | Mỗi 100 ms khung 0x200 báo fault mask 0x01, 1 DTC | 0x2F |
| người dùng nhấn B1 lại | khung hợp lệ có lại → SPEED_TIMEOUT cleared, PWM trở lại | 0x2E |
| tester ⟦19 02 FF⟧ | ⟦59 02 7F C1 00 87 2E⟧ | 0x2E |
| tester ⟦14 FF FF FF⟧ | ⟦54⟧ | 0x50 → 0x00 ở chu kỳ sau |

**Liên hệ ISO 26262 (bổ trợ):** thời gian phát hiện + phản ứng (ở đây ≤ 110 ms) phải nhỏ hơn FTTI của chức năng, do phân tích an toàn đặt ra. Project chưa có FTTI chính thức; số đo hiện từ timestamp log (39,7 s → 39,8 s).`,
              use: `Log thật: ⟦docs/logs/m4_bus_fault_injection_control.log⟧ và ⟦m5_uds_tester_sensor.log⟧. Kịch bản "Lỗi → DTC → tester" trong trang 3D chạy đúng chuỗi này.`,
              code: [
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: 'if (s_faultMode == FAULT_SILENT)', n: 4, hl: ['return;'],
                  ex: [['return;', 'SILENT: không gửi khung nào.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'SetFault(FAULT_SPEED_TIMEOUT,', n: 3, hl: ['(ageMs > SENSOR_SPEED_TIMEOUT_MS) &&'] },
                { f: 'common/uds/uds_server.c', from: 'uint16_t room = (uint16_t)((c->respMax - c->respLen) / DTC_RECORD_LEN);', to: 'c->respLen = (uint16_t)(c->respLen + ((uint16_t)n * DTC_RECORD_LEN));', hl: ['n = DtcMgr_GetByStatusMask(mask, &c->resp[c->respLen], maxRecords);'],
                  ex: [['if (DtcMgr_CountByStatusMask(mask) > maxRecords)', 'Kiểm đủ chỗ trước, không cắt danh sách.']] },
              ],
              explain: `Năm module tham gia: sensor_app (gây lỗi), control_app (phát hiện, safe state), dtc_manager (ghi nhận), uds_server (báo cáo), tester_app (đọc, xóa). Không module nào biết toàn bộ chuỗi.`,
              run: ['B1 → SILENT.', 'Monitor: age vượt 100 ms → fault SET, PWM 0.', 'DTC U0100-87 confirmed (ngưỡng 1).', 'B1 → khung có lại → fault cleared; DTC giữ (0x2E).', 'Tester đọc ⟦19 02 FF⟧ rồi xóa ⟦14 FF FF FF⟧.'],
              fig: { type: 'seq', actors: ['Sensor', 'Control Monitor', 'DTC manager', 'PWM', 'Tester'], msgs: [[0, 0, 'ngừng gửi 0x100'], [1, 1, 'age > 100 ms'], [1, 3, 'duty = 0'], [1, 2, 'ReportResult(0, fail)'], [2, 2, 'U0100-87 = 0x2F'], [0, 1, '0x100 trở lại'], [1, 2, 'ReportResult(0, pass) → 0x2E'], [4, 2, '19 02 FF → 59 02 7F C1 00 87 2E'], [4, 2, '14 FF FF FF → 54']] },
              video: { t: 'Rút dây, đọc mã lỗi', d: '2:30', goal: 'Chuỗi phản ứng lỗi trên phần cứng.',
                s: ['Log hai ECU song song.', 'B1 → SILENT: SPEED_TIMEOUT SET sau khoảng 100 ms.', 'LED tắt.', 'Khôi phục, đọc DTC: 2E pending confirmed.', 'Xóa DTC.'] },
              pit: [
                ['Kỳ vọng DTC tự mất khi lỗi hết', 'Confirmed giữ đến khi xóa (không có aging).'],
                ['Tính thời gian phát hiện = 100 ms chính xác', 'Thực tế 100–110 ms tùy pha của chu kỳ Monitor.'],
              ],
              ex: { task: `Làm lại bảng trên cho mode OUT_OF_RANGE (P0501-00, ngưỡng 3). Khác biệt chính là gì?`, sol: `Khung vẫn tới (không timeout); Monitor thấy tốc độ 3000 > 2500 ngay chu kỳ đầu → SPEED_RANGE SET, PWM 0; DTC cần 3 chu kỳ fail liên tiếp (30 ms) mới confirmed: status 0x27 → 0x2F.` },
              quiz: [
                ['Status U0100-87 sau khi lỗi đã hết nhưng chưa xóa?', ['0x2F', '0x2E', '0x50', '0x00'], 1, 'TF tắt, lịch sử còn.'],
                ['Thời gian từ khung cuối tới safe state trong code là?', ['10 ms', '100–110 ms', '1 s', '5 s'], 1, 'Timeout 100 ms + chu kỳ 10 ms.'],
              ],
              sum: ['Phát hiện ≤ 110 ms → PWM 0 → DTC confirmed.', 'Lỗi hết: PWM trở lại, DTC giữ 0x2E.', 'Tester đọc 19 02, xóa 14.'],
            },
            {
              id: '12.1.3', t: 'Request UDS nhiều khung qua bus thật', min: 25, pre: ['8.1.2', '9.1.6', '5.1.5'],
              concepts: [
                ['Hai link ISO-TP', 'Tester có link (TX 0x7E0, RX 0x7E8), ECU có link ngược lại; mỗi bên vừa gửi vừa nhận.'],
                ['Thời gian phản hồi', 'Từ cuối request tới đầu response; server hứa ≤ P2 = 50 ms.'],
              ],
              goal: `Bạn mô tả từng khung trên bus và từng hàm ở hai board khi tester đọc phiên bản phần mềm (13 byte).`,
              bg: `Bài này ghép tester ([[5.1.5]]), ISO-TP ([[8.1.2]]), diag_app ([[9.1.6]]) và ReadDID ([[9.1.4]]).`,
              th: `| # | Bus | Bên gửi làm gì | Bên nhận làm gì |
|---|---|---|---|
| 1 | ⟦0x7E0: 03 22 F1 95⟧ | tester: ⟦IsoTp_Transmit⟧ → SF | ECU: queue → ComRx → ⟦IsoTp_RxFrame⟧ → ⟦OnEcuRequest⟧ → ⟦Uds_ProcessRequest⟧ → 13 byte → ⟦IsoTp_Transmit⟧ |
| 2 | ⟦0x7E8: 10 0D 62 F1 95 43 54 52⟧ | ECU: FF, chờ FC | tester: ISR → ring → ⟦RxOnFirstFrame⟧ → gửi FC |
| 3 | ⟦0x7E0: 30 00 00⟧ | tester: FC CTS | ECU: ⟦TxOnFlowControl⟧ → SEND_CF |
| 4 | ⟦0x7E8: 21 4C 2D 30 2E 33 2E 30⟧ | ECU: CF, xong → ⟦txConfirmation⟧ | tester: ⟦RxOnConsecutiveFrame⟧ → đủ 13 byte → ⟦OnResponse⟧ |

Tester so tiền tố ⟦62 F1 95⟧ → PASS, in chuỗi "CTRL-0.3.0".`,
              use: `Kịch bản "UDS 22 F195" của trang 3D chạy bốn khung này trong mô phỏng; tab Mô phỏng hiển thị đúng các byte trong CAN trace.`,
              code: [
                { f: 'sensor_ecu/Core/App/tester_app.c', from: 'static void SendStep(void)', to: 's_state = ST_WAIT;', hl: ['(void)IsoTp_Transmit(&s_link, st->req, st->reqLen);'],
                  ex: [['if (st->functional)', 'Functional: tự dựng SF trên 0x7DF.'], ['(void)IsoTp_Transmit(&s_link, st->req, st->reqLen);', 'Physical: qua link ISO-TP của tester.']] },
                { f: 'common/isotp/isotp.c', from: "frame[0] = (uint8_t)((PCI_TYPE_FF << 4U) | ((link->txLength >> 8U) & 0x0FU));", n: 3, hl: ['frame[1] = (uint8_t)(link->txLength & 0xFFU);'],
                  ex: [['frame[1] = (uint8_t)(link->txLength & 0xFFU);', 'Với 13 byte: byte 0 = 0x10, byte 1 = 0x0D.']] },
              ],
              explain: `Tester và ECU dùng **cùng một ⟦isotp.c⟧**, chỉ khác cấu hình (ID, BS, STmin, callback). Đây là lợi ích trực tiếp của thiết kế không phụ thuộc phần cứng.`,
              run: ['Gõ ⟦v⟧ trên VCP của Sensor.', 'Khung 1: request SF.', 'ECU xử lý, khung 2: FF.', 'Khung 3: FC từ tester.', 'Khung 4: CF; tester ghép 13 byte, so tiền tố, PASS.'],
              fig: { type: 'seq', actors: ['tester_app', 'ISO-TP tester', 'Bus', 'ISO-TP ECU', 'uds_server'], msgs: [[0, 1, 'Transmit 22 F1 95'], [1, 2, '7E0: 03 22 F1 95'], [2, 3, 'SF'], [3, 4, 'Uds_ProcessRequest'], [4, 3, '13 byte'], [3, 2, '7E8: 10 0D 62 F1 95 43 54 52'], [2, 1, 'FF'], [1, 2, '7E0: 30 00 00'], [2, 3, 'FC CTS'], [3, 2, '7E8: 21 4C 2D 30 2E 33 2E 30'], [2, 1, 'CF'], [1, 0, 'OnResponse: 13 byte']] },
              video: { t: 'Bốn khung trên bus', d: '2:00', goal: 'Theo dõi một request nhiều khung.',
                s: ['Trace CAN với bốn dòng.', 'Giải mã PCI từng dòng.', 'Ai gửi khung nào.', 'Hàm nào chạy ở mỗi board.'] },
              pit: [
                ['Nghĩ request nhiều khung chỉ ở response', 'Request cũng có thể nhiều khung: self-test bước 3 gửi 9 byte (FF + CF) tới ECU.'],
                ['Quên rằng tester cũng phải gửi FC', 'Không có FC, ECU hết N_Bs (1000 ms) và hủy response.'],
              ],
              ex: { task: `Đếm số khung trên bus cho request ⟦22 F1 95 01 00 01 01⟧ (response 20 byte).`, sol: `Request 7 byte: 1 SF. Response 20 byte: FF (6) + FC + CF (7) + CF (7) = 4 khung. Tổng 5 khung.` },
              quiz: [
                ['Khung ⟦30 00 00⟧ do ai gửi trong luồng này?', ['ECU', 'Tester', 'Cả hai', 'Không ai'], 1, 'Bên nhận response (tester) gửi FC.'],
                ['Hai bên dùng chung module nào?', ['uds_server.c', 'isotp.c', 'sys_drv.c', 'control_app.c'], 1, 'Cùng code, khác cấu hình.'],
              ],
              sum: ['4 khung: SF, FF, FC, CF.', 'Cùng isotp.c ở cả hai bên.', 'Tester PASS khi tiền tố khớp.'],
            },
            {
              id: '12.1.4', t: 'Từ lúc bật nguồn tới khung hợp lệ đầu tiên', min: 20, pre: ['7.1.1', '6.1.3'],
              concepts: [
                ['Thời gian chờ khởi động', '500 ms đầu Control không báo timeout nếu chưa từng nhận khung.'],
                ['E2E_INITIAL', 'Khung đầu tiên chỉ để đồng bộ counter, vẫn được dùng.'],
                ['Status 0x50 → 0x00', 'DTC chưa test trở thành "đã test, không lỗi" sau chu kỳ monitor đầu tiên.'],
              ],
              goal: `Bạn mô tả được giai đoạn khởi động của cả hệ thống và vì sao không có DTC giả nào được ghi dù hai board khởi động lệch nhau.`,
              bg: `Hai ECU không khởi động cùng lúc: Sensor chạy ngay, Control phải chờ Linux nạp firmware (lâu hơn nhiều). Ngược lại, khi chỉ reset Control, Sensor đã gửi từ lâu. Code phải đúng trong cả hai trường hợp.`,
              th: `**Control khởi động trước khi có khung:** ⟦view.received = false⟧ → tuổi tính từ ⟦s_startTick⟧; timeout chỉ được báo khi đã qua 500 ms mà vẫn chưa có khung. Sensor có 500 ms để bắt đầu gửi.

**Khung đầu tiên:** ⟦E2e_Check⟧ chưa đồng bộ → ⟦E2E_INITIAL⟧ (hợp lệ) → view nhận tốc độ, ⟦received = true⟧.

**DTC:** sau ⟦DtcMgr_Init⟧ mọi status = 0x50. Chu kỳ Monitor đầu tiên báo pass cho mọi monitor → TNCSLC và TNCTOC tắt → 0x00.

**Sau hard reset** (chỉ Control khởi động lại): giống hệt, vì RAM khởi tạo lại; Sensor đang gửi nên khung đầu đến ngay.`,
              use: `Đây là lý do tester C++ dùng mask ⟦TF | PDTC | CDTC⟧ thay vì 0xFF: ngay sau khởi động, một monitor chưa chạy có status 0x50 và sẽ khớp mask 0xFF.`,
              code: [
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: '/* Before the first frame, give the Sensor ECU time to boot. */', n: 4, hl: ['(view.received || ((now - s_startTick) > STARTUP_GRACE_MS)));'] },
                { f: 'common/dtc/dtc_manager.c', from: '/* The test has now been completed in this cycle and since the last clear. */', n: 2, hl: ['e->status &= (uint8_t)~(DTC_STATUS_TNCTOC | DTC_STATUS_TNCSLC);'] },
                { f: 'tester/include/uds/dtc.hpp', from: '/** DTCs that have actually failed;', n: 2, hl: ['inline constexpr std::uint8_t kFailedPendingConfirmed'],
                  ex: [['/** DTCs that have actually failed;', 'Mask loại các monitor chưa chạy (status 0x50).']] },
              ],
              explain: `Ba chi tiết nhỏ ở ba file cùng phục vụ một mục tiêu: **không có lỗi giả lúc khởi động**.`,
              run: ['Control: ⟦ControlApp_Init⟧ lưu ⟦s_startTick⟧; DTC = 0x50.', 'Monitor chạy: chưa có khung, tuổi < 500 ms → không timeout; báo pass → DTC 0x00.', 'Khung đầu tới: E2E INITIAL, view có tốc độ.', 'Từ đây hoạt động bình thường; PWM theo tốc độ.'],
              fig: { type: 'flow', nodes: [['Control khởi động, s_startTick = now', 'start'], 'DTC: mọi status = 0x50', 'Monitor đầu tiên: chưa nhận khung, < 500 ms → không timeout', 'ReportResult(pass) × 5 → status 0x00', 'Khung 0x100 đầu: E2E_INITIAL, received = true', ['Hoạt động bình thường', 'end']] },
              video: { t: 'Khởi động không có lỗi giả', d: '1:30', goal: 'Grace period, INITIAL, 0x50.',
                s: ['Hai board khởi động lệch nhau.', 'Grace 500 ms.', 'Khung đầu: INITIAL.', 'DTC 0x50 → 0x00.'] },
              pit: [
                ['Bỏ thời gian chờ khởi động', 'Mỗi lần bật nguồn đều ghi U0100-87, làm DTC mất giá trị.'],
                ['Đọc DTC bằng mask 0xFF ngay sau khởi động', 'Thấy các DTC 0x50 dù không có lỗi. Dùng mask TF | PDTC | CDTC.'],
              ],
              ex: { task: `Nếu Sensor khởi động chậm 800 ms so với Control, chuyện gì xảy ra? DTC nào được ghi?`, sol: `Sau 500 ms (cộng một chu kỳ) chưa có khung → SPEED_TIMEOUT, U0100-87 confirmed (ngưỡng 1). Khi khung đến, lỗi hết nhưng DTC giữ 0x2E. Muốn tránh thì tăng ⟦STARTUP_GRACE_MS⟧ theo thời gian khởi động thật của Sensor.` },
              quiz: [
                ['Khung 0x100 đầu tiên sau khởi động nhận trạng thái E2E nào?', ['E2E_OK', 'E2E_INITIAL', 'E2E_ERR_WRONG_SEQ', 'E2E_ERR_CRC'], 1, 'Chưa đồng bộ.'],
                ['Status DTC sau chu kỳ monitor đầu tiên (không lỗi)?', ['0x50', '0x00', '0x2F', '0x40'], 1, 'Hai bit "chưa test" tắt.'],
              ],
              sum: ['Grace 500 ms trước timeout đầu tiên.', 'Khung đầu: INITIAL.', 'DTC 0x50 → 0x00 sau chu kỳ đầu.'],
            },
          ],
        },
      ],
    },
  ],
};
