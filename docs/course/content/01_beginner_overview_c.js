// Beginner, chapters 1-2: the big picture and the C needed to read the firmware.
module.exports = {
  level: { id: 'beginner', t: 'Nền tảng', d: 'Project làm gì, phần cứng, cách repo được tổ chức, ngôn ngữ C cho firmware và kiến thức CAN cơ bản.' },
  chapters: [
    {
      id: 'c01', t: 'Bức tranh toàn cảnh',
      lessons: [
        {
          id: '1.1', t: 'Project là gì',
          subs: [
            {
              id: '1.1.1', t: 'Bài toán: một mạng ECU thu nhỏ trong xe', min: 15,
              concepts: [
                ['ECU', 'Electronic Control Unit: một máy tính nhúng điều khiển một chức năng của xe (động cơ, phanh, đèn…). Xe hiện đại có hàng chục ECU nối với nhau qua bus.'],
                ['DTC', 'Diagnostic Trouble Code: mã lỗi ECU lưu lại khi phát hiện sự cố, ví dụ ⟦U0100-87⟧. Thợ sửa xe đọc mã này bằng máy chẩn đoán.'],
                ['UDS', 'Unified Diagnostic Services (ISO 14229): bộ "lệnh" chuẩn để máy chẩn đoán nói chuyện với ECU: đọc dữ liệu, đọc/xóa DTC, reset…'],
                ['Safe state', 'Trạng thái an toàn mà ECU chủ động chuyển sang khi dữ liệu đầu vào không tin được. Ở đây là PWM = 0 %.'],
              ],
              goal: `Sau bài này bạn giải thích được trong 1 phút: project mô phỏng cái gì trong xe thật, gồm những node nào, dữ liệu nào chạy giữa chúng và vì sao lại cần chẩn đoán.`,
              bg: `Trong ô tô, cảm biến và cơ cấu chấp hành không nối thẳng vào một máy tính trung tâm. Mỗi nhóm chức năng có ECU riêng, và các ECU trao đổi dữ liệu qua **mạng CAN**. Một ECU cảm biến đo tốc độ bánh xe rồi gửi lên bus; ECU khác (ABS, hộp số, đồng hồ) dùng giá trị đó.

Khi có sự cố (mất tín hiệu, dữ liệu sai), ECU không được "đoán" mà phải phát hiện lỗi, đưa cơ cấu chấp hành về trạng thái an toàn và **ghi lại mã lỗi** để xưởng sửa chữa đọc bằng máy chẩn đoán qua **UDS**.`,
              th: `Project dựng lại chuỗi đó ở quy mô nhỏ, trên phần cứng thật:

1. **Sensor ECU** đọc một biến trở (giả lập cảm biến tốc độ) và gửi tốc độ lên CAN mỗi 10 ms. Mỗi khung có **alive counter** và **CRC-8** để bên nhận biết khung có bị mất, lặp hay hỏng không (ý tưởng AUTOSAR E2E).
2. **Control ECU** nhận tốc độ, kiểm tra từng khung, giám sát 5 loại lỗi và điều khiển một ngõ ra PWM (giả lập cơ cấu chấp hành). Có lỗi tốc độ thì PWM về 0 %.
3. Mỗi lỗi được báo cho **DTC manager**, nơi giữ status byte theo ISO 14229.
4. Một **tester** gửi lệnh UDS qua **ISO-TP** để đọc phiên bản phần mềm, tốc độ, danh sách DTC, xóa DTC và reset ECU.

Điểm quan trọng: đây không phải mô phỏng trên PC. Toàn bộ chuỗi đã chạy trên hai board STM32 nối bus CAN thật (milestone M4, M5), và có log làm bằng chứng.`,
              use: `Ba câu hỏi bạn nên trả lời được sau khóa học, và chương nào trả lời chúng:

- Dữ liệu đi từ biến trở tới LED PWM như thế nào? → [[12.1.1]]
- Khi rút dây CAN, chuyện gì xảy ra và mã lỗi nào được ghi? → [[12.1.2]]
- Tester đọc một chuỗi 13 byte qua khung CAN 8 byte bằng cách nào? → [[12.1.3]]

Phần header của file {{common/can/can_matrix.h}} và {{control_ecu/CM4/Core/App/control_app.c}} tóm tắt đúng bài toán này bằng chính lời của tác giả.`,
              code: [
                { f: 'common/can/can_matrix.h', from: '@file    can_matrix.h', to: '#define SENSOR_STATUS_ADC_ERROR', hl: ['0x100 SENSOR_SPEED', 'byte 6   : AliveCounter', 'byte 7   : CRC8'],
                  cap: 'Hợp đồng chung giữa các node: khung tốc độ 0x100 gửi mỗi 10 ms, byte 6 là counter, byte 7 là CRC.',
                  ex: [['Shared contract', 'Cả hai ECU cùng biên dịch file này, nên bố cục khung không thể lệch nhau giữa bên gửi và bên nhận.'], ['byte 0-1 : VehicleSpeed', 'Tốc độ tính bằng 0,1 km/h, kiểu big-endian (byte cao trước). 2500 nghĩa là 250,0 km/h.'], ['byte 6   : AliveCounter', 'Counter tăng 1 mỗi khung: bên nhận dùng nó để biết khung bị mất hay bị lặp.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: '@file    control_app.c', to: '#include "control_app.h"', hl: ['SPEED_TIMEOUT', 'safe state'],
                  cap: 'Năm lỗi mà Control ECU giám sát và quy tắc safe state.',
                  ex: [['SPEED_TIMEOUT  no valid', 'Mất tín hiệu: không nhận được khung 0x100 hợp lệ trong 100 ms.'], ['SPEED_E2E', 'Khung có CRC sai hoặc counter sai thứ tự. Lỗi chỉ tự hết sau 10 khung tốt liên tiếp.'], ['While a speed fault is active', 'Quy tắc an toàn: hễ dữ liệu tốc độ không tin được thì ngõ ra về 0 %.']] },
              ],
              explain: `Hai đoạn trên là "bản đặc tả" nằm ngay trong code. Khi đọc một project lạ, hãy bắt đầu từ comment đầu file của các module trung tâm: chúng thường cho bạn biết nhanh nhất hệ thống làm gì.`,
              run: [
                'Bật nguồn: Sensor ECU bắt đầu gửi ⟦0x100⟧ mỗi 10 ms và ⟦0x101⟧ mỗi 100 ms.',
                'Control ECU nhận khung, kiểm E2E, cập nhật tốc độ, tính PWM theo tốc độ.',
                'Mỗi 10 ms Control ECU chạy 5 monitor và báo kết quả cho DTC manager.',
                'Khi có lỗi: PWM về 0 %, DTC chuyển sang pending rồi confirmed.',
                'Tester gửi ⟦19 02 FF⟧ để đọc DTC, ⟦14 FF FF FF⟧ để xóa.',
              ],
              fig: { type: 'seq', actors: ['Biến trở', 'Sensor ECU', 'Bus CAN', 'Control ECU', 'Tester'], msgs: [
                [0, 1, 'điện áp → ADC'], [1, 2, '0x100 tốc độ + counter + CRC'], [2, 3, 'khung tới'], [3, 3, 'E2E check, monitor, PWM'],
                [4, 2, '0x7E0: 19 02 FF'], [2, 3, 'request UDS'], [3, 2, '0x7E8: 59 02 …'], [2, 4, 'danh sách DTC'],
              ] },
              figCap: 'Luồng tổng quát của hệ thống. Bấm "Chạy từng bước" để xem từng mũi tên.',
              video: { t: 'Demo hệ thống: lỗi → DTC → tester', d: '3:00', url: 'https://www.youtube.com/watch?v=Ocq1K0BO8kM', goal: 'Thấy toàn bộ chuỗi chạy trên phần cứng thật trước khi đi vào chi tiết.',
                s: ['Hai board nối bus CAN, log của cả hai ECU chạy song song.', 'Vặn biến trở: tốc độ và PWM thay đổi theo.', 'Nhấn nút B1 để chèn lỗi: Control ECU báo lỗi, PWM về 0, DTC được ghi.', 'Tester đọc và xóa DTC qua UDS.'] },
              pit: [
                ['Nghĩ đây là mô phỏng thuần phần mềm', 'Phần chính chạy trên board thật; mô phỏng trên PC (SimulatedEcu, unit test) chỉ để kiểm thử nhanh. Khi trình bày, nói rõ phần nào đã chạy trên phần cứng và phần nào chỉ kiểm trên PC.'],
                ['Nhầm "tester" là một board riêng', 'Hiện tester chạy trên chính Sensor ECU (⟦tester_app.c⟧). Tester C++ trên Cortex-A7 là bước tiếp theo, chưa xong.'],
              ],
              ex: { task: `Mở {{common/can/can_matrix.h}}. Viết ra giấy: có bao nhiêu CAN ID, ID nào do node nào gửi, chu kỳ bao nhiêu.`, hint: `Tìm các dòng ⟦#define CANID_…⟧ và comment mô tả phía trên mỗi khung.`, sol: `5 ID: ⟦0x100⟧ (Sensor, 10 ms), ⟦0x101⟧ (Sensor, 100 ms), ⟦0x200⟧ (Control, 100 ms), ⟦0x7E0⟧ (tester → Control, khi cần), ⟦0x7E8⟧ (Control → tester). Ngoài ra ⟦0x7DF⟧ là địa chỉ functional, khai báo trong code UDS chứ không nằm trong file này.` },
              quiz: [
                ['Khi tín hiệu tốc độ không tin được, Control ECU làm gì với ngõ ra?', ['Giữ giá trị cuối cùng', 'Đưa PWM về 0 % (safe state)', 'Tăng PWM lên 100 %', 'Reset ECU'], 1, 'Comment đầu ⟦control_app.c⟧: "While a speed fault is active the output goes to its safe state (PWM 0 %)".'],
                ['Byte nào của khung 0x100 chứa alive counter?', ['Byte 0', 'Byte 4', 'Byte 6', 'Byte 7'], 2, 'Byte 6 là counter, byte 7 là CRC-8 tính trên byte 0–6.'],
              ],
              sum: ['Hai ECU STM32 nói chuyện qua CAN 500 kbit/s; tester dùng UDS trên ISO-TP.', 'Khung tốc độ được bảo vệ bằng counter + CRC (ý tưởng E2E).', 'Lỗi → safe state (PWM 0 %) → DTC → tester đọc/xóa.', 'Mọi thứ đã chạy trên phần cứng thật, có log trong ⟦docs/logs/⟧.'],
            },
            {
              id: '1.1.2', t: 'Phần cứng và vai trò từng node', min: 15, pre: ['1.1.1'],
              concepts: [
                ['NUCLEO-G431RB', 'Board STM32G431 (Cortex-M4, 170 MHz). Ở đây là Sensor ECU, chạy bare-metal (không RTOS).'],
                ['STM32MP157D-DK1', 'Board có hai loại lõi: Cortex-A7 chạy Linux và Cortex-M4 chạy firmware ECU. M4 là Control ECU.'],
                ['Transceiver CAN', 'Chip SN65HVD230 chuyển tín hiệu logic TX/RX của MCU thành tín hiệu vi sai CANH/CANL trên dây.'],
                ['remoteproc', 'Cơ chế Linux dùng để nạp và khởi động firmware cho lõi phụ (M4).'],
              ],
              goal: `Bạn biết mỗi board làm gì, chân nào nối với gì, và vì sao Control ECU lại phức tạp hơn (Linux "sở hữu" lõi M4).`,
              bg: `MCU (vi điều khiển) có ngoại vi tích hợp: **FDCAN** (bộ điều khiển CAN), **ADC** (đọc điện áp), **TIM** (timer, tạo ngắt định kỳ và PWM), **UART** (cổng nối tiếp để in log). Firmware cấu hình các ngoại vi này qua thư viện **HAL** của ST, phần khởi tạo do công cụ **STM32CubeMX** sinh ra.

Bộ điều khiển CAN trong MCU chỉ xuất tín hiệu logic 0/1. Muốn lên dây CAN thật cần **transceiver**.`,
              th: `| Node | Phần cứng | Vai trò |
|---|---|---|
| Sensor ECU | NUCLEO-G431RB + SN65HVD230 | Đọc biến trở qua ADC, gửi 0x100/0x101, đồng thời là UDS tester |
| Control ECU | STM32MP157D-DK1, lõi Cortex-M4 | FreeRTOS, kiểm E2E, monitor lỗi, PWM, DTC, UDS server |
| Cortex-A7 (cùng chip) | Linux (OpenSTLinux) | Nạp firmware M4 qua remoteproc; dự kiến chạy tester C++ |

Control ECU đặc biệt ở chỗ **Linux trên A7 khởi động M4** (production mode). Hệ quả thực tế, bạn sẽ gặp lại nhiều lần:

- Linux đã cấu hình clock trước khi M4 chạy, nên M4 không thể giả định clock theo CubeMX ([[15.1.2]]).
- M4 không được tự reset bằng ⟦NVIC_SystemReset()⟧ vì Linux sẽ không khởi động lại nó ([[9.1.5]]).
- Không gắn debugger được như board thường: lỗi được tìm bằng cách đọc RAM từ Linux ([[15.1.1]]).`,
              use: `Chân và thông số phần cứng nằm rải rác trong các driver MCAL. Ba chỗ đáng xem: {{control_ecu/CM4/Core/Mcal/io_drv.h}} (nút USER1, ngõ ra PWM), {{sensor_ecu/Core/Mcal/gpio_drv.c}} (LED, nút B1) và {{control_ecu/CM4/Core/Mcal/can_drv.c}} (clock của FDCAN).`,
              code: [
                { f: 'control_ecu/CM4/Core/Mcal/io_drv.h', from: '@file    io_drv.h', to: '#define IODRV_PWM_MAX', hl: ['USER1 button', 'Output       :'],
                  ex: [['USER1 button', 'Nút USER1 nối PA14, tích cực mức thấp (có điện trở kéo lên bên trong). Nhấn = đọc được 0.'], ['TIM1_CH2 PWM', 'Ngõ ra là kênh 2 của TIM1, đưa ra chân Arduino D10 để gắn LED.'], ['IODRV_PWM_MAX', 'Độ phân giải duty: 0..1000 tương ứng 0..100 %, mỗi đơn vị 0,1 %.']] },
                { f: 'sensor_ecu/Core/Mcal/gpio_drv.c', from: 'B1 on NUCLEO-G431RB', n: 3,
                  ex: [['BTN_ACTIVE_LEVEL', 'Trên Nucleo, nhấn B1 kéo PC13 lên mức cao. Mức tích cực được gom thành một hằng số để đổi chỗ duy nhất nếu phần cứng khác.']] },
                { f: 'control_ecu/CM4/Core/Mcal/can_drv.c', from: '#define KERNEL_CLOCK_HSE_HZ', n: 2,
                  ex: [['KERNEL_CLOCK_HSE_HZ', 'Thạch anh 24 MHz cho FDCAN. Giá trị thứ hai (74,25 MHz) là clock mà Linux có thể để lại, driver phải xử lý được cả hai.']] },
              ],
              explain: `Để ý cách project ghi thông tin phần cứng **ngay trong header của driver**: ai dùng ⟦IoDrv_SetPwm()⟧ đều thấy luôn chân nào, đơn vị gì. Đây là thói quen tốt của code nhúng.`,
              run: [
                'Cấp nguồn cho cả hai board; transceiver được cấp 3,3 V.',
                'Sensor ECU (G431) khởi động thẳng vào firmware của nó.',
                'Trên DK1, Linux khởi động trước, rồi nạp firmware M4 qua remoteproc.',
                'Firmware M4 chỉnh lại clock FDCAN, khởi động FreeRTOS và bắt đầu nhận khung.',
              ],
              fig: { type: 'layers', rows: [
                ['Sensor ECU', ['STM32G431', 'ADC ← biến trở', 'FDCAN1 PA11/PA12', 'USART2 → log', 'Nút B1, LED']],
                ['Transceiver', ['SN65HVD230 (mỗi node một con)', '120 Ω mỗi đầu']],
                ['Bus', ['CANH', 'CANL', 'GND chung']],
                ['Control ECU', ['Cortex-M4: FDCAN1, TIM1 PWM, UART7 log, USER1', 'Cortex-A7: Linux, remoteproc']],
              ] },
              figCap: 'Các khối phần cứng và kết nối. Cả hai node đều nối FDCAN1 qua PA11/PA12 tới transceiver.',
              video: { t: 'Đi một vòng quanh phần cứng', d: '1:30', goal: 'Nhận diện từng board, transceiver và dây bus.',
                s: ['Cận cảnh NUCLEO-G431RB: biến trở trên chân PA0, nút B1, LED.', 'Module SN65HVD230 và điện trở 120 Ω.', 'Cặp dây xoắn CANH/CANL và dây GND chung.', 'STM32MP157D-DK1: chân D14/D15 cho FDCAN, LED PWM trên D10.', 'Mở terminal: log UART của hai ECU.'] },
              pit: [
                ['Quên nối GND chung giữa hai board', 'CAN là tín hiệu vi sai nhưng transceiver vẫn cần cùng mốc điện áp. Thiếu GND chung, bus chập chờn hoặc không chạy.'],
                ['Dùng chân A4/A5 trên DK1', 'README ghi rõ: dùng D14/D15 trên CN13 (hoặc chân 3 và 5 của CN2), không phải A4/A5.'],
              ],
              ex: { task: `Tìm trong {{sensor_ecu/Core/Src/main.c}} đoạn cấu hình FDCAN do CubeMX sinh ra. Giá trị ⟦NominalPrescaler⟧ là bao nhiêu?`, hint: `Tìm hàm ⟦MX_FDCAN1_Init⟧.`, sol: `⟦NominalPrescaler = 10⟧, ⟦NominalTimeSeg1 = 29⟧, ⟦NominalTimeSeg2 = 4⟧. Bạn sẽ dùng các con số này để tính bitrate ở [[3.1.3]].` },
              quiz: [
                ['Lõi nào trên STM32MP157 chạy firmware Control ECU?', ['Cortex-A7', 'Cortex-M4', 'Cả hai', 'Không lõi nào, chạy trên G431'], 1, 'M4 chạy FreeRTOS và firmware ECU; A7 chạy Linux.'],
                ['Vì sao cần transceiver SN65HVD230?', ['Để tăng tốc độ CPU', 'Để chuyển tín hiệu logic TX/RX thành tín hiệu vi sai CANH/CANL', 'Để lưu DTC', 'Để tạo PWM'], 1, 'FDCAN trong MCU chỉ có tín hiệu logic; transceiver lái dây vi sai.'],
              ],
              sum: ['Sensor ECU = G431 bare-metal; Control ECU = Cortex-M4 của MP157 chạy FreeRTOS.', 'Linux trên A7 nạp firmware M4: clock, reset và debug đều bị ảnh hưởng.', 'Thông số chân nằm trong header của driver MCAL.'],
            },
            {
              id: '1.1.3', t: 'Bản đồ repository và cái gì được build ở đâu', min: 15, pre: ['1.1.1'],
              concepts: [
                ['common/', 'Code C không phụ thuộc phần cứng (E2E, ISO-TP, UDS, DTC, CAN matrix), dùng chung cho cả hai ECU, test và tester C++.'],
                ['MCAL', 'Microcontroller Abstraction Layer: lớp driver duy nhất được gọi HAL (⟦Core/Mcal/⟧).'],
                ['Build target', 'Một chương trình được build ra: firmware Sensor, firmware Control, các file test C, chương trình tester C++.'],
              ],
              goal: `Bạn biết mỗi thư mục chứa gì, và cùng một file ⟦common/uds/uds_server.c⟧ được build vào firmware, unit test C và tester C++ như thế nào.`,
              bg: `Một repo nhúng thường có nhiều "đích build": firmware cho từng chip (biên dịch chéo bằng ⟦arm-none-eabi-gcc⟧) và các chương trình chạy trên PC (unit test, công cụ). Hiểu file nào thuộc đích nào giúp bạn biết sửa ở đâu thì ảnh hưởng tới đâu.`,
              th: `| Thư mục | Nội dung | Build bằng |
|---|---|---|
| ⟦sensor_ecu/⟧ | Project STM32CubeIDE của G431: ⟦Core/App⟧, ⟦Core/Mcal⟧, code CubeMX | STM32CubeIDE |
| ⟦control_ecu/CM4/⟧ | Firmware Cortex-M4: App, Mcal, OpenAMP | STM32CubeIDE |
| ⟦common/⟧ | can, e2e, isotp, uds, dtc | được link vào cả hai firmware |
| ⟦tests/⟧ | Unit test C cho ⟦common/⟧ | ⟦make⟧ + gcc trên PC |
| ⟦tester/⟧ | Client UDS C++20, ECU mô phỏng, GoogleTest | CMake |
| ⟦tools/⟧ | check_all, static_analysis (MISRA), arm_compile_check | bash |
| ⟦docs/⟧ | Báo cáo LaTeX, log phần cứng, MISRA deviations | |

Ý tưởng then chốt: ⟦common/⟧ **không include HAL**. Nhờ vậy cùng một file chạy được ở 4 nơi: firmware Sensor, firmware Control, unit test C, và ⟦SimulatedEcu⟧ của tester C++.`,
              use: `Bạn thấy điều này rõ nhất trong {{tester/CMakeLists.txt}}: thư viện ⟦ecu_sim⟧ biên dịch thẳng ⟦uds_server.c⟧ và ⟦dtc_manager.c⟧ từ ⟦common/⟧. Còn {{tests/Makefile}} biên dịch từng module của ⟦common/⟧ với file test tương ứng.`,
              code: [
                { f: 'tester/CMakeLists.txt', from: '# Simulated Control ECU', to: 'target_compile_options(ecu_sim', hl: ['${COMMON_DIR}/uds/uds_server.c', '${COMMON_DIR}/dtc/dtc_manager.c'],
                  ex: [['add_library(ecu_sim', 'Một thư viện gồm phần bọc C++ (⟦simulated_ecu.cpp⟧) và hai file C thật của ECU.'], ['${COMMON_DIR}/uds/uds_server.c', 'Không có bản sao: đây chính là file chạy trên M4. Test C++ vì vậy kiểm tra đúng code thật.']] },
                { f: 'tests/Makefile', from: 'TESTS := test_isotp', to: '$(CC) $(CFLAGS) -I$(COMMON)/uds', hl: ['$(COMMON)/e2e/e2e.c'],
                  ex: [['TESTS := test_isotp', 'Bốn chương trình test, mỗi cái cho một module.'], ['$(BUILD)/test_uds$(EXE)', 'Test UDS được link cùng DTC manager thật, vì server UDS gọi DTC manager khi xử lý 0x19/0x14.']] },
              ],
              explain: `Cả hai file build đều trỏ thẳng vào ⟦../common⟧. Không có thư mục nào chứa "bản copy để test". Đó là lý do khi một test xanh, bạn tin được rằng code trên board cũng đúng (ở mức logic).`,
              run: [
                'Sửa một dòng trong ⟦common/e2e/e2e.c⟧.',
                '⟦make -C tests⟧ biên dịch lại ⟦test_e2e⟧ và chạy nó.',
                'CubeIDE biên dịch lại cả firmware Sensor (gửi) và Control (nhận), vì cả hai link thư mục ⟦common⟧.',
                '⟦tools/arm_compile_check.sh⟧ biên dịch file đó cho cả hai đích ARM mà không cần mở IDE.',
              ],
              fig: { type: 'layers', rows: [
                ['common/ (C thuần)', ['can_matrix.h', 'e2e + crc8', 'isotp', 'uds_server', 'dtc_manager']],
                ['Firmware Sensor', ['Core/App: sensor_app, tester_app', 'Core/Mcal', 'common/*']],
                ['Firmware Control', ['Core/App: control_app, diag_app', 'Core/Mcal', 'FreeRTOS', 'common/*']],
                ['PC: tests/', ['test_isotp', 'test_e2e', 'test_dtc', 'test_uds']],
                ['PC: tester/', ['uds_client (C++)', 'ecu_sim = uds_server.c + dtc_manager.c', 'GoogleTest']],
              ] },
              video: { t: 'Một file, bốn chương trình', d: '1:45', goal: 'Thấy common/ được tái sử dụng ở đâu.',
                s: ['Mở cây thư mục repo, tô màu common/.', 'Mở tests/Makefile: chỉ ra ../common.', 'Mở tester/CMakeLists.txt: ecu_sim dùng uds_server.c.', 'Mở .cproject của Sensor: thư mục common được link vào firmware.', 'Kết luận: sửa common/ thì phải chạy lại cả test lẫn compile ARM.'] },
              pit: [
                ['Sửa ⟦common/⟧ rồi chỉ chạy unit test', 'Unit test chạy trên PC với gcc. Firmware dùng ⟦arm-none-eabi-gcc⟧ và HAL thật. Chạy ⟦tools/check_all.sh⟧ để có cả bước biên dịch ARM.'],
                ['Thêm ⟦#include "main.h"⟧ vào một file trong ⟦common/⟧', 'Làm vậy là phá quy tắc phân lớp: test trên PC sẽ không biên dịch được nữa. Phần cứng chỉ được vào qua con trỏ hàm ([[2.2.2]]).'],
              ],
              ex: { task: `Chạy ⟦git ls-files common⟧ (hoặc mở thư mục). Với mỗi file ⟦.c⟧, ghi ra test nào trong ⟦tests/⟧ kiểm tra nó.`, sol: `⟦crc8.c⟧ và ⟦e2e.c⟧ → ⟦test_e2e⟧; ⟦isotp.c⟧ → ⟦test_isotp⟧; ⟦dtc_manager.c⟧ → ⟦test_dtc⟧ và ⟦test_uds⟧; ⟦uds_server.c⟧ → ⟦test_uds⟧. Ngoài ra ⟦uds_server.c⟧ và ⟦dtc_manager.c⟧ còn được test gián tiếp qua GoogleTest của tester.` },
              quiz: [
                ['Vì sao ⟦common/⟧ không được include HAL?', ['Vì HAL quá chậm', 'Để cùng code chạy được trên firmware, trên PC (test) và trong tester C++', 'Vì MISRA cấm HAL', 'Vì HAL chỉ dành cho Linux'], 1, 'Không phụ thuộc phần cứng là điều kiện để tái sử dụng và test trên PC.'],
                ['Chương trình nào KHÔNG chứa ⟦uds_server.c⟧?', ['Firmware Control ECU', 'tests/test_uds', 'tester ecu_sim', 'tests/test_e2e'], 3, '⟦test_e2e⟧ chỉ link ⟦e2e.c⟧ và ⟦crc8.c⟧.'],
              ],
              sum: ['⟦common/⟧ = logic giao thức thuần C, tái sử dụng ở 4 đích build.', 'Chỉ ⟦Core/Mcal/⟧ được gọi HAL.', 'Sửa ⟦common/⟧ → chạy ⟦tools/check_all.sh⟧.'],
            },
          ],
        },
        {
          id: '1.2', t: 'Project được kiểm chứng như thế nào',
          subs: [
            {
              id: '1.2.1', t: 'Milestone M1–M5 và cách đọc log UART', min: 20, pre: ['1.1.2'],
              concepts: [
                ['Internal loopback', 'Chế độ FDCAN tự nhận lại khung mình gửi bên trong chip, không cần transceiver. Dùng để kiểm cấu hình trước khi có bus thật.'],
                ['Self-test trên chip', 'Một link ISO-TP thứ hai trên chính Control ECU đóng vai tester, chạy 14 bước UDS và in PASS/FAIL.'],
                ['Milestone', 'Một mốc có tiêu chí kiểm chứng rõ ràng và bằng chứng (log, ảnh).'],
              ],
              goal: `Bạn hiểu chiến lược "kiểm chứng từng lớp": loopback trước, bus thật sau; và đọc được một dòng log trạng thái của mỗi ECU.`,
              bg: `Khi dựng hệ nhúng, nếu ghép tất cả rồi mới thử thì lúc hỏng sẽ không biết lỗi ở đâu: dây, bit timing, filter, phần mềm? Cách làm chuyên nghiệp là **tách lớp**: kiểm từng phần trong điều kiện ít biến số nhất, rồi mới thêm biến số.`,
              th: `| Milestone | Kiểm cái gì | Điều kiện |
|---|---|---|
| M1 | Sensor ECU gửi đúng 100 + 10 khung/s | FDCAN internal loopback, không cần dây |
| M2 | Control ECU nhận, kiểm E2E, PWM | loopback, M4 tự giả làm Sensor |
| M3 | UDS + DTC trên Control ECU | loopback, self-test 14 bước |
| M4 | Hai node trên bus thật + fault injection | 2 transceiver, cặp dây xoắn |
| M5 | Tester bên ngoài qua bus | 22 bước PASS, kể cả hard reset |

Mỗi ECU in một dòng trạng thái mỗi giây. Dòng của Control ECU được tạo trong ⟦LogStatus()⟧ và chứa gần như mọi thứ cần biết: tốc độ, tuổi khung, PWM, các bộ đếm E2E, fault mask, số DTC, số khung, bus-off, tràn queue và heap còn trống.`,
              use: `Ở [[14.1.4]] bạn sẽ thấy cách các milestone ghép lại thành chiến lược test hoàn chỉnh. Bài này tập trung vào việc **đọc** bằng chứng.`,
              code: [
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'static void LogStatus(const SensorView_t *v', to: '(unsigned)xPortGetFreeHeapSize());', hl: ['e2e ok=%lu lost=%lu crc=%lu rep=%lu seq=%lu', 'faults=0x%02lx dtc=%u'],
                  ex: [['mask |= (s_faults[i]', 'Gộp 5 cờ lỗi thành một byte: bit 0 timeout, bit 1 range, bit 2 E2E, bit 3 ADC, bit 4 output.'], ['e2e ok=%lu lost=%lu crc=%lu rep=%lu seq=%lu', 'Năm bộ đếm E2E. Khi chạy bình thường chỉ ⟦ok⟧ tăng khoảng 100 mỗi giây.'], ['qovf=%lu', 'Số lần queue RX bị đầy. Mọi milestone đều phải là 0.']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'static const TestStep_t k_steps[] =', to: '#define STEP_COUNT', hl: ['Reset in default -> NRC 7E'],
                  ex: [['STEP("TesterPresent"', 'Mỗi bước gồm tên, request, tiền tố response mong đợi và có chèn lỗi cục bộ hay không.'], ['"Confirmed DTCs = 0",          rq_cnt,   rs_cnt0,   1', 'Số 1 ở cuối: sau bước này bật lỗi output cục bộ, để bước sau thấy 1 DTC confirmed.']] },
              ],
              explain: `Hãy đọc log như đọc bảng đồng hồ: một con số bất thường (⟦crc⟧ tăng, ⟦qovf⟧ khác 0, ⟦busoff⟧ tăng) chỉ thẳng tới lớp đang có vấn đề.`,
              run: [
                'Mỗi 10 ms, Monitor task tăng biến ⟦tick⟧.',
                'Khi ⟦tick % 100 == 0⟧ (mỗi 1 s), gọi ⟦LogStatus⟧ với bản sao của view.',
                '⟦ControlApp_Log⟧ khóa mutex log rồi ⟦vprintf⟧ ra UART7, nên dòng log không bị task khác chen ngang.',
              ],
              fig: { type: 'flow', nodes: [['M1: Sensor loopback (không dây)', 'start'], 'M2: Control loopback, M4 tự giả Sensor', 'M3: UDS + DTC, self-test 14/14 trong loopback', 'M4: bus thật 2 node, chèn lỗi bằng nút B1', ['M5: tester ngoài qua bus, 22/22 bước', 'end']] },
              video: { t: 'Đọc log Control ECU trong 90 giây', d: '1:30', goal: 'Đọc từng trường trong dòng [CTRL].',
                s: ['Một dòng log thật của Control ECU lúc bình thường.', 'Tô màu: speed, age, pwm.', 'Tô màu nhóm e2e: ok tăng 100/s, các bộ đếm khác đứng yên.', 'Chèn lỗi SILENT: age vượt 100 ms, faults=0x01, pwm 0.', 'Kết luận: log là công cụ debug số một khi không có debugger.'] },
              pit: [
                ['Thấy ⟦rx = tx − 1⟧ trong loopback rồi nghĩ là mất khung', 'Đó là khung cuối đang trên đường đi lúc in log, README giải thích đúng như vậy.'],
                ['Bỏ qua milestone loopback, cắm bus luôn', 'Khi bus không chạy, bạn không phân biệt được lỗi dây hay lỗi cấu hình. Loopback loại trừ toàn bộ phần mềm trước.'],
              ],
              ex: { task: `Mở ⟦docs/logs/m4_bus_fault_injection_control.log⟧ trong repo. Tìm thời điểm ⟦SPEED_TIMEOUT SET⟧ và so với thời điểm Sensor chuyển sang SILENT trong log Sensor.`, hint: `README ghi bảng tóm tắt M4 với các mốc 39,7 s và 39,8 s.`, sol: `Sensor chuyển SILENT lúc khoảng 39,7 s, Control báo ⟦SPEED_TIMEOUT SET⟧ lúc khoảng 39,8 s, khớp với timeout 100 ms cộng chu kỳ monitor 10 ms.` },
              quiz: [
                ['Milestone nào lần đầu dùng bus CAN thật giữa hai board?', ['M1', 'M2', 'M3', 'M4'], 3, 'M1–M3 đều ở internal loopback.'],
                ['Trong log Control ECU, ⟦qovf⟧ khác 0 nghĩa là gì?', ['Bus-off', 'Queue RX từ ISR sang task bị đầy, có khung bị mất', 'CRC sai', 'Heap hết'], 1, '⟦s_rxQueueOverflow⟧ tăng khi ⟦osMessageQueuePut⟧ trong ISR thất bại.'],
              ],
              sum: ['Kiểm chứng từng lớp: loopback → bus thật → tester ngoài.', 'Log 1 giây/lần là "bảng đồng hồ" của ECU.', 'Mỗi milestone có bằng chứng trong ⟦docs/logs/⟧ và README.'],
            },
            {
              id: '1.2.2', t: 'Chạy toàn bộ kiểm tra trên máy của bạn', min: 20, pre: ['1.1.3'],
              concepts: [
                ['check_all.sh', 'Script chạy unit test, cppcheck + MISRA và biên dịch ARM trong một lệnh.'],
                ['MSYS2 UCRT64', 'Bộ công cụ Unix trên Windows chứa gcc, make, cppcheck, cmake. Không nằm trên PATH của Git Bash nên script tự thêm vào.'],
                ['CI', 'Continuous Integration: GitHub Actions tự build và chạy test mỗi lần push.'],
              ],
              goal: `Bạn tự chạy được mọi kiểm tra của repo trên Windows, hiểu mỗi bước kiểm cái gì và đọc được kết quả.`,
              bg: `Một repo tốt có **một lệnh** để biết "mọi thứ còn đúng không". Ở đây là ⟦tools/check_all.sh⟧. CI trên GitHub chạy một phần tương tự trên Linux.`,
              th: `Ba bước của ⟦check_all.sh⟧:

1. **Unit test C** (⟦make -C tests⟧): 4 chương trình test cho ⟦common/⟧, mỗi cái in ⟦[PASS]⟧ / ⟦[FAIL]⟧ cho từng hàm test và tổng số check.
2. **Phân tích tĩnh** (⟦tools/static_analysis.sh⟧): cppcheck với addon MISRA C:2012 trên toàn bộ code của project, thoát mã 1 nếu có bất kỳ finding nào.
3. **Biên dịch ARM** (⟦tools/arm_compile_check.sh⟧): biên dịch mọi file App, Mcal và common bằng toolchain của CubeIDE với đúng define và include path của từng ECU. Tự bỏ qua nếu máy không có toolchain.

Tester C++ build riêng bằng CMake (xem [[13.1.1]]).`,
              use: `Lệnh dùng hằng ngày trong Git Bash, đứng ở thư mục gốc:

~~~bash
bash tools/check_all.sh
export PATH="/c/msys64/ucrt64/bin:$PATH"
make -C tests build/test_e2e.exe && tests/build/test_e2e.exe   # một test
~~~`,
              code: [
                { f: 'tools/check_all.sh', from: 'if [ -d /c/msys64/ucrt64/bin ]; then', to: 'echo "All checks passed."', hl: ['make -s -C tests || exit 1', 'bash tools/static_analysis.sh || exit 1', 'out=$(bash tools/arm_compile_check.sh 2>&1)'],
                  ex: [['export PATH="/c/msys64/ucrt64/bin', 'Tự thêm MSYS2 vào PATH nếu nó được cài ở chỗ mặc định.'], ['|| exit 1', 'Bước nào lỗi là dừng ngay, không chạy tiếp các bước sau.'], ['if [ $rc -eq 2 ]; then', 'Mã thoát 2 nghĩa là không tìm thấy compiler ARM: in "skipped" thay vì báo lỗi.']] },
                { f: '.github/workflows/tests.yml', from: '- name: C unit tests', to: 'run: tester/build/uds_tester --sim', hl: ['run: make -C tests', '-fsanitize=address,undefined'],
                  ex: [['run: make -C tests', 'CI chạy cùng Makefile, trên Linux thì có thêm UBSan.'], ['-fsanitize=address,undefined', 'Tester C++ được build với ASan và UBSan để bắt lỗi bộ nhớ và hành vi không xác định.']] },
              ],
              explain: `Lưu ý một chi tiết trong ⟦check_all.sh⟧: kết quả bước ARM được giữ trong biến chứ không ghi ra file tạm. Lý do là trên Windows, ⟦/tmp⟧ của MSYS2 và của Git Bash là hai thư mục khác nhau. Đây là loại lỗi chỉ lộ ra khi chạy thật trên máy.`,
              run: [
                'Script ⟦cd⟧ về gốc repo, thêm MSYS2 vào PATH.',
                '⟦make -s -C tests⟧ biên dịch (nếu cần) và chạy 4 file test.',
                'cppcheck phân tích ba nhóm: common, sensor_ecu, control_ecu.',
                'Toolchain ARM biên dịch 22 lần (common được biên dịch cho cả hai ECU).',
                'In ⟦All checks passed.⟧ nếu mọi bước thành công.',
              ],
              fig: { type: 'flow', nodes: [['bash tools/check_all.sh', 'start'], 'Unit test C: 4 chương trình, UBSan trên Linux', ['Có lỗi? → dừng, exit 1', 'dec'], 'cppcheck + MISRA C:2012: phải "no findings"', 'arm-none-eabi-gcc: biên dịch App + Mcal + common cho 2 ECU', ['All checks passed.', 'end']] },
              video: { t: 'Một lệnh kiểm tra cả repo', d: '1:00', goal: 'Chạy và đọc kết quả check_all.sh.',
                s: ['Mở Git Bash ở gốc repo, gõ bash tools/check_all.sh.', 'Phần unit test: các dòng [PASS], tổng số check.', 'Phần MISRA: "static analysis: no findings".', 'Phần ARM: "22 compilations, no errors".', 'Sửa thử một lỗi cú pháp và xem script dừng ở đâu.'] },
              pit: [
                ['⟦gcc: command not found⟧ khi chạy ⟦make -C tests⟧ trực tiếp', 'MSYS2 chưa có trên PATH. Chạy ⟦export PATH="/c/msys64/ucrt64/bin:$PATH"⟧ trước, hoặc dùng ⟦check_all.sh⟧.'],
                ['Dùng lại thư mục ⟦tester/build⟧ có sẵn', 'Cache CMake trong đó được tạo từ đường dẫn khác và cmake từ chối. Build vào thư mục mới.'],
              ],
              ex: { task: `Chạy ⟦bash tools/check_all.sh⟧. Ghi lại: tổng số check của ⟦test_isotp⟧, và số lần biên dịch ARM.`, sol: `Số check của từng test in ở cuối phần đó (ví dụ ⟦test_e2e⟧ in "58 checks, 0 failures"). Bước ARM in "22 compilations, no errors": 5 file ⟦.c⟧ của common × 2 ECU = 10, cộng 7 file của Sensor (App + Mcal) và 5 file của Control.` },
              quiz: [
                ['Nếu máy không có toolchain ARM, ⟦check_all.sh⟧ làm gì ở bước biên dịch ARM?', ['Báo lỗi và dừng', 'In "skipped" và vẫn có thể pass', 'Tự tải toolchain', 'Biên dịch bằng gcc thường'], 1, '⟦arm_compile_check.sh⟧ thoát mã 2, ⟦check_all.sh⟧ coi đó là bỏ qua.'],
                ['Công cụ nào kiểm MISRA C:2012?', ['GoogleTest', 'cppcheck với addon misra.py', 'CMake', 'UBSan'], 1, 'Xem ⟦tools/static_analysis.sh⟧.'],
              ],
              sum: ['⟦bash tools/check_all.sh⟧ = unit test + MISRA + biên dịch ARM.', 'Trên Windows, công cụ nằm trong MSYS2 UCRT64.', 'CI chạy test C và C++ (có sanitizer) mỗi lần push.'],
            },
          ],
        },
      ],
    },
    {
      id: 'c02', t: 'Ngôn ngữ C cho firmware',
      lessons: [
        {
          id: '2.1', t: 'Dữ liệu ở mức bit',
          subs: [
            {
              id: '2.1.1', t: 'Kiểu số nguyên cố định, hậu tố U và thao tác bit', min: 25,
              concepts: [
                ['uint8_t / uint16_t / uint32_t', 'Kiểu số nguyên không dấu có độ rộng cố định 8/16/32 bit (⟦<stdint.h>⟧), không phụ thuộc trình biên dịch.'],
                ['Big-endian', 'Byte có nghĩa lớn nhất gửi trước. 1234 (0x04D2) → byte 0 = 0x04, byte 1 = 0xD2.'],
                ['Hậu tố U', '⟦10U⟧ là hằng không dấu. MISRA yêu cầu để tránh trộn có dấu/không dấu.'],
                ['Bit mask', 'Giá trị dùng để bật (⟦|⟧), tắt (⟦& ~⟧) hoặc kiểm tra (⟦&⟧) từng bit.'],
              ],
              goal: `Bạn đọc và viết được các phép đóng gói byte, bật/tắt bit giống hệt code trong project, và hiểu vì sao code có nhiều phép ép kiểu ⟦(uint8_t)⟧ đến vậy.`,
              bg: `Khung CAN chỉ là 8 byte. Mọi tín hiệu (tốc độ 16 bit, cờ trạng thái 1 bit, counter 4 bit) phải được nhét vào các byte đó. Vì vậy code nhúng thao tác bit liên tục: dịch (⟦<<⟧, ⟦>>⟧), AND, OR, XOR.

Trong C, kiểu ⟦int⟧ có độ rộng tùy nền tảng. Firmware dùng ⟦uint8_t⟧, ⟦uint16_t⟧… để biết chắc mỗi biến chiếm bao nhiêu bit.`,
              th: `**Đóng gói big-endian:** lấy byte cao bằng ⟦value >> 8⟧, byte thấp bằng ⟦value & 0xFF⟧.

**Bật, tắt, kiểm tra bit:**
~~~c
status |= DTC_STATUS_CDTC;                 /* bật bit 3 */
status &= (uint8_t)~DTC_STATUS_TF;         /* tắt bit 0 */
if ((status & DTC_STATUS_CDTC) != 0U) {}   /* kiểm tra bit 3 */
~~~

**Vì sao nhiều phép ép kiểu?** Trong C, phép tính trên ⟦uint8_t⟧ được **nâng lên ⟦int⟧** trước (integer promotion). ⟦~DTC_STATUS_TF⟧ cho ra một ⟦int⟧ âm; gán ngược vào ⟦uint8_t⟧ cần ép kiểu rõ ràng. MISRA C:2012 (nhóm rule 10.x) bắt buộc viết ra các phép ép này để người đọc thấy chuyển kiểu ở đâu.`,
              use: `- ⟦PutU16Be⟧ / ⟦PutU32Be⟧ trong {{sensor_ecu/Core/App/sensor_app.c}} đóng gói tốc độ và uptime.
- Status byte của DTC được bật/tắt bit trong {{common/dtc/dtc_manager.c@void DtcMgr_ReportResult}}.
- Bên nhận ghép 2 byte thành tốc độ trong {{control_ecu/CM4/Core/App/control_app.c@s_view.speedX10      =}}.`,
              code: [
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: 'static void PutU16Be(uint8_t *dst, uint16_t value)', to: 'dst[3] = (uint8_t)(value & 0xFFU);', hl: ['dst[0] = (uint8_t)(value >> 8U);'],
                  ex: [['dst[0] = (uint8_t)(value >> 8U);', 'Byte cao: dịch phải 8 bit. Ép ⟦(uint8_t)⟧ vì kết quả của phép dịch là kiểu rộng hơn.'], ['dst[1] = (uint8_t)(value & 0xFFU);', 'Byte thấp: giữ 8 bit cuối bằng mask ⟦0xFF⟧.'], ['dst[0] = (uint8_t)(value >> 24U);', 'Bản 32 bit: 4 byte, byte cao nhất đi trước.']] },
                { f: 'common/dtc/dtc_manager.c', from: 'e->status &= (uint8_t)~(DTC_STATUS_TNCTOC | DTC_STATUS_TNCSLC);', to: 'e->failCount = 0U;', hl: ['e->status |= (uint8_t)(DTC_STATUS_TF'],
                  ex: [['e->status &= (uint8_t)~(DTC_STATUS_TNCTOC | DTC_STATUS_TNCSLC);', 'Tắt 2 bit cùng lúc: OR hai mask, đảo, rồi AND.'], ['e->status |= (uint8_t)(DTC_STATUS_TF', 'Bật 4 bit một lúc khi test fail.'], ['e->status &= (uint8_t)~DTC_STATUS_TF;', 'Test pass: chỉ tắt bit testFailed, các bit lịch sử giữ nguyên.']] },
              ],
              explain: `Hai mẫu này lặp lại ở khắp project. Khi đã quen, bạn đọc ⟦x &= (uint8_t)~MASK⟧ thành "tắt các bit MASK" mà không cần nghĩ.`,
              run: [
                'Tốc độ 123,4 km/h → ⟦speed = 1234 = 0x04D2⟧.',
                '⟦PutU16Be(&frame.data[0], speed)⟧ ghi ⟦data[0] = 0x04⟧, ⟦data[1] = 0xD2⟧.',
                'Bên nhận: ⟦((uint16_t)data[0] << 8) | data[1]⟧ = 0x04D2 = 1234 → 123,4 km/h.',
              ],
              fig: { type: 'bytes', title: 'Khung 0x100 (8 byte)', cells: [['byte 0–1', 'VehicleSpeed', '0,1 km/h, big-endian'], ['byte 2–3', 'AdcRaw', '12 bit, debug'], ['byte 4', 'Status', 'bit0 chèn lỗi, bit1 lỗi ADC'], ['byte 5', 'reserved', '0'], ['byte 6', 'AliveCounter', '0..15'], ['byte 7', 'CRC-8', 'trên byte 0–6']] },
              video: { t: 'Đóng gói 1234 vào 2 byte', d: '1:00', goal: 'Hình dung phép dịch và mask.',
                s: ['Viết 1234 dạng nhị phân 16 bit.', 'Dịch phải 8: còn 0x04.', 'AND 0xFF: còn 0xD2.', 'Ghép lại phía nhận: dịch trái 8 rồi OR.'] },
              pit: [
                ['Quên ép ⟦(uint16_t)⟧ trước khi dịch trái', '⟦data[0] << 8⟧ vẫn chạy nhờ integer promotion, nhưng MISRA đòi viết rõ và với kiểu 32 bit có thể tràn. Project viết ⟦((uint16_t)frame->data[0] << 8U)⟧.'],
                ['Dùng ⟦~⟧ trên ⟦uint8_t⟧ rồi so sánh', '⟦~x⟧ có kiểu ⟦int⟧ và các bit cao bằng 1. Luôn ép về ⟦uint8_t⟧ trước khi so sánh hay gán.'],
              ],
              ex: { task: `Uptime là 70 000 giây. Viết 4 byte mà ⟦PutU32Be⟧ sẽ ghi vào khung 0x101.`, hint: `70 000 = 0x00011170.`, sol: `⟦00 01 11 70⟧: byte 1 = 0x00, byte 2 = 0x01, byte 3 = 0x11, byte 4 = 0x70 (byte 0 của khung là NodeState).` },
              quiz: [
                ['Tốc độ 0x09C4 được gửi big-endian. byte 0 là gì?', ['0xC4', '0x09', '0x00', '0x9C'], 1, 'Big-endian: byte có nghĩa lớn gửi trước.'],
                ['Biểu thức nào tắt bit 2 (mask 0x04) của ⟦status⟧ mà giữ các bit khác?', ['status |= 0x04', 'status &= (uint8_t)~0x04U', 'status ^= 0xFF', 'status = 0x04'], 1, 'AND với mask đã đảo.'],
              ],
              sum: ['Dùng kiểu cố định độ rộng và hậu tố ⟦U⟧.', 'Big-endian: ⟦>> 8⟧ cho byte cao, ⟦& 0xFF⟧ cho byte thấp.', 'Bật ⟦|=⟧, tắt ⟦&= ~⟧, kiểm ⟦& != 0⟧.', 'Ép kiểu rõ ràng vì integer promotion, theo MISRA.'],
            },
          ],
        },
        {
          id: '2.2', t: 'Tổ chức một module C',
          subs: [
            {
              id: '2.2.1', t: 'Header, source, static, struct, enum và bảng const', min: 25, pre: ['2.1.1'],
              concepts: [
                ['Include guard', '⟦#ifndef X_H / #define X_H / #endif⟧: ngăn một header bị include hai lần.'],
                ['static (file scope)', 'Biến hoặc hàm chỉ nhìn thấy trong file .c đó: là cách C "đóng gói" trạng thái của module.'],
                ['Quy ước tên', '⟦Module_Function⟧ cho API, ⟦s_⟧ cho biến static, ⟦k_⟧ cho bảng const, ⟦_t⟧ cho kiểu.'],
                ['typedef enum', 'Đặt tên cho tập giá trị, ví dụ các trạng thái trả về của E2E.'],
              ],
              goal: `Bạn đọc được cấu trúc của mọi module trong project: phần công khai nằm ở .h, phần ẩn nằm ở .c, và biết vì sao C dùng ⟦static⟧ thay cho ⟦private⟧.`,
              bg: `C không có class. Cách tổ chức chuẩn là mỗi module một cặp file: **header (.h)** khai báo những gì module khác được dùng, **source (.c)** chứa cài đặt và trạng thái ẩn. Từ khóa ⟦static⟧ ở phạm vi file làm biến/hàm "riêng tư" với file đó.`,
              th: `Một module trong project có các phần:

- **.h**: include guard, các ⟦#define⟧ hằng số, ⟦typedef enum⟧ / ⟦typedef struct⟧, prototype các hàm ⟦Module_…⟧, comment mô tả API.
- **.c**: ⟦#include⟧ header của chính nó trước, rồi biến ⟦static s_…⟧, hàm ⟦static⟧ hỗ trợ, cuối cùng là cài đặt API.
- **Bảng ⟦static const k_…[]⟧**: dữ liệu cấu hình cố định nằm trong flash (ví dụ bảng DTC, bảng DID).

Các trạng thái được biểu diễn bằng ⟦enum⟧ thay vì số trần. ⟦E2e_Status_t⟧ có 7 giá trị và một hàm ⟦static inline⟧ cho biết giá trị nào cho phép dùng dữ liệu.`,
              use: `⟦common/e2e⟧ là module nhỏ nhất, đọc trọn được: {{common/e2e/e2e.h}} và {{common/e2e/e2e.c}}. Ví dụ bảng const là ⟦k_dtcTable⟧ trong {{control_ecu/CM4/Core/App/diag_app.c@static const DtcMgr_Config_t k_dtcTable}}.`,
              code: [
                { f: 'common/e2e/e2e.h', from: '#ifndef E2E_H', to: '#endif /* E2E_H */', hl: ['typedef enum', 'static inline bool E2e_IsValid'],
                  ex: [['#ifndef E2E_H', 'Include guard: lần include thứ hai sẽ bỏ qua toàn bộ nội dung.'], ['#define E2E_MAX_DELTA_COUNTER', 'Hằng số có tên, kèm comment ý nghĩa: chấp nhận mất tối đa 2 khung.'], ['typedef struct', 'Trạng thái của bên nhận nằm trong struct do caller giữ, không phải biến toàn cục: mỗi khung cần kiểm tra có một ⟦E2e_RxState_t⟧ riêng.'], ['static inline bool E2e_IsValid', 'Hàm nhỏ đặt trong header để gọi không tốn chi phí, trả về true với 3 trạng thái "dữ liệu dùng được".']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'static const DtcMgr_Config_t k_dtcTable[] =', to: '};', hl: ['{ 0xC10087UL, 1U },'],
                  ex: [['static const DtcMgr_Config_t k_dtcTable[] =', '⟦static⟧: chỉ file này thấy; ⟦const⟧: nằm trong flash, không sửa được lúc chạy.'], ['{ 0xC10087UL, 1U },', 'Mỗi dòng: mã DTC 3 byte và số lần fail liên tiếp để confirmed.']] },
              ],
              explain: `Để ý ⟦E2e_RxState_t⟧ do **caller** cấp phát (trong ⟦control_app.c⟧ có hai biến ⟦s_e2eSpeed⟧ và ⟦s_e2eAlive⟧). Module E2E vì vậy không có biến static nào và kiểm được nhiều luồng khung cùng lúc. Ngược lại, ⟦uds_server.c⟧ và ⟦dtc_manager.c⟧ giữ trạng thái trong biến static, nên chỉ có một instance; tester C++ phải xử lý chuyện này ([[13.2.4]]).`,
              run: [
                '⟦control_app.c⟧ include ⟦e2e.h⟧, thấy kiểu ⟦E2e_RxState_t⟧ và các hàm API.',
                'Khai báo ⟦static E2e_RxState_t s_e2eSpeed;⟧ ở phạm vi file.',
                'Lúc init gọi ⟦E2e_InitRx(&s_e2eSpeed)⟧; mỗi khung gọi ⟦E2e_Check(&s_e2eSpeed, …)⟧.',
                'Trình liên kết nối lời gọi với cài đặt trong ⟦e2e.c⟧.',
              ],
              fig: { type: 'layers', rows: [['e2e.h (công khai)', ['#define hằng số', 'E2e_Status_t', 'E2e_RxState_t', 'E2e_Protect()', 'E2e_Check()', 'E2e_IsValid()']], ['e2e.c (ẩn)', ['cài đặt E2e_Protect', 'cài đặt E2e_Check', 'không có biến static']], ['Người dùng', ['sensor_app.c: E2e_Protect', 'control_app.c: E2e_Check × 2 luồng']]] },
              video: { t: 'Giải phẫu một module C', d: '2:00', goal: 'Đọc e2e.h/e2e.c theo đúng thứ tự.',
                s: ['Mở e2e.h: include guard và comment mô tả bố cục khung.', 'Các #define và typedef enum.', 'Struct trạng thái do caller giữ.', 'Mở e2e.c: hàm nào public, hàm nào static.', 'Tìm nơi dùng: sensor_app.c và control_app.c.'] },
              pit: [
                ['Khai báo biến trong header không có ⟦extern⟧', 'Mỗi file include sẽ định nghĩa một bản riêng → lỗi liên kết hoặc lỗi khó thấy. Header chỉ chứa khai báo.'],
                ['Bỏ ⟦static⟧ cho hàm phụ', 'Hàm lọt ra phạm vi toàn chương trình, dễ trùng tên với module khác (hai ⟦SendFrame⟧ trong project là ví dụ, cả hai đều ⟦static⟧).'],
              ],
              ex: { task: `Đếm số biến ⟦static⟧ ở phạm vi file trong {{common/dtc/dtc_manager.c}} và giải thích từng biến.`, sol: `5 biến: ⟦s_table⟧ (bảng cấu hình do caller cấp), ⟦s_count⟧ (số DTC), ⟦s_entries⟧ (status + bộ đếm fail của từng DTC), ⟦s_lock⟧ và ⟦s_unlock⟧ (callback khóa cho đa task).` },
              quiz: [
                ['Trong C, cách nào làm một hàm chỉ dùng được trong file .c chứa nó?', ['Khai báo trong header', 'Thêm ⟦static⟧', 'Thêm ⟦extern⟧', 'Đặt tên bắt đầu bằng s_'], 1, '⟦static⟧ ở phạm vi file giới hạn liên kết trong file đó.'],
                ['Vì sao module E2E kiểm được hai luồng khung (0x100 và 0x101) cùng lúc?', ['Vì có hai bản e2e.c', 'Vì trạng thái nằm trong ⟦E2e_RxState_t⟧ do caller giữ, mỗi luồng một biến', 'Vì dùng mutex', 'Vì E2E không cần trạng thái'], 1, '⟦s_e2eSpeed⟧ và ⟦s_e2eAlive⟧ là hai trạng thái độc lập.'],
              ],
              sum: ['.h = công khai, .c = ẩn; ⟦static⟧ là "private" của C.', 'Quy ước tên: ⟦Module_Func⟧, ⟦s_⟧, ⟦k_⟧, ⟦_t⟧.', 'Trạng thái do caller giữ cho phép nhiều instance; trạng thái static chỉ cho một.'],
            },
            {
              id: '2.2.2', t: 'Con trỏ hàm và dependency injection', min: 30, pre: ['2.2.1'],
              concepts: [
                ['Con trỏ hàm', 'Biến chứa địa chỉ của một hàm, gọi được như hàm. Khai báo bằng ⟦typedef bool (*Fn)(…)⟧.'],
                ['Dependency injection', 'Module không tự gọi phần cứng mà nhận "cách làm" từ bên ngoài (qua con trỏ hàm), nên đổi được phần cứng thật bằng đồ giả khi test.'],
                ['Callback', 'Hàm do module gọi ngược lại người dùng khi có sự kiện, ví dụ ⟦rxIndication⟧ khi nhận đủ một message.'],
                ['ctx (context)', 'Con trỏ ⟦void *⟧ được truyền lại vào mọi callback để người dùng biết callback thuộc về đối tượng nào.'],
              ],
              goal: `Bạn hiểu kỹ thuật quan trọng nhất của project: ISO-TP và UDS không biết gì về FDCAN hay FreeRTOS, mọi thứ được "tiêm" vào qua struct chứa con trỏ hàm.`,
              bg: `Muốn test một module mà không cần board, module đó không được gọi thẳng ⟦HAL_FDCAN_AddMessageToTxFifoQ⟧. Thay vào đó nó gọi qua một con trỏ hàm mà người dùng cung cấp. Trên board, con trỏ trỏ tới hàm gửi CAN thật; trong test, trỏ tới hàm giả ghi khung vào mảng.

Trong C++ cùng ý tưởng này được viết bằng interface và hàm ảo ([[13.2.1]]).`,
              th: `⟦IsoTp_Config_t⟧ chứa mọi thứ module cần từ bên ngoài:

| Thành phần | Ai cung cấp trên board | Ai cung cấp trong test |
|---|---|---|
| ⟦sendFrame⟧ | ⟦ControlApp_CanSend⟧ qua ⟦SendFrame⟧ của diag_app | ⟦FakeSend⟧ ghi khung vào mảng |
| ⟦getTimeMs⟧ | ⟦osKernelGetTickCount⟧ | ⟦FakeTime⟧ trả biến ⟦g_now⟧ |
| ⟦rxIndication⟧ | ⟦OnEcuRequest⟧ → gọi UDS server | hàm test lưu message nhận được |
| ⟦txConfirmation⟧ | ⟦OnEcuResponseSent⟧ → chạy reset đang chờ | hàm test ghi kết quả |
| ⟦rxBuffer⟧, ⟦txBuffer⟧ | mảng static 256 byte | mảng 4095 byte |

Clock giả là điểm mạnh: test chỉ cần ⟦g_now += 1000⟧ để kiểm timeout 1000 ms ngay lập tức.`,
              use: `Cùng kỹ thuật xuất hiện ở ⟦Uds_Config_t⟧ ({{common/uds/uds_server.h@typedef struct}}), ⟦DtcMgr_Init⟧ (lock/unlock) và ⟦CanDrv_Init⟧ (⟦rxIndication⟧ gọi từ ISR).`,
              code: [
                { f: 'common/isotp/isotp.h', from: '/** Send one CAN frame (always 8 bytes).', to: '} IsoTp_Config_t;', hl: ['typedef bool (*IsoTp_SendFrameFn)', 'IsoTp_SendFrameFn      sendFrame;'],
                  ex: [['typedef bool (*IsoTp_SendFrameFn)', 'Kiểu con trỏ hàm: nhận ctx, CAN ID, dữ liệu, độ dài; trả false nếu driver bận (module sẽ thử lại).'], ['typedef uint32_t (*IsoTp_GetTimeMsFn)(void);', 'Clock được tiêm vào: không phụ thuộc HAL_GetTick hay FreeRTOS.'], ['void                  *ctx;', 'Con trỏ ngữ cảnh được truyền lại cho mọi callback.']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'tp.txId           = CANID_UDS_RESP_CONTROL;', to: 'IsoTp_Init(&s_ecuLink, &tp);', hl: ['tp.sendFrame      = SendFrame;', 'tp.getTimeMs      = GetTimeMs;'],
                  ex: [['tp.sendFrame      = SendFrame;', 'Trên board: ⟦SendFrame⟧ gọi ⟦ControlApp_CanSend⟧, hàm này khóa mutex TX rồi gọi driver CAN.'], ['tp.rxIndication   = OnEcuRequest;', 'Khi nhận đủ request, ISO-TP gọi lại ⟦OnEcuRequest⟧ để chuyển cho UDS server.']] },
                { f: 'tests/test_isotp.c', from: 'static bool FakeSend(void *ctx', to: 'static uint32_t FakeTime(void)', hl: ['g_sent[g_sentCount].id = canId;'],
                  ex: [['if (g_driverBusy', 'Giả lập driver bận để test nhánh "thử lại ở MainFunction".'], ['g_sent[g_sentCount].id = canId;', 'Thay vì lên bus, khung được ghi vào mảng để test kiểm tra từng byte.']] },
              ],
              explain: `So sánh khối 2 và khối 3: cùng một trường ⟦sendFrame⟧, trên board trỏ vào driver thật, trong test trỏ vào mảng. ⟦isotp.c⟧ không đổi một dòng nào.`,
              run: [
                'Lúc khởi động, ⟦DiagApp_Init⟧ điền ⟦IsoTp_Config_t tp⟧ và gọi ⟦IsoTp_Init⟧.',
                '⟦IsoTp_Init⟧ chép cấu hình vào ⟦link->cfg⟧.',
                'Khi cần gửi, ⟦isotp.c⟧ gọi ⟦link->cfg.sendFrame(link->cfg.ctx, txId, frame, 8)⟧.',
                'Con trỏ dẫn tới ⟦SendFrame⟧ của diag_app → ⟦ControlApp_CanSend⟧ → ⟦CanDrv_Write⟧ → HAL.',
              ],
              fig: { type: 'seq', actors: ['isotp.c', 'cfg.sendFrame', 'diag_app SendFrame', 'ControlApp_CanSend', 'CanDrv_Write'], msgs: [[0, 1, 'gọi qua con trỏ'], [1, 2, 'trỏ tới'], [2, 3, 'ControlApp_CanSend(id, data, 8)'], [3, 3, 'khóa s_txMutex'], [3, 4, 'CanDrv_Write(&frame)'], [4, 3, 'CANDRV_OK'], [3, 0, 'true']] },
              video: { t: 'Một module, hai thế giới: board và test', d: '2:30', goal: 'Thấy rõ dependency injection hoạt động.',
                s: ['Mở IsoTp_Config_t, tô các con trỏ hàm.', 'Mở diag_app.c: điền cấu hình cho board.', 'Mở test_isotp.c: điền cấu hình giả.', 'Chạy test: g_now tăng 1000, timeout xảy ra ngay.', 'Kết luận: phần cứng là một tham số.'] },
              pit: [
                ['Quên khởi tạo một con trỏ hàm', 'Gọi con trỏ NULL làm treo chip (HardFault). Project dùng ⟦memset(&tp, 0, …)⟧ rồi kiểm ⟦!= NULL⟧ với các callback tùy chọn như ⟦txConfirmation⟧.'],
                ['Gọi hàm chậm trong callback chạy ở ngữ cảnh ngắt', '⟦CanDrv_RxIndication_t⟧ được gọi từ ISR: phải ngắn. Control ECU chỉ đưa khung vào queue trong callback này.'],
              ],
              ex: { task: `Trong {{tests/test_uds.c}}, tìm cách test cung cấp clock và hàm reset cho UDS server. Vì sao test S3 timeout không phải chờ 5 giây thật?`, sol: `⟦Uds_Config_t cfg = { k_dids, 2U, FakeTime, FakeReset };⟧. ⟦FakeTime⟧ trả ⟦g_now⟧; test chỉ cần tăng ⟦g_now⟧ thêm 5000 rồi gọi ⟦Uds_MainFunction()⟧.` },
              quiz: [
                ['Lợi ích chính của việc tiêm ⟦getTimeMs⟧ vào ISO-TP là gì?', ['Chạy nhanh hơn trên chip', 'Test được timeout mà không phải chờ thời gian thật', 'Tiết kiệm RAM', 'Bắt buộc theo ISO 15765-2'], 1, 'Clock giả cho phép điều khiển thời gian trong test.'],
                ['Trên Control ECU, ⟦rxIndication⟧ của link ISO-TP phía ECU trỏ tới hàm nào?', ['SendFrame', 'OnEcuRequest', 'GetTimeMs', 'Uds_MainFunction'], 1, '⟦tp.rxIndication = OnEcuRequest;⟧ trong ⟦DiagApp_Init⟧.'],
              ],
              sum: ['Struct cấu hình chứa con trỏ hàm = dependency injection kiểu C.', 'Cùng ⟦isotp.c⟧ chạy với driver thật hoặc driver giả.', 'Clock giả biến test timeout thành tức thời.', 'Callback trong ngữ cảnh ngắt phải thật ngắn.'],
            },
          ],
        },
        {
          id: '2.3', t: 'Bộ nhớ, lỗi và ngắt',
          subs: [
            {
              id: '2.3.1', t: 'Bộ nhớ tĩnh và xử lý lỗi bằng giá trị trả về', min: 20, pre: ['2.2.2'],
              concepts: [
                ['Cấp phát tĩnh', 'Bộ nhớ được định sẵn lúc biên dịch (biến static, mảng cố định), không dùng ⟦malloc⟧ lúc chạy.'],
                ['Buffer do caller cấp', 'Module nhận con trỏ + kích thước buffer từ người dùng thay vì tự cấp phát.'],
                ['Mã lỗi', 'Hàm trả về một ⟦enum⟧ (⟦CANDRV_OK⟧, ⟦ISOTP_ERR_BUSY⟧…) để caller quyết định xử lý.'],
              ],
              goal: `Bạn biết vì sao code nhúng an toàn tránh ⟦malloc⟧, bộ nhớ của project nằm ở đâu, và cách mỗi tầng báo lỗi cho tầng trên.`,
              bg: `Trên MCU, heap nhỏ và có thể bị phân mảnh sau nhiều lần cấp phát/giải phóng; một ⟦malloc⟧ thất bại lúc xe đang chạy là không chấp nhận được. Vì vậy code an toàn chức năng thường cấp phát mọi thứ lúc khởi động hoặc lúc biên dịch.

C không có exception. Lỗi được báo bằng **giá trị trả về** và người gọi phải kiểm tra.`,
              th: `**Bộ nhớ trong project:**
- Module ⟦common/⟧ không bao giờ cấp phát: ISO-TP dùng ⟦rxBuffer⟧/⟦txBuffer⟧ do caller cấp, UDS ghi response vào buffer ⟦resp⟧ + ⟦respMax⟧ do caller cấp, DTC manager giữ mảng cố định ⟦DTC_MAX_ENTRIES⟧ = 16.
- Control ECU dùng heap của FreeRTOS **chỉ lúc init** (queue, mutex, task), và kiểm tra NULL ngay.

**Xử lý lỗi theo tầng:**
- Driver trả ⟦CanDrv_Status_t⟧ (⟦OK⟧, ⟦ERROR⟧, ⟦TX_FULL⟧).
- ISO-TP trả ⟦IsoTp_Result_t⟧ và báo lỗi bất đồng bộ qua callback (timeout, sai SN…).
- UDS chuyển lỗi thành **NRC** gửi cho tester (⟦7F SID NRC⟧).
- Giá trị trả về cố ý bỏ qua được ghi ⟦(void)⟧ để người đọc biết đó là chủ đích (MISRA rule 17.7).`,
              use: `Ví dụ tiêu biểu: ⟦IsoTp_Transmit⟧ kiểm tham số rồi trả lỗi sớm; ⟦ControlApp_Init⟧ kiểm từng đối tượng RTOS vừa tạo.`,
              code: [
                { f: 'common/isotp/isotp.c', from: 'IsoTp_Result_t IsoTp_Transmit(IsoTp_Link_t *link', to: 'return ISOTP_OK;', hl: ['return ISOTP_ERR_PARAM;', 'return ISOTP_ERR_BUSY;', '(void)TxSendFirst(link);'],
                  ex: [['(length > link->cfg.txBufferSize)', 'Không bao giờ ghi quá buffer do caller cấp: kiểm kích thước trước khi ⟦memcpy⟧.'], ['return ISOTP_ERR_BUSY;', 'Một link chỉ gửi một message mỗi lúc; caller phải chờ.'], ['(void)TxSendFirst(link);', 'Cố ý bỏ qua kết quả: nếu driver bận, ⟦IsoTp_MainFunction⟧ sẽ thử lại.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 's_rxQueue   = osMessageQueueNew(RX_QUEUE_LEN', to: 'return false;', hl: ['if ((s_rxQueue == NULL)'],
                  ex: [['osMessageQueueNew(RX_QUEUE_LEN, sizeof(CanDrv_Frame_t), NULL);', 'Queue 32 khung được cấp từ heap FreeRTOS một lần duy nhất lúc khởi động.'], ['if ((s_rxQueue == NULL)', 'Kiểm NULL ngay: thiếu heap thì báo rõ và dừng, thay vì chạy tiếp với con trỏ hỏng.']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: '#define DIAG_BUFFER_SIZE', n: 1,
                  ex: [['#define DIAG_BUFFER_SIZE', 'Kích thước cố định cho buffer RX, TX và response của UDS: 256 byte mỗi cái, khai báo static ngay bên dưới.']] },
              ],
              explain: `Mẫu "kiểm tham số → trả lỗi sớm" (early return) lặp lại ở mọi API. MISRA rule 15.5 khuyên chỉ một điểm return; project chọn deviation D1 vì early return dễ đọc hơn, và ghi lý do trong ⟦docs/misra_deviations.md⟧ ([[14.1.3]]).`,
              run: [
                'UDS server tạo response 13 byte trong ⟦s_respBuf⟧ (static).',
                '⟦IsoTp_Transmit⟧ kiểm 13 ≤ 4095 và 13 ≤ 256, chép vào ⟦txBuffer⟧.',
                'Nếu link đang bận gửi message trước → ⟦ISOTP_ERR_BUSY⟧, diag_app bỏ qua (tester sẽ hết thời gian chờ và gửi lại).',
              ],
              fig: { type: 'flow', nodes: [['Gọi IsoTp_Transmit(link, data, len)', 'start'], ['link/data NULL, len 0, len > 4095 hoặc > buffer?', 'dec'], ['→ ISOTP_ERR_PARAM', 'bad'], ['Đang gửi message khác?', 'dec'], ['→ ISOTP_ERR_BUSY', 'bad'], 'memcpy vào txBuffer, trạng thái SEND_FIRST', ['→ ISOTP_OK (gửi thật diễn ra sau)', 'ok']] },
              video: { t: 'Không malloc: bộ nhớ của ECU nằm ở đâu', d: '1:30', goal: 'Liệt kê các vùng nhớ của project.',
                s: ['Buffer static của diag_app: 3 × 256 byte.', 'Mảng DTC cố định 16 phần tử.', 'Heap FreeRTOS 16 KB, chỉ dùng lúc init.', 'Kiểm NULL sau khi tạo queue/mutex.'] },
              pit: [
                ['Truyền buffer nhỏ hơn kích thước khai báo', 'Module tin vào ⟦rxBufferSize⟧ bạn đưa; khai sai là tràn bộ nhớ. Luôn dùng ⟦sizeof(buf)⟧ như project.'],
                ['Bỏ qua giá trị trả về mà không ghi ⟦(void)⟧', 'Vi phạm MISRA 17.7 và người đọc không biết bạn quên hay cố ý.'],
              ],
              ex: { task: `Trong {{common/uds/uds_server.c}}, tìm hàm ⟦Put⟧. Điều gì xảy ra khi response sắp vượt ⟦respMax⟧?`, sol: `⟦Put⟧ trả ⟦false⟧ và không ghi khi ⟦c->respLen >= c->respMax⟧. Với ReadDID, server kiểm trước và trả NRC ⟦0x14⟧ responseTooLong.` },
              quiz: [
                ['Control ECU dùng heap của FreeRTOS khi nào?', ['Mỗi khung CAN', 'Chỉ lúc khởi tạo queue, mutex, task', 'Mỗi request UDS', 'Không bao giờ'], 1, 'Mọi đối tượng RTOS được tạo trong ⟦ControlApp_Init⟧.'],
                ['⟦(void)TxSendFirst(link);⟧ nghĩa là gì?', ['Hàm không có giá trị trả về', 'Cố ý bỏ qua giá trị trả về', 'Ép kiểu con trỏ', 'Lỗi biên dịch'], 1, 'Ghi rõ chủ đích theo MISRA 17.7.'],
              ],
              sum: ['Không ⟦malloc⟧ lúc chạy; buffer do caller cấp hoặc static.', 'Lỗi được trả về bằng enum, tầng UDS đổi thành NRC.', 'Early return là deviation D1 có ghi lý do.'],
            },
            {
              id: '2.3.2', t: 'Ngắt, volatile và chia sẻ dữ liệu giữa ISR và chương trình chính', min: 25, pre: ['2.3.1'],
              concepts: [
                ['ISR', 'Interrupt Service Routine: hàm chạy khi phần cứng báo sự kiện (timer tràn, có khung CAN), cắt ngang chương trình chính.'],
                ['volatile', 'Báo trình biên dịch rằng biến có thể đổi ngoài luồng chương trình (bởi ISR), nên mỗi lần dùng phải đọc lại từ bộ nhớ.'],
                ['Ring buffer', 'Mảng vòng với chỉ số head (ISR ghi) và tail (main đọc), chuyển dữ liệu an toàn giữa hai ngữ cảnh mà không cần khóa.'],
              ],
              goal: `Bạn hiểu quy tắc vàng "ISR làm ít nhất có thể", và ba cách project chuyển dữ liệu ra khỏi ISR: cờ volatile, ring buffer, queue của RTOS.`,
              bg: `Một ISR cắt ngang code đang chạy ở bất kỳ lệnh nào. Nếu ISR làm việc lâu (printf, tính toán), các ngắt khác bị trễ và hệ thống mất tính thời gian thực. Nếu ISR và main cùng sửa một biến không có bảo vệ, dữ liệu có thể hỏng.`,
              th: `**1. Cờ volatile (Sensor ECU, timer 10 ms):** ISR của TIM6 chỉ đặt ⟦s_tick10ms = true⟧. Vòng ⟦while (1)⟧ thấy cờ, xóa cờ và chạy task. Nếu cờ vẫn còn khi ngắt kế tiếp đến, task trước chưa xong → tăng ⟦s_tickOverruns⟧ (phát hiện quá tải).

**2. Ring buffer (tester trên Sensor ECU):** callback RX của CAN chạy trong ISR, chép khung 0x7E8 vào ⟦s_ring⟧ và tăng ⟦s_head⟧. Main loop đọc ở ⟦s_tail⟧. Chỉ ISR ghi head, chỉ main ghi tail → không cần khóa (một bên ghi, một bên đọc).

**3. Queue của RTOS (Control ECU):** ISR gọi ⟦osMessageQueuePut(…, timeout 0)⟧. Task ComRx chờ trên queue. FreeRTOS lo đồng bộ.

⟦volatile⟧ **không** làm phép toán thành nguyên tử: nó chỉ ngăn trình biên dịch giữ giá trị cũ trong thanh ghi.`,
              use: `Các biến ⟦volatile⟧ trong project: ⟦s_tick10ms⟧ (main.c Sensor), ⟦s_rxSpeedFrames⟧ (sensor_app), ⟦s_head⟧/⟦s_tail⟧ (tester_app), ⟦s_stats⟧ và ⟦s_busOffPending⟧ (can_drv), ⟦s_rxQueueOverflow⟧ (control_app).`,
              code: [
                { f: 'sensor_ecu/Core/Src/main.c', from: 'static volatile bool s_tick10ms = false;', n: 2, hl: ['static volatile bool s_tick10ms'],
                  ex: [['static volatile bool s_tick10ms', '⟦volatile⟧: main loop phải đọc lại cờ mỗi vòng, nếu không trình biên dịch có thể tối ưu thành vòng lặp vô hạn.']] },
                { f: 'sensor_ecu/Core/Src/main.c', from: 'void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim)', to: '/* printf() -> USART2', hl: ['s_tick10ms = true;'],
                  ex: [['s_tickOverruns++;', 'Cờ chưa được xóa nghĩa là task 10 ms trước chưa chạy xong: ghi nhận quá tải.'], ['s_tick10ms = true;', 'Toàn bộ việc ISR làm: đặt một cờ.']] },
                { f: 'sensor_ecu/Core/Src/main.c', from: 'while (1)', to: 'TesterApp_Task();', hl: ['SensorApp_Task10ms();'],
                  ex: [['s_tick10ms = false;', 'Xóa cờ trước khi chạy task, để ngắt kế tiếp có thể đặt lại.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'static void OnCanRx(const CanDrv_Frame_t *frame)', n: 7,
                  ex: [['osMessageQueuePut(s_rxQueue, frame, 0U, 0U)', 'Timeout 0: trong ISR không được chờ. Queue đầy thì bỏ khung và đếm overflow.']] },
              ],
              explain: `Ba khối đầu cho thấy toàn bộ "hệ điều hành" của Sensor ECU: một timer, một cờ, một vòng lặp. Đơn giản nhưng phát hiện được quá tải. Khối cuối là phiên bản có RTOS của cùng nguyên tắc.`,
              run: [
                'TIM6 tràn mỗi 10 ms → CPU nhảy vào ⟦HAL_TIM_PeriodElapsedCallback⟧.',
                'ISR đặt ⟦s_tick10ms = true⟧ và thoát ngay.',
                'Vòng ⟦while (1)⟧ đọc cờ (thật sự đọc RAM nhờ ⟦volatile⟧), thấy true.',
                'Xóa cờ, gọi ⟦SensorApp_Task10ms()⟧ rồi ⟦TesterApp_Task()⟧.',
                'Quay lại chờ cờ.',
              ],
              fig: { type: 'seq', actors: ['TIM6', 'ISR', 's_tick10ms', 'while(1)', 'SensorApp_Task10ms'], msgs: [[0, 1, 'ngắt mỗi 10 ms'], [1, 2, '= true'], [3, 2, 'đọc: true'], [3, 2, '= false'], [3, 4, 'chạy task'], [4, 3, 'xong trước ngắt kế tiếp']] },
              video: { t: 'ISR ngắn, công việc ở vòng chính', d: '1:30', goal: 'Hình dung timeline ngắt và task.',
                s: ['Trục thời gian 10 ms, các xung ngắt TIM6.', 'ISR là một vạch rất mảnh: chỉ đặt cờ.', 'Task chạy trong main loop, kết thúc trước xung kế tiếp.', 'Trường hợp task quá dài: s_tickOverruns tăng.'] },
              pit: [
                ['Gọi ⟦printf⟧ trong ISR', '⟦printf⟧ ở đây gửi từng ký tự qua UART và chờ: ISR kéo dài hàng ms. Project chỉ in log trong main loop/task.'],
                ['Nghĩ ⟦volatile⟧ thay được mutex', '⟦volatile⟧ không bảo vệ thao tác đọc-sửa-ghi. Ring buffer an toàn vì mỗi chỉ số chỉ có một bên ghi.'],
              ],
              ex: { task: `Trong {{sensor_ecu/Core/App/tester_app.c}}, tìm ⟦TesterApp_OnCanFrameIsr⟧. Khi nào ring buffer bị coi là đầy?`, sol: `Khi ⟦next = (s_head + 1) % RING_LEN⟧ bằng ⟦s_tail⟧. Ring buffer kiểu này luôn để trống một ô để phân biệt đầy với rỗng, nên chứa tối đa 31 khung.` },
              quiz: [
                ['ISR của TIM6 trên Sensor ECU làm gì?', ['Đọc ADC và gửi CAN', 'Chỉ đặt cờ s_tick10ms (và đếm overrun)', 'In log', 'Chạy tester'], 1, 'Mọi công việc thật chạy trong main loop.'],
                ['Vì sao ring buffer của tester không cần khóa?', ['Vì dùng volatile', 'Vì chỉ ISR ghi head và chỉ main ghi tail', 'Vì có mutex ẩn', 'Vì chỉ chạy một lần'], 1, 'Mô hình một bên sản xuất, một bên tiêu thụ, mỗi chỉ số một chủ.'],
              ],
              sum: ['ISR làm ít nhất có thể: đặt cờ, chép dữ liệu, thoát.', '⟦volatile⟧ buộc đọc lại bộ nhớ, nhưng không nguyên tử.', 'Ba kênh ra khỏi ISR: cờ, ring buffer, queue RTOS.'],
            },
          ],
        },
      ],
    },
  ],
};
