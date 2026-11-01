// Intermediate, chapters 4-5: MCAL drivers and the Sensor ECU application.
module.exports = {
  level: { id: 'intermediate', t: 'Từng thành phần', d: 'Driver, ứng dụng Sensor ECU, E2E, FreeRTOS, ISO-TP, UDS và DTC: đọc và tự viết lại từng module.' },
  chapters: [
    {
      id: 'c04', t: 'Lớp driver MCAL',
      lessons: [
        {
          id: '4.1', t: 'Driver chạm vào phần cứng',
          subs: [
            {
              id: '4.1.1', t: 'Quy tắc phân lớp: chỉ MCAL được gọi HAL', min: 15, pre: ['1.1.3', '2.2.2'],
              concepts: [
                ['HAL', 'Hardware Abstraction Layer của ST: hàm C như ⟦HAL_FDCAN_Start⟧ để điều khiển ngoại vi.'],
                ['MCAL', 'Lớp driver mỏng của project bọc HAL lại thành API riêng (⟦CanDrv_…⟧, ⟦AdcDrv_…⟧).'],
                ['Phụ thuộc một chiều', 'Tầng trên được gọi tầng dưới, không bao giờ ngược lại.'],
              ],
              goal: `Bạn giải thích được vì sao project thêm một lớp driver riêng thay vì gọi HAL trực tiếp, và kiểm tra được quy tắc này bằng cách nhìn ⟦#include⟧.`,
              bg: `HAL của ST khác nhau giữa các dòng chip: cùng là FDCAN nhưng G4 và MP1 mã hóa DLC khác nhau. Nếu code ứng dụng gọi HAL trực tiếp, mỗi khác biệt đó lan ra khắp nơi. Lớp MCAL gom mọi khác biệt về một chỗ.`,
              th: `Quy tắc của project (yêu cầu R7 trong báo cáo): **chỉ file trong ⟦Core/Mcal/⟧ được include ⟦main.h⟧ (kéo theo HAL)**.

- Ứng dụng (⟦sensor_app⟧, ⟦control_app⟧) chỉ thấy ⟦CanDrv_Frame_t⟧, ⟦CanDrv_Write⟧…
- Hai ECU có hai ⟦can_drv.c⟧ khác nhau bên trong nhưng **API gần như giống nhau** (Control có thêm tham số filter).
- MISRA deviation D4 (ép kiểu địa chỉ ngoại vi kiểu ⟦GPIOA⟧, ⟦RCC⟧) chỉ được phép trong ⟦*/Core/Mcal/*⟧.

Đây chính là ý tưởng lớp MCAL của AUTOSAR ([[11.1.1]]).`,
              use: `Mở tab "Bản đồ hệ thống" của website: đồ thị include được trích tự động cho thấy không có mũi tên nào từ ⟦common/⟧ sang MCAL, và chỉ MCAL include ⟦main.h⟧.`,
              code: [
                { f: 'sensor_ecu/Core/Mcal/can_drv.c', from: '#include "can_drv.h"', to: 'extern FDCAN_HandleTypeDef hfdcan1;', hl: ['#include "main.h"', 'extern FDCAN_HandleTypeDef hfdcan1;'],
                  ex: [['#include "main.h"', 'Chỉ MCAL include ⟦main.h⟧, và qua nó là toàn bộ HAL.'], ['extern FDCAN_HandleTypeDef hfdcan1;', 'Handle do CubeMX tạo trong ⟦main.c⟧; driver mượn lại chứ không tự tạo.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: '#include "control_app.h"', to: '#include "io_drv.h"', hl: ['#include "can_drv.h"'],
                  ex: [['#include "cmsis_os.h"', 'Ứng dụng dùng API của RTOS…'], ['#include "can_drv.h"', '…và API của MCAL, nhưng không có ⟦main.h⟧ hay ⟦stm32mp1xx_hal.h⟧.']] },
                { f: 'tools/misra_suppressions.txt', from: '// D4 - Rule 11.4', n: 3, hl: ['misra-c2012-11.4:*/Core/Mcal/*'],
                  ex: [['misra-c2012-11.4:*/Core/Mcal/*', 'Ngoại lệ MISRA về truy cập thanh ghi chỉ áp dụng cho thư mục MCAL: công cụ sẽ báo lỗi nếu ứng dụng làm điều này.']] },
              ],
              explain: `Quy tắc phân lớp ở đây được **cưỡng chế bằng công cụ** (cppcheck với suppression theo đường dẫn), không chỉ bằng lời dặn.`,
              run: [
                '⟦control_app.c⟧ gọi ⟦CanDrv_Write(&frame)⟧.',
                '⟦can_drv.c⟧ (MCAL) chuyển sang ⟦FDCAN_TxHeaderTypeDef⟧ và gọi HAL.',
                'HAL ghi vào thanh ghi FDCAN của chip.',
              ],
              fig: { type: 'layers', rows: [['Ứng dụng', ['sensor_app', 'control_app', 'diag_app', 'tester_app']], ['common/', ['e2e', 'isotp', 'uds_server', 'dtc_manager', 'can_matrix.h']], ['MCAL', ['can_drv', 'adc_drv', 'gpio_drv', 'uart_drv', 'time_drv', 'io_drv', 'sys_drv']], ['HAL + CMSIS', ['stm32g4xx_hal', 'stm32mp1xx_hal', 'thanh ghi']]] },
              video: { t: 'Ai được chạm vào phần cứng?', d: '1:15', goal: 'Kiểm quy tắc phân lớp bằng #include.',
                s: ['Grep "main.h" trong Core/App và Core/Mcal.', 'Chỉ Mcal có kết quả (cùng main.c do CubeMX tạo).', 'Mở misra_suppressions.txt: D4 giới hạn theo đường dẫn.', 'Mở bản đồ include của website.'] },
              pit: [
                ['Gọi ⟦HAL_GPIO_ReadPin⟧ trong ⟦control_app.c⟧ "cho nhanh"', 'Phá phân lớp, cppcheck sẽ báo vì rule 11.4 không được miễn ngoài MCAL. Thêm hàm vào ⟦io_drv⟧.'],
                ['Đưa logic ứng dụng xuống driver', 'Driver chỉ nên chuyển đổi và báo lỗi; quyết định (ví dụ "lỗi thì PWM 0") thuộc ứng dụng.'],
              ],
              ex: { task: `Mở tab "Mã nguồn" của website, chọn ⟦control_ecu/CM4/Core/App/control_app.c⟧. Panel bên phải liệt kê file nó include: có file nào của HAL không?`, sol: `Không. Danh sách gồm ⟦control_app.h⟧, ⟦can_drv.h⟧, ⟦can_matrix.h⟧, ⟦diag_app.h⟧, ⟦dtc_manager.h⟧, ⟦e2e.h⟧, ⟦io_drv.h⟧; phần "ngoài project" chỉ có thư viện chuẩn và RTOS (⟦cmsis_os.h⟧, ⟦FreeRTOS.h⟧).` },
              quiz: [
                ['File nào được phép include ⟦main.h⟧ theo quy tắc của project?', ['control_app.c', 'isotp.c', 'can_drv.c', 'uds_server.c'], 2, 'Chỉ các file MCAL (và main.c của CubeMX).'],
                ['Lợi ích của MCAL khi có hai dòng chip G4 và MP1?', ['Không có lợi ích', 'Khác biệt HAL (ví dụ mã hóa DLC) nằm gọn trong driver, ứng dụng không đổi', 'Tăng tốc CAN', 'Giảm RAM'], 1, 'Xem [[4.1.3]] về DLC trên MP1.'],
              ],
              sum: ['Chỉ ⟦Core/Mcal/⟧ gọi HAL.', 'MCAL che khác biệt giữa các dòng chip.', 'Quy tắc được cưỡng chế bằng cppcheck.'],
            },
            {
              id: '4.1.2', t: 'can_drv của Sensor ECU: filter, gửi, ngắt nhận, thống kê', min: 30, pre: ['4.1.1', '3.1.4'],
              concepts: [
                ['Acceptance filter', 'Bộ lọc phần cứng quyết định khung nào được vào RX FIFO; khung bị lọc không làm CPU bận.'],
                ['TX FIFO', 'Hàng đợi gửi 3 ô trong FDCAN. Đầy thì khung mới bị từ chối.'],
                ['RX FIFO0', 'Hàng đợi nhận; ngắt báo có khung mới, ISR rút hết các khung trong đó.'],
                ['_Static_assert', 'Kiểm tra lúc biên dịch: nếu điều kiện sai, build lỗi ngay.'],
              ],
              goal: `Bạn đọc hiểu trọn một driver CAN thật: khởi động, lọc, gửi không chặn, nhận trong ngắt, phục hồi bus-off và thống kê.`,
              bg: `FDCAN tự làm phần lớn việc (đóng khung, CRC, ACK, phân xử, gửi lại). Driver chỉ cần cấu hình, đưa khung vào FIFO và lấy khung ra. Điều quan trọng là **không bao giờ chờ** trong driver: một hàm gửi bị chặn sẽ làm trễ cả chu kỳ 10 ms.`,
              th: `**Khởi động (⟦CanDrv_Init⟧):** nếu chọn loopback thì đổi mode → cấu hình filter → bật ngắt (RX FIFO0 có khung mới, bus-off) → ⟦HAL_FDCAN_Start⟧.

**Filter:** Sensor nhận mọi ID chuẩn (0x000–0x7FF) vào FIFO0, và từ chối khung không khớp, khung remote, ID mở rộng ngay trong phần cứng.

**Gửi (⟦CanDrv_Write⟧):** kiểm tham số → nếu TX FIFO đầy thì tăng ⟦txDropped⟧ và trả ⟦CANDRV_TX_FULL⟧ ngay (không chờ) → điền header → đưa vào FIFO.

**Nhận (ngắt):** ⟦HAL_FDCAN_RxFifo0Callback⟧ chạy trong ISR, dùng vòng ⟦while⟧ rút **hết** FIFO (nhiều khung có thể tới trước khi ISR chạy), mỗi khung gọi ⟦s_rxIndication⟧ của ứng dụng.

**Thống kê:** ⟦txQueued⟧, ⟦txDropped⟧, ⟦rxCount⟧, ⟦busOffCount⟧ nằm trong một struct ⟦volatile⟧ vì ISR cũng ghi.`,
              use: `Ứng dụng Sensor truyền ⟦OnCanRx⟧ làm callback; callback này đếm khung 0x100 nhận lại (khi loopback) và chuyển khung 0x7E8 cho tester ({{sensor_ecu/Core/App/sensor_app.c@static void OnCanRx}}).`,
              code: [
                { f: 'sensor_ecu/Core/Mcal/can_drv.c', from: '_Static_assert(FDCAN_DLC_BYTES_8 == 8U', n: 1,
                  ex: [['_Static_assert', 'Từ HAL G4 v1.2, hằng DLC bằng đúng số byte. Nếu HAL đổi, build lỗi thay vì gửi sai độ dài lúc chạy.']] },
                { f: 'sensor_ecu/Core/Mcal/can_drv.c', from: 'static CanDrv_Status_t ConfigureFilters(void)', to: 'return CANDRV_OK;', hl: ['filter.FilterID2    = CANDRV_MAX_STD_ID;', 'FDCAN_REJECT_REMOTE'],
                  ex: [['filter.FilterType   = FDCAN_FILTER_RANGE;', 'Filter kiểu dải: từ FilterID1 đến FilterID2.'], ['filter.FilterID2    = CANDRV_MAX_STD_ID;', 'Sensor nhận mọi ID chuẩn: cần thấy 0x7E8 cho tester, và 0x100 của chính nó trong loopback.'], ['FDCAN_REJECT_REMOTE', 'Khung không khớp, remote và ID mở rộng bị loại trong phần cứng.']] },
                { f: 'sensor_ecu/Core/Mcal/can_drv.c', from: 'if (HAL_FDCAN_GetTxFifoFreeLevel(&hfdcan1) == 0U)', n: 4, hl: ['return CANDRV_TX_FULL;'],
                  ex: [['return CANDRV_TX_FULL;', 'Không chờ ô trống: báo lỗi ngay, ứng dụng quyết định (Sensor chỉ đếm và bỏ qua).']] },
                { f: 'sensor_ecu/Core/Mcal/can_drv.c', from: 'void HAL_FDCAN_RxFifo0Callback', to: 'void HAL_FDCAN_ErrorStatusCallback', hl: ['while (HAL_FDCAN_GetRxFifoFillLevel(hfdcan, FDCAN_RX_FIFO0) > 0U)', 's_rxIndication(&frame);'],
                  ex: [['while (HAL_FDCAN_GetRxFifoFillLevel', 'Rút hết FIFO trong một lần ngắt.'], ['frame.dlc = (header.DataLength > CANDRV_MAX_DLC)', 'Phòng thủ: không bao giờ để DLC lớn hơn 8 lọt lên tầng trên.'], ['s_rxIndication(&frame);', 'Gọi callback của ứng dụng, vẫn trong ngữ cảnh ngắt.']] },
              ],
              explain: `Ba quyết định thiết kế đáng học: kiểm tra lúc biên dịch thay vì lúc chạy (⟦_Static_assert⟧), không chặn khi gửi, và rút hết FIFO trong ISR.`,
              run: [
                'Khung tới, FDCAN đặt vào RX FIFO0, phát ngắt.',
                'HAL gọi ⟦HAL_FDCAN_RxFifo0Callback⟧.',
                'Vòng while lấy từng khung, chuyển sang ⟦CanDrv_Frame_t⟧, tăng ⟦rxCount⟧.',
                'Gọi ⟦OnCanRx⟧ của sensor_app → ⟦TesterApp_OnCanFrameIsr⟧ nếu là 0x7E8.',
                'FIFO rỗng → thoát ngắt.',
              ],
              fig: { type: 'seq', actors: ['Bus', 'FDCAN', 'HAL ISR', 'can_drv callback', 'sensor_app OnCanRx', 'tester ring'], msgs: [[0, 1, 'khung 0x7E8'], [1, 1, 'lọc → RX FIFO0'], [1, 2, 'ngắt FIFO0 new msg'], [2, 3, 'HAL_FDCAN_RxFifo0Callback'], [3, 3, 'while FIFO > 0: GetRxMessage'], [3, 4, 's_rxIndication(&frame)'], [4, 5, 'TesterApp_OnCanFrameIsr']] },
              video: { t: 'Đọc một driver CAN trong 3 phút', d: '3:00', goal: 'Đi qua 4 hàm chính.',
                s: ['CanDrv_Init: thứ tự mode → filter → ngắt → start.', 'ConfigureFilters: dải 0x000–0x7FF, từ chối phần còn lại.', 'CanDrv_Write: kiểm FIFO, không chờ.', 'RxFifo0Callback: vòng while rút FIFO.', 'Bus-off: cờ + MainFunction.'] },
              pit: [
                ['Chỉ đọc một khung mỗi lần ngắt', 'Nếu hai khung đến sát nhau, khung thứ hai nằm lại FIFO đến ngắt sau hoặc bị tràn. Rút bằng vòng while.'],
                ['Chờ trong ⟦CanDrv_Write⟧ cho đến khi FIFO trống', 'Khi bus-off, FIFO không bao giờ trống: task treo vĩnh viễn.'],
              ],
              ex: { task: `Sensor ECU gửi 110 khung/s. Trong log ⟦[SENSOR]⟧ có ⟦tx=⟧ và ⟦drop=⟧. Nếu rút dây CAN (không ai ACK), bạn đoán hai số này thay đổi thế nào?`, sol: `FDCAN gửi lại liên tục khung đầu tiên (AutoRetransmission) nên 3 ô TX FIFO đầy rất nhanh; ⟦drop⟧ tăng khoảng 110/s và ⟦tx⟧ đứng yên.` },
              quiz: [
                ['Vì sao ISR nhận dùng vòng ⟦while⟧ thay vì đọc một khung?', ['Để chậm hơn', 'Vì nhiều khung có thể đã vào FIFO trước khi ISR chạy', 'Bắt buộc của HAL', 'Để đếm lỗi'], 1, 'Rút hết FIFO trong một lần ngắt.'],
                ['⟦CanDrv_Write⟧ làm gì khi TX FIFO đầy?', ['Chờ đến khi có ô trống', 'Tăng txDropped và trả CANDRV_TX_FULL ngay', 'Reset FDCAN', 'Ghi đè khung cũ'], 1, 'Driver không bao giờ chặn.'],
              ],
              sum: ['Filter phần cứng loại khung thừa trước khi tới CPU.', 'Gửi không chặn; FIFO đầy → báo lỗi.', 'ISR nhận rút hết FIFO và gọi callback.', 'Kiểm giả định của HAL bằng ⟦_Static_assert⟧.'],
            },
            {
              id: '4.1.3', t: 'can_drv của Control ECU: filter theo dải, DLC trên MP1, không ép bỏ const', min: 20, pre: ['4.1.2'],
              concepts: [
                ['Mã hóa DLC trên MP1', 'HAL của MP1 (giống H7) đặt DLC ở bit 19:16 của header, khác G4 nơi DLC = số byte.'],
                ['Filter theo bảng', 'Ứng dụng truyền một mảng dải ID cho driver thay vì driver tự quyết.'],
                ['MISRA 11.8', 'Không được ép bỏ ⟦const⟧ khỏi con trỏ.'],
              ],
              goal: `Bạn thấy cùng một API ⟦CanDrv_…⟧ được cài đặt khác nhau cho chip khác, và học hai kỹ thuật: dịch DLC an toàn và tránh ép bỏ ⟦const⟧.`,
              bg: `Control ECU cần lọc chặt hơn Sensor: chỉ khung cảm biến và khung chẩn đoán. Và HAL của MP1 có một khác biệt nhỏ nhưng nguy hiểm: giá trị DLC phải được dịch 16 bit.`,
              th: `- ⟦CanDrv_Init⟧ nhận thêm ⟦filters⟧ và ⟦filterCount⟧ từ ứng dụng; driver cấu hình từng dải, tối đa 2 (khớp ⟦StdFiltersNbr⟧ của CubeMX).
- DLC: ⟦header.DataLength = (uint32_t)frame->dlc << DLC_SHIFT⟧, kèm ⟦_Static_assert(FDCAN_DLC_BYTES_8 == (8UL << DLC_SHIFT))⟧.
- HAL MP1 nhận con trỏ dữ liệu không-const; driver **chép** sang mảng cục bộ thay vì ép bỏ ⟦const⟧ (MISRA 11.8).
- Thống kê có thêm ⟦kernelClockHz⟧ để log biết clock thật đang dùng.`,
              use: `Ứng dụng định nghĩa hai dải trong ⟦k_filters⟧ ([[3.2.1]]). Phần chỉnh kernel clock của driver này là một câu chuyện bring-up riêng ([[15.1.2]]).`,
              code: [
                { f: 'control_ecu/CM4/Core/Mcal/can_drv.c', from: '/* On MP1 (and H7) the HAL encodes the DLC', n: 4, hl: ['_Static_assert(FDCAN_DLC_BYTES_8 == (8UL << DLC_SHIFT)'],
                  ex: [['#define DLC_SHIFT', 'DLC nằm ở bit 19:16 trên MP1.'], ['_Static_assert(FDCAN_DLC_BYTES_8 == (8UL << DLC_SHIFT)', 'Ghi giả định thành kiểm tra lúc biên dịch.']] },
                { f: 'control_ecu/CM4/Core/Mcal/can_drv.c', from: '/* The MP1 HAL takes a non-const data pointer', to: 'header.DataLength          = (uint32_t)frame->dlc << DLC_SHIFT;', hl: ['payload[i] = frame->data[i];', 'header.DataLength          = (uint32_t)frame->dlc << DLC_SHIFT;'],
                  ex: [['payload[i] = frame->data[i];', 'Chép tối đa 8 byte sang mảng cục bộ: rẻ hơn rất nhiều so với rủi ro ép bỏ const.'], ['header.DataLength          = (uint32_t)frame->dlc << DLC_SHIFT;', 'Dịch DLC vào đúng vị trí bit mà HAL MP1 mong đợi.']] },
                { f: 'control_ecu/CM4/Core/Mcal/can_drv.c', from: 'for (uint8_t i = 0U; i < count; i++)', to: 'return CANDRV_OK;', hl: ['f.FilterID1    = filters[i].firstId;'],
                  ex: [['f.FilterID1    = filters[i].firstId;', 'Dải ID đến từ bảng của ứng dụng.'], ['/* Everything else is dropped in hardware. */', 'Khung ngoài các dải không bao giờ tới CPU.']] },
              ],
              explain: `Hai ⟦can_drv.c⟧ có cùng tên hàm và gần cùng chữ ký. Đó là "interface" của MCAL, dù C không có từ khóa interface.`,
              run: [
                '⟦ControlApp_Init⟧ gọi ⟦CanDrv_Init(mode, OnCanRx, k_filters, 2)⟧.',
                'Driver áp bit timing theo clock thật, đổi mode nếu loopback, cấu hình 2 filter dải.',
                'Khi gửi, ⟦ControlApp_CanSend⟧ (giữ mutex) gọi ⟦CanDrv_Write⟧: chép payload, dịch DLC, đưa vào FIFO.',
              ],
              fig: { type: 'layers', rows: [['API chung', ['CanDrv_Init', 'CanDrv_Write', 'CanDrv_MainFunction', 'CanDrv_GetStats']], ['Sensor (G4)', ['filter 0x000–0x7FF', 'DataLength = dlc', 'không cần chép payload']], ['Control (MP1)', ['filter theo bảng 2 dải', 'DataLength = dlc << 16', 'chép payload (MISRA 11.8)', 'chỉnh kernel clock']]] },
              video: { t: 'Cùng API, khác chip', d: '1:30', goal: 'So sánh hai can_drv.c.',
                s: ['Đặt hai CanDrv_Write cạnh nhau.', 'Tô khác biệt: dòng DataLength.', 'Tô khác biệt: vòng chép payload.', 'Kết luận: ứng dụng không thấy khác biệt nào.'] },
              pit: [
                ['Copy driver G4 sang MP1 không sửa DLC', 'DLC 8 sẽ được hiểu sai, khung gửi đi có độ dài sai. ⟦_Static_assert⟧ ngăn lỗi này ngay lúc build.'],
                ['Thêm filter thứ ba trong ⟦k_filters⟧', 'Driver từ chối vì ⟦MAX_STD_FILTERS = 2⟧ phải khớp CubeMX; phải tăng cả hai.'],
              ],
              ex: { task: `Tính giá trị ⟦header.DataLength⟧ trên MP1 cho khung 8 byte, viết dạng hex.`, sol: `⟦8 << 16 = 0x00080000⟧.` },
              quiz: [
                ['Vì sao driver MP1 chép dữ liệu vào ⟦payload⟧ trước khi gọi HAL?', ['Để nhanh hơn', 'HAL nhận con trỏ không-const; chép tránh ép bỏ const (MISRA 11.8)', 'Để đảo byte', 'Để tính CRC'], 1, 'Comment ngay trên vòng for nói rõ.'],
                ['Control ECU cấu hình bao nhiêu filter dải?', ['1', '2', '8', 'Không có'], 1, '⟦k_filters⟧ có hai dải; driver cho tối đa ⟦MAX_STD_FILTERS = 2⟧.'],
              ],
              sum: ['Cùng API, cài đặt theo chip.', 'MP1: DLC dịch 16 bit, kiểm bằng ⟦_Static_assert⟧.', 'Chép thay vì ép bỏ const.'],
            },
            {
              id: '4.1.4', t: 'adc_drv, io_drv, gpio_drv, uart_drv, time_drv', min: 20, pre: ['4.1.1'],
              concepts: [
                ['Hiệu chuẩn ADC', 'Chạy một lần khi ADC còn tắt để loại sai số offset vài LSB.'],
                ['PWM bằng timer', 'Timer đếm 0..ARR; ngõ ra ở mức cao khi bộ đếm < CCR. Duty = CCR / (ARR+1).'],
                ['Polling UART', 'Đọc cờ RXNE định kỳ thay vì dùng ngắt; đơn giản, đủ cho phím bấm.'],
              ],
              goal: `Bạn đọc nhanh các driver còn lại và nhận ra mỗi cái có một chi tiết phần cứng quan trọng được ghi chú trong code.`,
              bg: `Driver tốt ngắn và có comment ở đúng chỗ khó. Các driver này đều dưới 50 dòng.`,
              th: `| Driver | Việc chính | Chi tiết đáng nhớ |
|---|---|---|
| ⟦adc_drv⟧ (Sensor) | Đọc ADC1 kênh 1 (PA0) | Hiệu chuẩn trước lần start đầu; đọc bằng polling, timeout 1 ms |
| ⟦io_drv⟧ (Control) | PWM TIM1_CH2, đọc USER1 | ARR = 999 → duty 0,1 %/đơn vị, không phụ thuộc clock Linux cấu hình; TIM1 cần MOE |
| ⟦gpio_drv⟧ (Sensor) | LED, nút B1 | Mức tích cực của nút gom vào một hằng |
| ⟦uart_drv⟧ (Sensor) | Đọc phím từ VCP | Xóa cờ overrun, nếu không UART ngừng nhận |
| ⟦time_drv⟧ (Sensor) | Thời gian ms | Bọc ⟦HAL_GetTick⟧ để tester và ISO-TP dùng |
| ⟦sys_drv⟧ (Control) | Restart firmware | Xem [[9.1.5]] |`,
              use: `⟦io_drv⟧ nhận duty từ Monitor task mỗi 10 ms; ⟦adc_drv⟧ được ⟦SampleInput⟧ gọi mỗi 10 ms; ⟦time_drv⟧ là ⟦getTimeMs⟧ của link ISO-TP trên Sensor.`,
              code: [
                { f: 'control_ecu/CM4/Core/Mcal/io_drv.c', from: 'bool IoDrv_Init(void)', to: 'htim1.Instance->CCR2 = clamped;', hl: ['htim1.Instance->ARR = IODRV_PWM_MAX - 1U;', 'uint16_t clamped ='],
                  ex: [['htim1.Instance->ARR = IODRV_PWM_MAX - 1U;', 'ARR = 999: chu kỳ 1000 bước, nên CCR = duty trực tiếp (0..1000).'], ['HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_2)', 'TIM1 là timer nâng cao: hàm này còn bật bit MOE, thiếu nó ngõ ra không xuất.'], ['uint16_t clamped =', 'Kẹp giá trị vào biến cục bộ thay vì sửa tham số (MISRA 17.8).']] },
                { f: 'sensor_ecu/Core/Mcal/adc_drv.c', from: 'AdcDrv_Status_t AdcDrv_Init(void)', to: '(void)HAL_ADC_Stop(&hadc1);', hl: ['HAL_ADCEx_Calibration_Start'],
                  ex: [['HAL_ADCEx_Calibration_Start', 'Phải chạy khi ADC còn tắt, tức là trước lần start đầu tiên.'], ['HAL_ADC_PollForConversion(&hadc1, ADC_POLL_TIMEOUT_MS)', 'Một phép đổi mất vài µs; timeout 1 ms chỉ để không treo nếu phần cứng lỗi.']] },
                { f: 'sensor_ecu/Core/Mcal/uart_drv.c', from: 'bool UartDrv_ReadChar(uint8_t *c)', to: 'return received;', hl: ['__HAL_UART_CLEAR_OREFLAG(&huart2);'],
                  ex: [['__HAL_UART_CLEAR_OREFLAG(&huart2);', 'Gõ nhanh hơn chu kỳ poll 10 ms gây overrun; cờ này chặn mọi ký tự tiếp theo nếu không xóa.']] },
              ],
              explain: `Ghi nhớ mẫu chung: driver trả về trạng thái (⟦AdcDrv_Status_t⟧, ⟦bool⟧) và để ứng dụng quyết định. Ví dụ ⟦SampleInput⟧ giữ giá trị ADC cũ và bật cờ lỗi khi đọc thất bại.`,
              run: [
                'Mỗi 10 ms ⟦SampleInput⟧ gọi ⟦AdcDrv_Read⟧: start, chờ đổi xong, đọc, stop.',
                'Monitor task tính duty rồi gọi ⟦IoDrv_SetPwm(duty)⟧: ghi CCR2.',
                'Timer tự xuất xung PWM, CPU không phải làm gì thêm.',
              ],
              fig: { type: 'bytes', title: 'PWM với ARR = 999', cells: [['CCR2 = 0', '0 %', 'safe state'], ['CCR2 = 400', '40 %', '100,0 km/h'], ['CCR2 = 1000', '100 %', '250,0 km/h']] },
              video: { t: 'PWM 0,1 % mỗi bước', d: '1:00', goal: 'Hiểu ARR và CCR.',
                s: ['Bộ đếm timer chạy 0..999.', 'Ngõ ra cao khi bộ đếm < CCR.', 'CCR = 400 → 40 % thời gian cao.', 'Đổi tốc độ → đổi CCR → LED sáng/tối.'] },
              pit: [
                ['Quên MOE trên TIM1', 'PWM không xuất dù CCR đúng. ⟦HAL_TIM_PWM_Start⟧ bật MOE cho timer nâng cao.'],
                ['Không xóa overrun UART', 'Sau một lần gõ nhanh, UART không nhận thêm ký tự nào.'],
              ],
              ex: { task: `Tốc độ 180,0 km/h. Tính CCR2 mà Control ECU ghi (dùng công thức trong ⟦MonitorTask⟧).`, sol: `⟦duty = speedX10 × 1000 / 2500 = 1800 × 1000 / 2500 = 720⟧ → 72,0 %.` },
              quiz: [
                ['Vì sao ⟦io_drv⟧ đặt ARR = 999 trong code thay vì tin cấu hình CubeMX?', ['Để PWM nhanh hơn', 'Để độ phân giải duty 0,1 % không phụ thuộc clock Linux đã cấu hình', 'Vì CubeMX lỗi', 'Để tiết kiệm điện'], 1, 'Comment trong ⟦IoDrv_Init⟧.'],
                ['⟦AdcDrv_Init⟧ phải chạy hiệu chuẩn khi nào?', ['Sau mỗi lần đọc', 'Khi ADC còn tắt, trước lần start đầu', 'Mỗi giây', 'Không cần'], 1, 'Hiệu chuẩn chỉ chạy được khi ADC disabled.'],
              ],
              sum: ['Mỗi driver ngắn, có comment ở chỗ phần cứng khó.', 'PWM: ARR = 999, duty = CCR.', 'Driver báo trạng thái, ứng dụng quyết định.'],
            },
          ],
        },
      ],
    },
    {
      id: 'c05', t: 'Ứng dụng Sensor ECU',
      lessons: [
        {
          id: '5.1', t: 'sensor_app.c và tester_app.c',
          subs: [
            {
              id: '5.1.1', t: 'Task 10 ms: thứ tự công việc trong một chu kỳ', min: 20, pre: ['2.3.2', '4.1.2'],
              concepts: [
                ['Super-loop', 'Kiến trúc không RTOS: một vòng lặp vô hạn chạy các task theo nhịp timer.'],
                ['Tick', 'Bộ đếm chu kỳ; chia lấy dư để chạy việc chậm hơn (mỗi 100 ms, mỗi 1 s).'],
                ['Prime filter', 'Nạp sẵn bộ lọc bằng một mẫu thật lúc khởi động để khung đầu không báo 0.'],
              ],
              goal: `Bạn liệt kê được từng việc Sensor ECU làm trong mỗi 10 ms và vì sao chúng theo thứ tự đó.`,
              bg: `Sensor ECU không có RTOS: nó dựa vào nhịp 10 ms của TIM6 ([[2.3.2]]). Mọi công việc phải xong trong 10 ms; việc chậm hơn được chạy mỗi N tick.`,
              th: `⟦SensorApp_Task10ms⟧ theo thứ tự:

1. ⟦s_tick++⟧
2. ⟦HandleButton⟧: đọc nút B1, đổi fault mode.
3. ⟦SampleInput⟧: đọc ADC, lọc.
4. ⟦SendSpeedFrame⟧: gửi 0x100 (mỗi tick).
5. Mỗi 10 tick: ⟦SendAliveFrame⟧ (0x101).
6. ⟦CanDrv_MainFunction⟧: phục hồi bus-off nếu cần.
7. ⟦UpdateLed⟧: nháy LED (chậm khi bình thường, nhanh khi đang chèn lỗi).
8. Mỗi 100 tick: ⟦LogStatus⟧ in một dòng.

Nút và ADC được đọc **trước** khi gửi, để khung mang dữ liệu mới nhất của chu kỳ này.`,
              use: `⟦SensorApp_Init⟧ chạy một lần: tắt LED, hiệu chuẩn ADC, nạp sẵn bộ lọc, khởi động CAN. Nếu một bước thất bại, ⟦main⟧ gọi ⟦Error_Handler⟧.`,
              code: [
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: 'void SensorApp_Task10ms(void)', to: 'uint16_t SensorApp_GetSpeedX10(void)', hl: ['SendSpeedFrame();', 'if ((s_tick % ALIVE_PERIOD_TICKS) == 0U)'],
                  ex: [['HandleButton();', 'Nút trước: nếu vừa đổi mode, khung gửi ngay chu kỳ này đã mang mode mới.'], ['if ((s_tick % ALIVE_PERIOD_TICKS) == 0U)', '⟦ALIVE_PERIOD_TICKS = 100 ms / 10 ms = 10⟧.'], ['CanDrv_MainFunction();', 'Hàm định kỳ của driver: đếm thời gian chờ phục hồi bus-off.'], ['if ((s_tick % LOG_PERIOD_TICKS) == 0U)', 'Log mỗi 100 tick = 1 giây; ⟦printf⟧ chậm nên không in mỗi chu kỳ.']] },
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: 'bool SensorApp_Init(void)', to: 'return true;', hl: ['FilterReset(first);'],
                  ex: [['FilterReset(first);', 'Lấp đầy cửa sổ lọc bằng mẫu thật, tránh 80 ms đầu báo tốc độ thấp sai.'], ['if (CanDrv_Init(mode, OnCanRx) != CANDRV_OK)', 'Khởi động CAN sau cùng, khi dữ liệu đã sẵn sàng để gửi.']] },
              ],
              explain: `Đây là một "lịch" tĩnh: mọi thứ chạy theo thứ tự cố định, dễ đoán thời gian. Với ECU đơn giản, cách này thường an toàn hơn RTOS.`,
              run: ['TIM6 đặt cờ, main loop gọi ⟦SensorApp_Task10ms⟧.', 'Đọc nút, đọc ADC, lọc.', 'Đóng gói 0x100, bảo vệ E2E, đưa vào TX FIFO.', 'Mỗi 100 ms gửi thêm 0x101; mỗi 1 s in log.', 'Trả về; main loop gọi tiếp ⟦TesterApp_Task⟧.'],
              fig: { type: 'flow', nodes: [['Ngắt TIM6 → cờ 10 ms', 'start'], 'HandleButton: debounce B1, đổi fault mode', 'SampleInput: ADC → trung bình trượt 8 mẫu', 'SendSpeedFrame: 0x100 + E2E', ['tick % 10 == 0 → SendAliveFrame 0x101', 'dec'], 'CanDrv_MainFunction: bus-off recovery', 'UpdateLed', ['tick % 100 == 0 → LogStatus', 'dec'], ['TesterApp_Task', 'end']] },
              video: { t: 'Một chu kỳ 10 ms của Sensor ECU', d: '1:30', goal: 'Đi theo thứ tự hàm.',
                s: ['Trục 10 ms, khối "task".', 'Phóng to: 8 bước theo thứ tự.', 'Đánh dấu các bước chạy mỗi 10 và mỗi 100 tick.', 'So với log: tx tăng 110 khung mỗi giây.'] },
              pit: [
                ['Đặt ⟦LogStatus⟧ chạy mỗi tick', '⟦printf⟧ qua UART 115200 mất vài ms cho một dòng dài: vượt 10 ms, ⟦s_tickOverruns⟧ tăng.'],
                ['Gửi trước khi đọc ADC', 'Khung mang giá trị của chu kỳ trước, trễ thêm 10 ms.'],
              ],
              ex: { task: `Mỗi giây Sensor gửi bao nhiêu khung? Kiểm bằng dòng log mẫu trong README (⟦tx=⟧).`, sol: `100 khung 0x100 + 10 khung 0x101 = 110 khung/s, khớp "TX rate 110 frames/s" của M1.` },
              quiz: [
                ['Khung 0x101 được gửi bao lâu một lần?', ['10 ms', '100 ms', '1 s', 'Khi có lỗi'], 1, '⟦ALIVE_PERIOD_TICKS⟧ = 10 tick × 10 ms.'],
                ['Vì sao ⟦HandleButton⟧ chạy trước ⟦SendSpeedFrame⟧?', ['Ngẫu nhiên', 'Để khung của chu kỳ này mang mode vừa đổi', 'Vì nút chậm', 'Để tiết kiệm năng lượng'], 1, 'Dữ liệu mới nhất trước khi gửi.'],
              ],
              sum: ['Super-loop 10 ms, thứ tự cố định.', 'Việc chậm chạy theo ⟦tick % N⟧.', 'Đọc vào trước, gửi ra sau.'],
            },
            {
              id: '5.1.2', t: 'Bộ lọc trung bình trượt 8 mẫu', min: 20, pre: ['5.1.1'],
              concepts: [
                ['Trung bình trượt', 'Giá trị ra = trung bình N mẫu gần nhất. Giảm nhiễu, đổi lại một độ trễ.'],
                ['Tổng chạy', 'Giữ tổng của cửa sổ; mỗi mẫu mới chỉ cộng mẫu mới, trừ mẫu cũ nhất: O(1) mỗi lần.'],
                ['Lũy thừa của 2', 'N = 8 cho phép chia bằng dịch phải 3 bit và quay vòng chỉ số bằng ⟦& 7⟧.'],
              ],
              goal: `Bạn hiểu thuật toán lọc được dùng thật trong project: cách cài O(1), độ trễ, và vì sao chọn N = 8.`,
              bg: `ADC đọc biến trở có nhiễu vài LSB, cộng với rung khi tay chạm breadboard. Lọc thông thấp đơn giản nhất là lấy trung bình vài mẫu gần nhất.`,
              th: `**Bài toán:** từ chuỗi mẫu ADC (mỗi 10 ms) tạo giá trị ổn định.

**Cài đặt O(1):** mảng vòng 8 phần tử + tổng chạy.
~~~c
sum = sum - buf[idx] + sample;   /* bỏ mẫu cũ nhất, thêm mẫu mới */
buf[idx] = sample;
idx = (idx + 1) & 7;            /* quay vòng 0..7 */
out = sum >> 3;                 /* chia 8 */
~~~

**Phân tích:** thời gian O(1) mỗi mẫu (không phụ thuộc N), bộ nhớ O(N) = 8 × 2 byte + tổng 4 byte. Cửa sổ 8 × 10 ms = 80 ms, độ trễ trung bình khoảng 40 ms. Tổng lớn nhất 8 × 4095 = 32 760, vừa trong ⟦uint32_t⟧ (thậm chí vừa ⟦uint16_t⟧).

**Hạn chế:** đáp ứng chậm với thay đổi đột ngột; N phải là lũy thừa của 2 để giữ phép dịch và mask. Thay thế có thể là lọc IIR một cực (⟦y += (x − y) >> k⟧), chỉ cần 1 biến.`,
              use: `⟦SampleInput⟧ gọi ⟦FilterUpdate⟧ mỗi 10 ms; kết quả đi vào ⟦AdcToSpeedX10⟧ để đổi thành 0..2500.`,
              code: [
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: 'static void FilterReset(uint16_t sample)', to: 'return (uint16_t)(s_filterSum >> FILTER_SHIFT);', hl: ['s_filterSum -= s_filterBuf[s_filterIdx];', 's_filterIdx = (uint8_t)((s_filterIdx + 1U) & (FILTER_SIZE - 1U));'],
                  ex: [['s_filterSum = (uint32_t)sample * FILTER_SIZE;', 'Khởi tạo: cả 8 ô bằng mẫu đầu, tổng = 8 × mẫu.'], ['s_filterSum -= s_filterBuf[s_filterIdx];', 'Trừ mẫu cũ nhất (ô sắp bị ghi đè).'], ['& (FILTER_SIZE - 1U)', 'Quay vòng bằng mask, chỉ đúng vì 8 là lũy thừa của 2.'], ['s_filterSum >> FILTER_SHIFT', 'Chia 8 bằng dịch phải 3 bit.']] },
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: 'static uint16_t AdcToSpeedX10(uint16_t adc)', to: '/ ADCDRV_MAX_VALUE);', hl: ['+ (ADCDRV_MAX_VALUE / 2U)'],
                  ex: [['+ (ADCDRV_MAX_VALUE / 2U)', 'Cộng nửa mẫu số trước khi chia để làm tròn thay vì cắt bớt.']] },
              ],
              explain: `Bạn chạy tay được: mẫu ổn định 2000 rồi nhảy lên 2800 → đầu ra tăng 100 mỗi chu kỳ (800/8), sau 8 chu kỳ đạt 2800.`,
              run: ['Mẫu mới ⟦raw⟧ từ ADC.', 'Trừ ⟦buf[idx]⟧ khỏi tổng, cộng ⟦raw⟧.', 'Ghi ⟦raw⟧ vào ⟦buf[idx]⟧, tăng ⟦idx⟧ vòng.', 'Trả ⟦sum >> 3⟧ → ⟦AdcToSpeedX10⟧ → 0..2500.'],
              fig: { type: 'bytes', title: 'Ví dụ: ổn định 2000, rồi nhảy lên 2800', cells: [['t0', '2000', 'tổng 16000'], ['t1', '2100', 'một mẫu 2800'], ['t2', '2200', ''], ['t4', '2400', ''], ['t8', '2800', 'đã theo kịp sau 80 ms']] },
              video: { t: 'Trung bình trượt O(1)', d: '1:30', goal: 'Thấy tổng chạy hoạt động.',
                s: ['Cửa sổ 8 ô và tổng.', 'Mẫu mới vào: ô cũ ra, tổng cập nhật.', 'So với cách cộng lại 8 phần tử mỗi lần.', 'Độ trễ 40 ms trên đồ thị bậc thang.'] },
              pit: [
                ['Không khởi tạo bộ lọc', 'Tổng bắt đầu từ 0, 80 ms đầu báo tốc độ thấp hơn thực tế. ⟦FilterReset⟧ giải quyết.'],
                ['Đổi ⟦FILTER_SIZE⟧ thành 10', 'Mask ⟦& 9⟧ và dịch 3 bit không còn đúng; phải dùng ⟦%⟧ và phép chia, hoặc giữ lũy thừa của 2.'],
              ],
              ex: { task: `Viết lại bộ lọc thành IIR một cực ⟦y += (x - y) >> 2⟧. Bộ nhớ và thời gian thay đổi thế nào? Đáp ứng khác ra sao?`, sol: `Chỉ cần 1 biến (O(1) bộ nhớ thay vì O(N)), vẫn O(1) thời gian. Đáp ứng theo hàm mũ: mỗi bước đi được 1/4 khoảng cách còn lại, không bao giờ "đến hẳn" như trung bình trượt; cần cẩn thận làm tròn với số nguyên.` },
              quiz: [
                ['Độ phức tạp thời gian của ⟦FilterUpdate⟧ theo N là gì?', ['O(N)', 'O(1)', 'O(log N)', 'O(N²)'], 1, 'Chỉ một phép trừ, một phép cộng, một phép dịch.'],
                ['Vì sao chọn N = 8?', ['Vì ADC 8 bit', 'Lũy thừa của 2: chia bằng dịch, quay vòng bằng mask', 'Bắt buộc của HAL', 'Vì có 8 byte trong khung'], 1, '⟦FILTER_SHIFT = 3⟧.'],
              ],
              sum: ['Trung bình trượt 8 mẫu, O(1) nhờ tổng chạy.', 'Cửa sổ 80 ms, trễ khoảng 40 ms.', 'N lũy thừa 2 để dịch và mask.'],
            },
            {
              id: '5.1.3', t: 'Chống dội nút bấm (debounce)', min: 15, pre: ['5.1.1'],
              concepts: [
                ['Dội phím', 'Khi nhấn, tiếp điểm cơ khí đóng mở nhiều lần trong vài ms.'],
                ['Debounce theo thời gian', 'Chỉ chấp nhận trạng thái sau khi ổn định đủ N lần đọc liên tiếp.'],
                ['Latch', 'Cờ "đã xử lý lần nhấn này" để một lần nhấn chỉ gây một hành động.'],
              ],
              goal: `Bạn đọc được máy trạng thái debounce ba nhánh của project và tự viết lại cho nút USER1 bên Control ECU (ở đó dùng đúng mẫu này).`,
              bg: `Nếu đổi fault mode mỗi lần đọc thấy nút đang nhấn, một lần nhấn tay (100–300 ms) sẽ đổi mode 10–30 lần. Cần hai thứ: chờ ổn định và chỉ hành động một lần cho mỗi lần nhấn.`,
              th: `Mỗi 10 ms:
- **Đang nhấn và chưa đủ ổn định** (⟦stableTicks < 3⟧): tăng bộ đếm.
- **Đang nhấn, đã ổn định, chưa latch**: latch và **thực hiện hành động một lần**.
- **Đang nhấn, đã latch**: không làm gì (đang giữ nút).
- **Nhả nút**: reset bộ đếm và latch.

Nút phải ổn định 30 ms mới được chấp nhận. Mã hóa với một bộ đếm và một cờ, không cần ngắt.`,
              use: `Sensor: hành động là chuyển sang fault mode kế tiếp. Control ECU: cùng mẫu trong ⟦HandleButton⟧ của ⟦control_app.c⟧, hành động là bật/tắt lỗi output cục bộ.`,
              code: [
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: 'static void HandleButton(void)', to: 's_btnLatched     = false;', hl: ['if (s_btnStableTicks < BUTTON_DEBOUNCE_TICKS)', 's_btnLatched = true;   /* one action per press */'],
                  ex: [['if (s_btnStableTicks < BUTTON_DEBOUNCE_TICKS)', 'Chưa đủ 3 lần đọc liên tiếp: chỉ đếm.'], ['s_btnLatched = true;   /* one action per press */', 'Latch trước rồi mới hành động: lần đọc sau không lặp lại.'], ['case FAULT_NONE:', 'Hành động: chuyển sang mode kế tiếp theo vòng.'], ['s_btnStableTicks = 0U;', 'Nhả nút: sẵn sàng cho lần nhấn sau.']] },
              ],
              explain: `Ba nhánh ⟦if / else if / else⟧ kèm comment ⟦/* still held */⟧ ở nhánh rỗng: MISRA yêu cầu mọi chuỗi ⟦else if⟧ kết thúc bằng ⟦else⟧, và comment cho thấy nhánh rỗng là cố ý.`,
              run: ['Tick 1: nhấn, stable = 1.', 'Tick 2: stable = 2.', 'Tick 3: stable = 3.', 'Tick 4: stable đủ, chưa latch → latch, đổi mode, in log.', 'Tick 5…: vẫn nhấn → không làm gì.', 'Nhả: reset; lần nhấn sau bắt đầu lại.'],
              fig: { type: 'fsm', states: ['Thả', 'Đang ổn định', 'Đã hành động (giữ)'], edges: [['Thả', 'Đang ổn định', 'đọc thấy nhấn'], ['Đang ổn định', 'Đang ổn định', 'vẫn nhấn, stable < 3'], ['Đang ổn định', 'Đã hành động (giữ)', 'stable đủ: latch + đổi mode'], ['Đã hành động (giữ)', 'Thả', 'nhả nút'], ['Đang ổn định', 'Thả', 'nhả trước khi đủ 30 ms (nhiễu)']] },
              video: { t: 'Một lần nhấn, một hành động', d: '1:00', goal: 'Thấy dội phím và cách lọc.',
                s: ['Tín hiệu nút thật với các gai dội.', 'Bộ đếm ổn định tăng mỗi 10 ms.', 'Đủ 30 ms: hành động một lần.', 'Giữ nút lâu: không lặp lại.'] },
              pit: [
                ['Hành động trước khi latch', 'Nếu hành động gây chậm và ngắt kế tiếp đến, logic có thể chạy lại. Latch trước.'],
                ['Debounce bằng ⟦HAL_Delay(50)⟧', 'Chặn cả task 10 ms: không gửi CAN trong 50 ms, Control ECU báo timeout.'],
              ],
              ex: { task: `So sánh ⟦HandleButton⟧ của Sensor và của Control ({{control_ecu/CM4/Core/App/control_app.c@static void HandleButton(void)}}). Khác nhau ở đâu?`, sol: `Cùng thuật toán. Control dùng biến ⟦static⟧ cục bộ trong hàm (⟦stableTicks⟧, ⟦latched⟧) thay cho biến file, và hành động là đảo ⟦s_localInject⟧.` },
              quiz: [
                ['Nút phải ổn định bao lâu mới được chấp nhận?', ['10 ms', '30 ms', '100 ms', '1 s'], 1, '⟦BUTTON_DEBOUNCE_TICKS = 3⟧ × 10 ms.'],
                ['Cờ ⟦s_btnLatched⟧ để làm gì?', ['Đếm số lần nhấn', 'Đảm bảo một lần nhấn chỉ gây một hành động', 'Bật LED', 'Lưu mode'], 1, 'Reset khi nhả nút.'],
              ],
              sum: ['Chờ ổn định N lần đọc, rồi hành động một lần.', 'Latch reset khi nhả.', 'Không dùng delay chặn.'],
            },
            {
              id: '5.1.4', t: 'Fault injection: hai mode hiện có và bài tự viết ba mode E2E', min: 45, pre: ['5.1.3', '6.1.3'],
              concepts: [
                ['Fault injection', 'Cố ý tạo lỗi để kiểm tra hệ thống phản ứng đúng. Là phần cốt lõi của kiểm thử an toàn chức năng.'],
                ['Lỗi gián đoạn', 'Chỉ hỏng một phần khung (ví dụ 1 trên 10), giống nhiễu thật hơn là mất hẳn tín hiệu.'],
                ['Cách ly DTC', 'Thiết kế mỗi mode sao cho chỉ đúng một DTC được ghi, để kiểm chứng rõ ràng.'],
              ],
              goal: `Bạn hiểu hai mode chèn lỗi đang có (SILENT, OUT_OF_RANGE), rồi **tự viết** ba mode kiểm tra E2E: CRC hỏng, counter lặp, counter nhảy. Đây là bài code tay đầu tiên của khóa: khoảng 40 dòng C, dùng thao tác bit, counter modulo 16 và thứ tự so với CRC.`,
              bg: `Muốn chứng minh Control ECU phát hiện lỗi, cần tạo ra lỗi một cách có kiểm soát mà không phải rút dây. Sensor ECU tự làm hỏng khung của chính nó theo lệnh nút B1. Hiện có hai mode; ba mode E2E nằm trong roadmap và là bài tập của bạn.`,
              th: `**Đang có trong code:**
| Mode | Sensor làm gì | Control phát hiện |
|---|---|---|
| SILENT | Không gửi 0x100 | Timeout sau 100 ms → U0100-87 |
| OUT_OF_RANGE | Gửi 300,0 km/h | Range → P0501-00 |

**Spec cho ba mode bạn sẽ viết** (B1 xoay vòng NONE → SILENT → OUT_OF_RANGE → BAD_CRC → REPEATED → WRONG_SEQ → NONE):
| Mode | Sensor làm gì | Control phải thấy |
|---|---|---|
| BAD_CRC | Lật một bit dữ liệu **sau khi** tính CRC, 1 khung trên 10 | bộ đếm ⟦crc⟧ tăng khoảng 10/s, chỉ DTC U0400-81 |
| REPEATED | Gửi lại counter của khung trước (CRC vẫn đúng), 1 khung trên 10 | ⟦rep⟧ tăng khoảng 10/s, chỉ U0400-81 |
| WRONG_SEQ | Counter nhảy như mất 3 khung (bên nhận chỉ chấp nhận mất 2), 1 khung trên 10 | ⟦seq⟧ tăng khoảng 10/s, chỉ U0400-81 |

**Ba ý thiết kế cần tự giải thích được:**
- **Vì sao 1 trên 10?** Giữa hai khung hỏng có 9 khung tốt: khoảng trống lớn nhất giữa hai khung hợp lệ là 20 ms, dưới timeout 100 ms nên không có lỗi timeout. Nhưng 9 < 10 khung tốt cần để xóa lỗi E2E ([[6.1.3]]), nên lỗi E2E giữ liên tục. Kết quả: chỉ U0400-81 được ghi.
- **Lỗi counter trước CRC, lỗi dữ liệu sau CRC.** Sửa counter trước ⟦E2e_Protect⟧ thì CRC vẫn đúng với counter sai, nên chỉ phép kiểm counter bắt được. Sửa dữ liệu sau ⟦E2e_Protect⟧ thì CRC không còn khớp.
- **Nên lật bit nào?** Gợi ý: bit cao nhất của byte tốc độ. Nếu khung hỏng lọt qua, nó đọc ra hơn 3200 km/h và bật cả lỗi range, nên "không có lỗi range" là bằng chứng khung đã bị loại.`,
              use: `Hai mode hiện có nằm trong ⟦SendSpeedFrame⟧; nút B1 đổi mode trong ⟦HandleButton⟧ ([[5.1.3]]). Bit ⟦SENSOR_STATUS_FAULT_INJ⟧ trong byte 4 báo khung được gửi khi đang chèn lỗi. Ba mode mới chỉ sửa ⟦sensor_app.c⟧; phía Control đã đếm sẵn ⟦crc⟧, ⟦rep⟧, ⟦seq⟧ trong log.`,
              code: [
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: '#define FAULT_SPEED_OUT_OF_RANGE', to: '} FaultMode_t;', hl: ['FAULT_MODE_COUNT'],
                  ex: [['#define FAULT_SPEED_OUT_OF_RANGE', 'Giá trị vô lý cho mode OUT_OF_RANGE: 3000 = 300,0 km/h, trên mức tối đa 2500.'], ['FAULT_MODE_COUNT', 'Phần tử cuối dùng để đếm số mode. Ba mode mới chèn ngay trước nó.']] },
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: 'static void SendSpeedFrame(void)', to: '(void)CanDrv_Write(&frame);   /* drops are counted in the driver stats */', hl: ['if (s_faultMode == FAULT_SILENT)', 'E2e_Protect(frame.data, &s_speedAlive);'],
                  ex: [['if (s_faultMode == FAULT_SILENT)', 'SILENT: thoát trước khi gửi.'], ['speed = FAULT_SPEED_OUT_OF_RANGE;', 'OUT_OF_RANGE: khung hợp lệ về E2E nhưng giá trị vô lý.'], ['E2e_Protect(frame.data, &s_speedAlive);', 'Điểm then chốt cho bài tập: lỗi counter chèn ngay **trước** dòng này, lỗi dữ liệu chèn ngay **sau**.']] },
              ],
              explain: `Đọc hai đoạn trên và chỉ ra chính xác ba chỗ bạn sẽ sửa: thêm hằng số và giá trị enum, thêm nhánh trong ⟦HandleButton⟧, chèn logic quanh ⟦E2e_Protect⟧ trong ⟦SendSpeedFrame⟧.`,
              run: ['(Sau khi bạn viết xong) Nhấn B1 tới mode BAD_CRC.', 'Mỗi tick, một bộ đếm tăng vòng 0..9; khi nó bằng 0 thì khung này bị làm hỏng.', 'Control: ⟦ERR_CRC⟧ → bỏ khung, ⟦e2eError = true⟧; khung kế có delta 2 → ⟦OK_SOME_LOST⟧.', '9 khung tốt không đủ để xóa lỗi → SPEED_E2E giữ, PWM 0 %, U0400-81 confirmed sau 3 chu kỳ.', 'Quay về NONE: sau khoảng 110 ms lỗi hết, PWM chạy lại, DTC vẫn giữ.'],
              fig: { type: 'flow', nodes: [['Đóng gói tốc độ, status', 'start'], ['Khung thứ 10? REPEATED: lùi counter · WRONG_SEQ: cộng thêm', 'dec'], 'E2e_Protect: ghi counter, tính CRC', ['Khung thứ 10? BAD_CRC: lật một bit dữ liệu', 'dec'], ['CanDrv_Write', 'end']] },
              figCap: 'Vị trí chèn của ba mode bạn sẽ viết: lỗi counter trước khi tính CRC, lỗi dữ liệu sau.',
              video: { t: 'Ba cách làm hỏng một khung', d: '2:30', goal: 'Phân biệt CRC, repeated, wrong sequence trước khi viết code.',
                s: ['Khung bình thường: counter 5, CRC đúng.', 'BAD_CRC: lật bit sau CRC → bên nhận tính CRC khác.', 'REPEATED: counter 4 lặp lại, CRC vẫn đúng → chỉ counter phát hiện.', 'WRONG_SEQ: counter nhảy 5 → 9.', 'Log Control: bộ đếm crc/rep/seq tăng khoảng 10/s tương ứng.'] },
              pit: [
                ['Lật bit trước khi tính CRC', 'CRC sẽ tính trên dữ liệu đã hỏng và vẫn đúng: bên nhận không phát hiện được gì.'],
                ['Hỏng 1 khung trên 20', '19 khung tốt > 10 → lỗi E2E tự hết giữa hai lần hỏng: DTC vẫn confirmed nhưng lỗi bật tắt liên tục. Chu kỳ hỏng phải ≤ ⟦E2E_HEAL_FRAMES⟧.'],
                ['Lùi counter bằng ⟦s_speedAlive - 1⟧ mà không mask', 'Khi counter đang là 0, phép trừ ra 255. Phải ⟦& E2E_COUNTER_MASK⟧ để quay về 15.'],
                ['Tăng bộ đếm 1/10 cả trong mode SILENT', 'Không sai về logic, nhưng nên tăng ở chỗ khung thật sự được gửi để dễ suy luận.'],
              ],
              ex: { task: `**Tự viết ba mode BAD_CRC, REPEATED, WRONG_SEQ trong ⟦sensor_app.c⟧.** Khung gợi ý (điền các TODO):

~~~c
#define FAULT_E2E_PERIOD_FRAMES  (10U)    /* TODO: vì sao không được lớn hơn E2E_HEAL_FRAMES? */
#define FAULT_COUNTER_SKIP       (/* TODO: cộng bao nhiêu để delta = 4? */)
#define FAULT_CORRUPT_BIT        (/* TODO: bit nào của byte 0? */)
/* enum: thêm FAULT_BAD_CRC, FAULT_REPEATED, FAULT_WRONG_SEQ trước FAULT_MODE_COUNT */
static uint8_t s_e2eFaultIdx = 0U;

/* HandleButton: TODO thêm các case để B1 xoay vòng đủ 6 mode */

/* SendSpeedFrame, quanh E2e_Protect: */
s_e2eFaultIdx = /* TODO: tăng vòng 0..FAULT_E2E_PERIOD_FRAMES-1 */;
bool damage = /* TODO */;
if (damage && (s_faultMode == FAULT_REPEATED))  { /* TODO: lùi counter, nhớ mask */ }
if (damage && (s_faultMode == FAULT_WRONG_SEQ)) { /* TODO: cộng FAULT_COUNTER_SKIP, nhớ mask */ }
E2e_Protect(frame.data, &s_speedAlive);
if (damage && (s_faultMode == FAULT_BAD_CRC))   { /* TODO: lật FAULT_CORRUPT_BIT trong byte 0 */ }
~~~

**Tiêu chí đạt:** ⟦bash tools/arm_compile_check.sh sensor_ecu/Core/App/sensor_app.c⟧ không lỗi và không cảnh báo; ⟦bash tools/static_analysis.sh⟧ không finding MISRA; dùng công cụ ở bài [[6.1.2]] để kiểm dãy counter mà REPEATED và WRONG_SEQ tạo ra; khi có board: log Control đúng như bảng spec.`,
                hint: `Counter là 4 bit nên mọi phép cộng trừ trên ⟦s_speedAlive⟧ phải ⟦& E2E_COUNTER_MASK⟧. ⟦E2e_Protect⟧ ghi counter hiện tại rồi tự tăng nó: lùi 1 trước khi gọi là gửi lại giá trị cũ. Delta mà bên nhận thấy bằng 1 + số bạn cộng thêm. Ép kiểu ⟦(uint8_t)⟧ cho kết quả các phép tính (MISRA nhóm 10.x, xem [[2.1.1]]).`,
                sol: `Kiểm bản của bạn theo các ý sau: (1) chu kỳ hỏng 10 ≤ ⟦E2E_HEAL_FRAMES⟧; (2) ⟦FAULT_COUNTER_SKIP⟧ = 3 (bằng ⟦E2E_MAX_DELTA_COUNTER⟧) cho delta 4; (3) REPEATED: ⟦(uint8_t)((s_speedAlive - 1U) & E2E_COUNTER_MASK)⟧ trước ⟦E2e_Protect⟧; (4) BAD_CRC: ⟦frame.data[0] ^= 0x80U⟧ sau ⟦E2e_Protect⟧; (5) B1 đi đủ 6 mode rồi về NONE. Bản tham khảo của Claude là file patch ⟦D:\\LIFE\\Backup-Project-CV\\solutions\\Mini_Automotive-e2e-fault-modes-claude-reference.patch⟧. Chỉ mở sau khi bạn tự làm xong, để so cách làm.` },
              quiz: [
                ['Trong mode BAD_CRC, vì sao bit phải bị lật SAU khi gọi ⟦E2e_Protect⟧?', ['Cho nhanh', 'Để CRC không còn khớp với dữ liệu, giống hỏng trên đường truyền', 'Vì counter ở byte 6', 'Không quan trọng'], 1, 'Nếu lật trước, CRC tính trên dữ liệu hỏng và vẫn khớp.'],
                ['Vì sao hỏng 1 khung trên 10 không gây lỗi timeout?', ['Timeout bị tắt', 'Khoảng trống lớn nhất giữa hai khung hợp lệ chỉ 20 ms, dưới 100 ms', 'Vì Sensor gửi nhanh hơn', 'Vì lỗi E2E ưu tiên hơn'], 1, 'Chỉ 1 trên 10 khung bị loại.'],
                ['Muốn bên nhận thấy delta = 4, mode WRONG_SEQ phải cộng thêm bao nhiêu vào counter trước ⟦E2e_Protect⟧?', ['1', '3', '4', '5'], 1, 'Delta = 1 (bước bình thường) + số cộng thêm.'],
              ],
              sum: ['Hiện có SILENT và OUT_OF_RANGE; ba mode E2E là bài bạn tự viết.', 'Hỏng 1 trên 10 khung: giữ lỗi E2E mà không timeout.', 'Lỗi counter trước CRC, lỗi dữ liệu sau CRC.', 'Mọi phép tính trên counter phải mask 4 bit.'],
            },
            {
              id: '5.1.5', t: 'tester_app: UDS tester chạy trên Sensor ECU', min: 25, pre: ['5.1.4', '2.3.2'],
              concepts: [
                ['Bảng bước (step table)', 'Kịch bản test khai báo bằng dữ liệu: request, tiền tố response mong đợi, độ trễ.'],
                ['Máy trạng thái', 'IDLE → DELAY → SEND → WAIT, chạy mỗi 10 ms, không chặn.'],
                ['Tiền tố response', 'So sánh vài byte đầu của response (ví dụ ⟦62 F1 95⟧) thay vì toàn bộ, vì dữ liệu phía sau thay đổi.'],
              ],
              goal: `Bạn hiểu tester M5: nhận khung từ ISR qua ring buffer, chạy kịch bản bằng máy trạng thái không chặn, chấm PASS/FAIL theo tiền tố response.`,
              bg: `Một tester UDS cần: gửi request qua ISO-TP, chờ response có timeout, so sánh với mong đợi, in kết quả. Trên MCU không RTOS, "chờ" phải viết thành máy trạng thái được gọi mỗi 10 ms.`,
              th: `- **Dữ liệu:** mỗi bước là một ⟦Step_t⟧ (tên, request, response mong đợi, delay, functional). Các kịch bản (⟦k_seqTest⟧ 12 bước, ⟦k_seqDtc⟧, ⟦k_seqReset⟧…) gắn với phím trên cổng VCP.
- **Nhận:** ISR CAN chỉ chép khung 0x7E8 vào ring buffer; ⟦TesterApp_Task⟧ rút ring và đưa vào ⟦IsoTp_RxFrame⟧.
- **Máy trạng thái ⟦RunSequence⟧:** DELAY (chờ ⟦delayMs⟧) → SEND (khi ISO-TP rảnh) → WAIT (có response thì so tiền tố; quá 1000 ms là FAIL). Bước kỳ vọng im lặng (functional NRC bị chặn) PASS nếu sau 300 ms không có response.
- **Functional:** gửi thẳng một Single Frame trên 0x7DF (không qua link ISO-TP, vì functional chỉ dùng SF).`,
              use: `Đây là tester đã chạy 22/22 bước qua bus ở M5. Tester C++ trong ⟦tester/⟧ chạy cùng kịch bản (⟦runRegressionScenario⟧, [[13.2.5]]).`,
              code: [
                { f: 'sensor_ecu/Core/App/tester_app.c', from: 'static const Step_t k_seqReset[] =', to: '};', hl: ['STEP_D("ECU back: TesterPresent (after 3 s)", rq_tp, rs_tp, 3000U),'],
                  ex: [['STEP("Session extended",', 'Reset chỉ được phép trong extended session, nên phải vào extended trước.'], ['STEP_D("ECU back: TesterPresent (after 3 s)", rq_tp, rs_tp, 3000U),', 'Chờ 3 s sau reset rồi mới hỏi ECU có quay lại không.']] },
                { f: 'sensor_ecu/Core/App/tester_app.c', from: 'static void RunSequence(void)', to: 'case ST_IDLE:', hl: ['Finish((s_respLen >= st->expectLen) &&', 'else if ((now - s_timer) >= RESPONSE_TIMEOUT_MS)'],
                  ex: [['if (!IsoTp_IsTxBusy(&s_link))', 'Chỉ gửi khi link ISO-TP đã gửi xong message trước.'], ['if (st->expect == NULL)', 'Bước kỳ vọng im lặng: có response là FAIL, im lặng 300 ms là PASS.'], ['Finish((s_respLen >= st->expectLen) &&', 'PASS khi response bắt đầu bằng đúng các byte mong đợi.'], ['else if ((now - s_timer) >= RESPONSE_TIMEOUT_MS)', 'Hết 1000 ms (lớn hơn P2* của server) mà không có response: FAIL.']] },
                { f: 'sensor_ecu/Core/App/tester_app.c', from: 'void TesterApp_OnCanFrameIsr(const CanDrv_Frame_t *frame)', n: 14, hl: ['if (frame->id != CANID_UDS_RESP_CONTROL)'],
                  ex: [['if (frame->id != CANID_UDS_RESP_CONTROL)', 'Chỉ giữ khung 0x7E8; mọi khung khác bỏ qua ngay trong ISR.'], ['next = (uint8_t)((s_head + 1U) % RING_LEN);', 'Ô kế tiếp; nếu trùng ⟦s_tail⟧ là đầy.']] },
              ],
              explain: `Kịch bản là **dữ liệu**, máy trạng thái là **cơ chế**. Thêm một bước test chỉ cần thêm một dòng ⟦STEP(…)⟧, không đụng vào logic.`,
              run: ['Người dùng gõ ⟦r⟧ trên VCP → ⟦Start(k_seqReset)⟧.', 'DELAY → SEND: ⟦IsoTp_Transmit(10 03)⟧.', 'Response 0x7E8 tới: ISR → ring → ⟦IsoTp_RxFrame⟧ → ⟦OnResponse⟧ lưu ⟦s_resp⟧.', 'WAIT thấy ⟦s_gotResp⟧, so tiền tố ⟦50 03 00 32 01 F4⟧ → PASS.', 'Bước kế tiếp: ⟦11 01⟧, rồi chờ 3 s, rồi ⟦3E 00⟧.'],
              fig: { type: 'fsm', states: ['ST_IDLE', 'ST_DELAY', 'ST_SEND', 'ST_WAIT'], edges: [['ST_IDLE', 'ST_DELAY', 'phím t/d/c/v/f/r → Start()'], ['ST_DELAY', 'ST_SEND', 'đủ delayMs'], ['ST_SEND', 'ST_WAIT', 'ISO-TP rảnh → SendStep()'], ['ST_WAIT', 'ST_DELAY', 'Finish(): còn bước'], ['ST_WAIT', 'ST_IDLE', 'Finish(): hết bước, in tổng kết']] },
              video: { t: 'Tester M5 chạy 12 bước', d: '2:00', goal: 'Đọc log tester và đối chiếu bảng bước.',
                s: ['Gõ t trên terminal VCP.', 'Mỗi dòng [TESTER] n/12 tương ứng một STEP.', 'Bước NRC 7E: reset bị từ chối ở default.', 'Bước đọc DTC: giải mã danh sách.', 'Tổng kết 12/12.'] },
              pit: [
                ['Gửi request mới khi ISO-TP còn bận', '⟦IsoTp_Transmit⟧ trả BUSY và request bị mất. Trạng thái SEND chờ ⟦!IsoTp_IsTxBusy⟧.'],
                ['Timeout tester nhỏ hơn P2* của ECU', 'Nếu ECU gửi NRC 0x78 rồi trả lời trong P2*, tester đã FAIL oan. 1000 ms ở đây đủ vì ECU trả lời ngay.'],
              ],
              ex: { task: `Thêm (trên giấy) một bước vào ⟦k_seqTest⟧: đọc DID ⟦0101⟧ (fault mask) và mong đợi tiền tố ⟦62 01 01⟧. Cần khai báo những gì?`, sol: `Hai mảng: ⟦static const uint8_t rq_flt[] = { 0x22, 0x01, 0x01 };⟧ và ⟦rs_flt[] = { 0x62, 0x01, 0x01 };⟧, rồi thêm ⟦STEP("ReadDID 0101 faults", rq_flt, rs_flt),⟧ vào bảng.` },
              quiz: [
                ['Bước "Functional unknown service: silent" PASS khi nào?', ['Khi nhận NRC 11', 'Khi không có response trong 300 ms', 'Khi nhận 7E 00', 'Luôn PASS'], 1, 'Với request functional, server phải chặn NRC 0x11.'],
                ['Tester nhận khung 0x7E8 từ ISR bằng cách nào?', ['Gọi IsoTp_RxFrame trong ISR', 'Chép vào ring buffer, task 10 ms rút ra', 'Dùng queue FreeRTOS', 'Polling FDCAN'], 1, 'Sensor không có RTOS; ring buffer một ghi một đọc.'],
              ],
              sum: ['Kịch bản = bảng ⟦Step_t⟧; cơ chế = máy trạng thái 4 trạng thái.', 'ISR → ring buffer → task → ISO-TP.', 'PASS theo tiền tố response, timeout 1000 ms.'],
            },
          ],
        },
      ],
    },
  ],
};
