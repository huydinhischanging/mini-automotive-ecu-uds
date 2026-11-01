// Beginner, chapter 3: CAN fundamentals as used by this project.
module.exports = {
  level: { id: 'beginner' },
  chapters: [
    {
      id: 'c03', t: 'CAN nền tảng',
      lessons: [
        {
          id: '3.1', t: 'Lớp vật lý và khung CAN',
          subs: [
            {
              id: '3.1.1', t: 'CANH/CANL, dominant/recessive, terminator và transceiver', min: 20, extra: true, pre: ['1.1.2'],
              concepts: [
                ['Tín hiệu vi sai', 'Thông tin nằm ở hiệu điện áp CANH − CANL, không phải điện áp từng dây so với đất, nên nhiễu tác động lên cả hai dây bị triệt tiêu.'],
                ['Dominant (0)', 'Trạng thái CANH ≈ 3,5 V, CANL ≈ 1,5 V. Chỉ cần một node lái dominant là cả bus thành dominant.'],
                ['Recessive (1)', 'Không node nào lái, hai dây cùng ≈ 2,5 V nhờ điện trở đầu cuối.'],
                ['Terminator 120 Ω', 'Điện trở ở mỗi đầu bus, khớp trở kháng cặp dây xoắn để chống phản xạ. Hai cái song song đo được 60 Ω.'],
              ],
              goal: `Bạn giải thích được vì sao CAN chịu nhiễu tốt, vì sao bit 0 "thắng" bit 1, và cách kiểm tra nhanh dây bus bằng đồng hồ đo.`,
              bg: `Đây là **kiến thức bổ trợ**: project không có code điều khiển lớp vật lý (transceiver làm việc đó), nhưng bạn cần nó để hiểu phân xử, lỗi ACK và bus-off ở các bài sau.`,
              th: `Bus CAN là hai dây xoắn **CANH** và **CANL**, mỗi node nối vào qua một transceiver.

- **Recessive (logic 1):** không ai lái, hai dây cùng mức. **Dominant (logic 0):** transceiver kéo CANH lên, CANL xuống.
- Bus hoạt động như **AND có dây**: chỉ cần một node gửi 0 là bus thành 0. Tính chất này là nền của phân xử ([[3.1.2]]) và của bit ACK.
- Mỗi đầu bus có **120 Ω**. Tắt nguồn, đo giữa CANH và CANL phải được **60 Ω**: nếu được 120 Ω là thiếu một đầu cuối, nếu vô cùng là đứt dây.
- Mọi node cần **GND chung**.

Ở project, mỗi module SN65HVD230 có sẵn 120 Ω, nên khi nối cả hai thì đo được khoảng 60 Ω (README, mục Wiring).

**Internal loopback**: FDCAN có chế độ tự nhận lại khung mình gửi ngay trong chip, không ra dây. Project dùng chế độ này để kiểm phần mềm trước khi có bus thật (M1–M3).`,
              use: `Công tắc loopback nằm ở đầu {{sensor_ecu/Core/App/sensor_app.c@#define SENSOR_APP_CAN_LOOPBACK}} và {{control_ecu/CM4/Core/App/control_app.c@#define CONTROL_APP_CAN_LOOPBACK}}; driver đổi chế độ FDCAN trong ⟦CanDrv_Init⟧.`,
              code: [
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: '/* 1: FDCAN internal loopback', n: 3, hl: ['#define SENSOR_APP_CAN_LOOPBACK'],
                  ex: [['needs the SN65HVD230 and at least one other node to ACK', 'Chế độ bình thường cần transceiver và ít nhất một node khác để ACK. Thiếu ACK là lỗi ([[3.1.4]]).']] },
                { f: 'sensor_ecu/Core/Mcal/can_drv.c', from: 'if (mode == CANDRV_MODE_INTERNAL_LOOPBACK)', n: 9, hl: ['hfdcan1.Init.Mode = FDCAN_MODE_INTERNAL_LOOPBACK;'],
                  ex: [['hfdcan1.Init.Mode = FDCAN_MODE_INTERNAL_LOOPBACK;', 'Cùng bit timing, chỉ đổi chế độ hoạt động rồi khởi tạo lại FDCAN.']] },
              ],
              explain: `Một hằng số ⟦#define⟧ quyết định board chạy loopback hay bus thật. Đổi giá trị → build lại → nạp. Cách này đơn giản nhưng phải nhớ đặt về ⟦0U⟧ trước khi nối bus.`,
              run: [
                'Node A muốn gửi bit 0: transceiver kéo CANH ≈ 3,5 V, CANL ≈ 1,5 V.',
                'Mọi transceiver trên bus đọc hiệu điện áp ≈ 2 V → bit 0.',
                'Không node nào lái: điện trở 120 Ω kéo hai dây về cùng ≈ 2,5 V → bit 1.',
              ],
              fig: { type: 'layers', rows: [['MCU (FDCAN)', ['TX = logic', 'RX = logic']], ['Transceiver', ['SN65HVD230', 'lái / đọc vi sai']], ['Dây', ['CANH', 'CANL', 'xoắn đôi']], ['Đầu cuối', ['120 Ω', '120 Ω', 'song song = 60 Ω']]] },
              video: { t: 'Dominant thắng recessive', d: '1:30', goal: 'Hình dung bus wired-AND.',
                s: ['Hai dây ở mức 2,5 V: recessive.', 'Một node lái: CANH lên, CANL xuống.', 'Hai node cùng gửi, một gửi 0 một gửi 1: bus là 0.', 'Đo 60 Ω giữa CANH và CANL khi tắt nguồn.'] },
              pit: [
                ['Chỉ có 120 Ω ở một đầu', 'Phản xạ tín hiệu làm sai bit ở tốc độ cao. Đo 60 Ω để chắc có đủ hai đầu.'],
                ['Quên đặt loopback về 0 khi nối bus', 'Node không ra dây, node kia không nhận được gì và không ai ACK.'],
              ],
              ex: { task: `Bạn đo giữa CANH và CANL (tắt nguồn) được 120 Ω. Có thể là lỗi gì?`, sol: `Chỉ còn một điện trở đầu cuối trong mạch: một module chưa nối, đứt một dây, hoặc một module không có điện trở.` },
              quiz: [
                ['Hai node cùng gửi một bit: A gửi 0, B gửi 1. Bus mang giá trị nào?', ['1', '0', 'Không xác định', 'Lỗi bus-off'], 1, 'Dominant (0) luôn thắng recessive (1).'],
                ['Đo CANH–CANL khi tắt nguồn, bus bình thường có hai đầu cuối được bao nhiêu?', ['0 Ω', '60 Ω', '120 Ω', '240 Ω'], 1, 'Hai điện trở 120 Ω mắc song song.'],
              ],
              sum: ['CAN vi sai, chống nhiễu tốt.', 'Bit 0 dominant thắng bit 1 recessive.', 'Hai đầu 120 Ω → đo 60 Ω.', 'Loopback kiểm phần mềm không cần dây.'],
            },
            {
              id: '3.1.2', t: 'Khung CAN và phân xử theo ID', min: 20, pre: ['3.1.1'],
              concepts: [
                ['Standard ID (11 bit)', 'Định danh khung 0x000–0x7FF. Không chỉ nơi nhận mà nói khung chứa gì và độ ưu tiên.'],
                ['DLC', 'Data Length Code: số byte dữ liệu 0–8 trong Classic CAN.'],
                ['Phân xử (arbitration)', 'Khi nhiều node gửi cùng lúc, node nào gửi ID nhỏ hơn thắng mà không làm hỏng khung.'],
                ['ACK', 'Bit mà mọi node nhận đúng khung kéo xuống dominant để xác nhận.'],
              ],
              goal: `Bạn mô tả được các trường của một khung Classic CAN, giải thích vì sao 0x100 có ưu tiên cao hơn 0x7E0, và đọc được struct ⟦CanDrv_Frame_t⟧.`,
              bg: `CAN không có địa chỉ đích: mọi node đều thấy mọi khung (broadcast). Node tự quyết định giữ khung nào bằng **bộ lọc** (filter). ID vừa là "tên" của dữ liệu, vừa là độ ưu tiên.`,
              th: `Khung Classic CAN chuẩn: SOF · **ID 11 bit** · RTR · IDE · r0 · **DLC** · **Data 0–8 byte** · CRC 15 bit · ACK · EOF.

**Phân xử:** các node bắt đầu gửi cùng lúc, mỗi node vừa gửi vừa đọc lại bus. Ở bit đầu tiên khác nhau, node gửi 1 (recessive) mà đọc thấy 0 biết mình thua và chuyển sang nhận. Khung của node thắng đi tiếp nguyên vẹn. Hệ quả: **ID càng nhỏ càng ưu tiên**.

Trong project: ⟦0x100⟧ (tốc độ, 10 ms) ưu tiên nhất, rồi ⟦0x101⟧, ⟦0x200⟧, và chẩn đoán ⟦0x7DF/0x7E0/0x7E8⟧ sau cùng. Tín hiệu điều khiển luôn đi trước chẩn đoán.

**Tải bus:** khoảng 120 khung/s (100 + 10 + 10). Một khung 8 byte dài khoảng 111 bit (thêm bit stuffing tối đa khoảng 135 bit) → 13–16 kbit/s, tức khoảng 3 % của 500 kbit/s.`,
              use: `Phần mềm chỉ thấy ID, DLC và dữ liệu: các trường khác do phần cứng FDCAN lo. Driver đóng gói thành ⟦CanDrv_Frame_t⟧ và ghi đúng các thuộc tính Classic CAN vào header HAL.`,
              code: [
                { f: 'sensor_ecu/Core/Mcal/can_drv.h', from: 'typedef struct', to: '} CanDrv_Frame_t;', hl: ['uint16_t id;'],
                  ex: [['uint16_t id;', '11 bit ID trong biến 16 bit; driver kiểm ⟦id <= 0x7FF⟧ trước khi gửi.'], ['uint8_t  data[CANDRV_MAX_DLC];', 'Luôn 8 byte bộ nhớ, ⟦dlc⟧ cho biết bao nhiêu byte có nghĩa.']] },
                { f: 'sensor_ecu/Core/Mcal/can_drv.c', from: 'header.Identifier          = frame->id;', to: 'header.MessageMarker       = 0U;', hl: ['header.IdType              = FDCAN_STANDARD_ID;', 'header.FDFormat            = FDCAN_CLASSIC_CAN;'],
                  ex: [['FDCAN_STANDARD_ID', 'ID 11 bit (không dùng ID mở rộng 29 bit).'], ['FDCAN_DATA_FRAME', 'Khung dữ liệu, không phải remote frame.'], ['FDCAN_CLASSIC_CAN', 'FDCAN hỗ trợ CAN FD, nhưng project dùng Classic CAN 2.0A.'], ['FDCAN_BRS_OFF', 'Không đổi tốc độ trong khung (chỉ có ý nghĩa với CAN FD).']] },
              ],
              explain: `Driver giấu toàn bộ chi tiết của HAL sau một struct 10 byte đơn giản. Tầng ứng dụng không cần biết FDCAN có những trường gì.`,
              run: [
                'Sensor ECU và tester cùng muốn gửi: Sensor gửi 0x100, tester gửi 0x7E0.',
                'Cả hai gửi bit SOF rồi các bit ID từ bit cao nhất.',
                '0x100 = 001 0000 0000, 0x7E0 = 111 1110 0000: bit đầu tiên khác nhau, tester gửi 1 nhưng đọc thấy 0.',
                'Tester ngừng gửi, nhận khung 0x100; gửi lại 0x7E0 khi bus rảnh (tự động, ⟦AutoRetransmission = ENABLE⟧).',
              ],
              fig: { type: 'bytes', title: 'Khung Classic CAN (phần mềm chỉ thấy ID, DLC, Data)', cells: [['1 bit', 'SOF', 'bắt đầu khung'], ['11 bit', 'ID', 'ưu tiên + ý nghĩa'], ['3 bit', 'RTR, IDE, r0', 'loại khung'], ['4 bit', 'DLC', '0–8'], ['0–64 bit', 'Data', 'nội dung'], ['15+1 bit', 'CRC', 'do phần cứng tính'], ['2 bit', 'ACK', 'node nhận kéo 0'], ['7 bit', 'EOF', 'kết thúc']] },
              video: { t: 'Phân xử bit by bit', d: '2:00', goal: 'Thấy vì sao ID nhỏ thắng.',
                s: ['Viết 0x100 và 0x7E0 dạng 11 bit, xếp chồng.', 'Đi từng bit: bus = AND của hai bit.', 'Tại bit khác nhau đầu tiên, node gửi 1 thấy 0 → thua.', 'Khung 0x100 hoàn tất không bị hỏng; 0x7E0 gửi lại sau.'] },
              pit: [
                ['Nghĩ CAN có địa chỉ người nhận', 'ID nói "dữ liệu gì", không nói "gửi cho ai". Mọi node đều nhận, filter quyết định giữ hay bỏ.'],
                ['Đặt ID chẩn đoán nhỏ hơn ID điều khiển', 'Request chẩn đoán dồn dập sẽ chiếm bus trước tín hiệu điều khiển. Project để chẩn đoán ở dải 0x7xx.'],
              ],
              ex: { task: `Thêm một khung mới gửi nhiệt độ mỗi 100 ms, ưu tiên thấp hơn tốc độ nhưng cao hơn chẩn đoán. Chọn ID nào trong số: 0x050, 0x150, 0x7F0?`, sol: `⟦0x150⟧: lớn hơn 0x100 (ưu tiên thấp hơn tốc độ) và nhỏ hơn 0x7E0. 0x050 sẽ thắng cả tốc độ; 0x7F0 thua cả chẩn đoán. Nhớ khai báo trong ⟦can_matrix.h⟧ ([[3.2.1]]).` },
              quiz: [
                ['Khung nào thắng phân xử: 0x200 hay 0x101?', ['0x200', '0x101', 'Cả hai hỏng', 'Tùy node nào gửi trước'], 1, 'ID nhỏ hơn thắng.'],
                ['Trong ⟦CanDrv_Write⟧, trường nào cho biết project dùng Classic CAN chứ không phải CAN FD?', ['IdType', 'FDFormat = FDCAN_CLASSIC_CAN', 'DataLength', 'MessageMarker'], 1, 'Cùng dòng BRS_OFF.'],
              ],
              sum: ['Phần mềm thấy ID 11 bit, DLC, 0–8 byte dữ liệu.', 'ID nhỏ = ưu tiên cao; phân xử không phá khung.', 'Tải bus của project khoảng 3 %.'],
            },
            {
              id: '3.1.3', t: 'Bit timing và sample point', min: 25, pre: ['3.1.2'],
              concepts: [
                ['Time quantum (tq)', 'Đơn vị thời gian nhỏ nhất của bộ điều khiển CAN = 1 / (clock ÷ prescaler).'],
                ['Bit time', 'Sync (1 tq) + Seg1 + Seg2. Ở 500 kbit/s, một bit dài 2 µs.'],
                ['Sample point', 'Thời điểm đọc giá trị bit = (1 + Seg1) / tổng tq. Ở đây khoảng 87,5–88 %.'],
                ['SJW', 'Sync Jump Width: số tq tối đa được kéo dài/rút ngắn để đồng bộ lại với cạnh tín hiệu.'],
              ],
              goal: `Bạn tự tính được bitrate và sample point từ các con số CubeMX, và hiểu vì sao hai ECU có clock khác nhau vẫn nói chuyện được.`,
              bg: `Mỗi node có thạch anh riêng, lệch nhau một chút. Để đọc đúng bit, bộ điều khiển CAN chia mỗi bit thành nhiều tq và đọc ở điểm gần cuối bit, khi tín hiệu đã ổn định sau trễ của dây và transceiver.`,
              th: `**Công thức:**
- tq = prescaler / clock
- bit time = (1 + Seg1 + Seg2) × tq
- sample point = (1 + Seg1) / (1 + Seg1 + Seg2)

**Sensor ECU (G431):** clock FDCAN 170 MHz, prescaler 10 → 17 MHz; 1 + 29 + 4 = 34 tq → 17 MHz / 34 = **500 kbit/s**; SP = 30/34 ≈ **88 %**; SJW = 4.

**Control ECU (MP157):** HSE 24 MHz, prescaler 3 → 8 MHz; 1 + 13 + 2 = 16 tq → **500 kbit/s**; SP = 14/16 = **87,5 %**.

Số tq khác nhau nhưng **bitrate và sample point gần nhau** là đủ. Driver Control còn có cấu hình dự phòng cho clock 74,25 MHz mà Linux có thể để lại: 148 tq cho 501,7 kbit/s (lệch 0,34 %), vẫn trong dung sai nhờ SJW lớn.`,
              use: `Các con số nằm trong code CubeMX ⟦MX_FDCAN1_Init⟧ của từng ECU; driver Control có thêm ⟦ApplyBitTiming⟧ để chọn theo clock thật đọc được lúc chạy.`,
              code: [
                { f: 'sensor_ecu/Core/Src/main.c', from: 'hfdcan1.Init.NominalPrescaler = 10;', n: 4, hl: ['hfdcan1.Init.NominalPrescaler = 10;', 'hfdcan1.Init.NominalTimeSeg1 = 29;'],
                  ex: [['NominalPrescaler = 10', '170 MHz / 10 = 17 MHz, tức 1 tq ≈ 58,8 ns.'], ['NominalTimeSeg1 = 29', 'Seg1 = 29 tq: điểm lấy mẫu sau 1 + 29 = 30 tq.'], ['NominalTimeSeg2 = 4', 'Seg2 = 4 tq còn lại sau điểm lấy mẫu. Tổng 34 tq = 2 µs.']] },
                { f: 'control_ecu/CM4/Core/Mcal/can_drv.c', from: '/* 24 MHz: CubeMX values', to: 'return CANDRV_ERROR;   /* unknown clock', hl: ['if (s_kernelClockHz == KERNEL_CLOCK_PLL4R_HZ)'],
                  ex: [['/* 24 MHz: CubeMX values', 'Comment tính sẵn cả hai trường hợp: bitrate và sample point.'], ['return CANDRV_OK;   /* MX_FDCAN1_Init() already used these values */', 'Clock đúng 24 MHz: giữ nguyên cấu hình CubeMX.'], ['hfdcan1.Init.NominalTimeSeg1      = 128U;', 'Clock 74,25 MHz: 1 + 128 + 19 = 148 tq.'], ['return CANDRV_ERROR;   /* unknown clock', 'Clock lạ: từ chối chạy thay vì phát sai bitrate làm hỏng cả bus.']] },
              ],
              explain: `Dòng cuối của ⟦ApplyBitTiming⟧ là một quyết định an toàn đáng nhớ: thà không lên bus còn hơn lên bus với bitrate sai, vì một node sai bitrate sẽ gây lỗi cho mọi node khác.`,
              run: [
                'Control ECU đọc clock FDCAN thật bằng ⟦HAL_RCCEx_GetPeriphCLKFreq⟧.',
                '⟦CanDrv_Init⟧ gọi ⟦ApplyBitTiming⟧ với giá trị đó.',
                '24 MHz → giữ cấu hình CubeMX; 74,25 MHz → nạp bộ thông số dự phòng; khác → trả lỗi.',
                'FDCAN bắt đầu ở 500 kbit/s, cùng bitrate với Sensor ECU dù số tq khác.',
              ],
              fig: { type: 'bytes', title: 'Một bit của Sensor ECU (34 tq = 2 µs)', cells: [['1 tq', 'Sync', 'cạnh tín hiệu ở đây'], ['29 tq', 'Seg1', 'chờ tín hiệu ổn định'], ['▲', 'Sample point', '30/34 ≈ 88 %'], ['4 tq', 'Seg2', 'phần còn lại, co giãn bằng SJW']] },
              video: { t: 'Tính bitrate trong 60 giây', d: '1:00', goal: 'Tự tính 500 kbit/s và 88 %.',
                s: ['Ghi clock 170 MHz và prescaler 10.', 'Tính tq, cộng 1 + 29 + 4.', 'Ra 500 kbit/s và sample point 88 %.', 'Làm lại cho Control ECU: 24 MHz, 16 tq.'] },
              pit: [
                ['Chỉ khớp bitrate mà bỏ qua sample point', 'Sample point lệch nhiều giữa các node làm lỗi bit khi bus dài. Giữ quanh 87,5 % ở 500 kbit/s.'],
                ['Giả định clock theo CubeMX trên MP157', 'Linux có thể đổi clock trước khi M4 chạy. Driver phải đọc clock thật (xem [[15.1.2]]).'],
              ],
              ex: { task: `Nếu clock FDCAN của Sensor ECU là 160 MHz và giữ prescaler 10, Seg1 29, Seg2 4 thì bitrate là bao nhiêu? Còn nói chuyện được với Control ECU không?`, sol: `16 MHz / 34 ≈ 470,6 kbit/s, lệch khoảng 6 %. Dung sai dao động cho phép của CAN chỉ cỡ dưới 1–2 %, nên sẽ lỗi liên tục.` },
              quiz: [
                ['Control ECU dùng 24 MHz, prescaler 3, 1 + 13 + 2 tq. Sample point là bao nhiêu?', ['75 %', '81,25 %', '87,5 %', '93,75 %'], 2, '(1 + 13) / 16 = 87,5 %.'],
                ['⟦ApplyBitTiming⟧ làm gì khi clock không phải 24 MHz hay 74,25 MHz?', ['Dùng cấu hình gần nhất', 'Trả CANDRV_ERROR, không chạy CAN', 'Tự tính prescaler', 'Reset chip'], 1, 'Từ chối chạy với bitrate sai.'],
              ],
              sum: ['bitrate = clock / (prescaler × tổng tq).', 'Sample point ≈ 87,5–88 % ở cả hai node.', 'Số tq khác nhau vẫn chạy chung được.', 'Clock lạ → không lên bus.'],
            },
            {
              id: '3.1.4', t: 'Lỗi CAN, error state và bus-off', min: 25, pre: ['3.1.3'],
              concepts: [
                ['TEC / REC', 'Bộ đếm lỗi truyền/nhận trong mỗi bộ điều khiển CAN. Lỗi làm tăng, khung tốt làm giảm.'],
                ['Error active / passive', 'TEC < 128: active, được gửi cờ lỗi mạnh. Từ 128: passive, chỉ gửi cờ lỗi yếu.'],
                ['Bus-off', 'TEC vượt 255: node tự ngắt khỏi bus. Muốn quay lại phải chờ 128 lần 11 bit recessive.'],
                ['LEC', 'Last Error Code: thanh ghi cho biết loại lỗi gần nhất (ACK, stuff, CRC…).'],
              ],
              goal: `Bạn hiểu cơ chế tự cô lập của CAN và cách driver của project tự phục hồi sau bus-off mà không reset ECU.`,
              bg: `CAN có cơ chế phát hiện lỗi rất mạnh (CRC, bit stuffing, kiểm tra format, ACK) và cơ chế **giam lỗi**: một node hỏng sẽ tự rút khỏi bus thay vì làm hỏng mọi khung của người khác.`,
              th: `- Mỗi lỗi khi gửi tăng TEC thêm 8; mỗi khung gửi thành công giảm 1.
- TEC ≥ 128 → **error passive**. TEC > 255 → **bus-off**: node ngừng gửi và nhận.
- Phục hồi theo ISO 11898: xóa bit INIT, bộ điều khiển chờ 128 lần 11 bit recessive liên tiếp rồi tham gia lại.

**Trường hợp hay bị hỏi:** rút dây khi chỉ còn Sensor trên bus. Không ai ACK → lỗi ACK, TEC tăng và lên error passive. Ở error passive, ISO 11898-1 có ngoại lệ: lỗi ACK không làm TEC tăng tiếp, nên node **ở lại error passive** chứ không bus-off. Phía Control ECU thì mất khung 0x100 → timeout sau 100 ms.

**Chính sách của project:** khi bus-off, không phục hồi ngay mà chờ 10 lần ⟦CanDrv_MainFunction⟧ (100 ms) để node hỏng không liên tục làm ngập bus bằng cờ lỗi. Không reset ECU (yêu cầu R8 trong báo cáo).`,
              use: `Toàn bộ nằm trong {{sensor_ecu/Core/Mcal/can_drv.c}} (Control ECU có cùng logic). Số lần bus-off được đếm và gửi trong khung 0x101 (byte 5).`,
              code: [
                { f: 'sensor_ecu/Core/Mcal/can_drv.c', from: 'void HAL_FDCAN_ErrorStatusCallback', to: 's_busOffPending = true;', hl: ['s_busOffPending = true;'],
                  ex: [['(ErrorStatusITs & FDCAN_IT_BUS_OFF)', 'Ngắt báo trạng thái lỗi, chỉ quan tâm sự kiện bus-off.'], ['s_busOffPending = true;', 'Trong ISR chỉ đặt cờ; việc phục hồi để cho hàm định kỳ.']] },
                { f: 'sensor_ecu/Core/Mcal/can_drv.c', from: 'void CanDrv_MainFunction(void)', to: 'CLEAR_BIT(hfdcan1.Instance->CCCR, FDCAN_CCCR_INIT);', hl: ['CLEAR_BIT(hfdcan1.Instance->CCCR, FDCAN_CCCR_INIT);'],
                  ex: [['if (s_busOffTimer >= BUSOFF_RECOVERY_DELAY_TICKS)', 'Đủ 10 lần gọi (10 × 10 ms) mới phục hồi.'], ['CLEAR_BIT(hfdcan1.Instance->CCCR, FDCAN_CCCR_INIT);', 'Phần cứng đã đặt INIT khi bus-off; xóa nó là bắt đầu chuỗi phục hồi chuẩn.']] },
              ],
              explain: `Cùng mẫu "ISR đặt cờ, hàm định kỳ xử lý" như timer 10 ms ([[2.3.2]]). Việc ghi thanh ghi ⟦CCCR⟧ trực tiếp là một trong số ít chỗ driver đi thẳng xuống thanh ghi, và nó nằm trong MCAL (deviation D4 chỉ cho phép ở đây).`,
              run: [
                'Lỗi liên tục (ví dụ chập CANH-CANL) đẩy TEC vượt 255 → phần cứng vào bus-off, đặt INIT.',
                'Ngắt ErrorStatus: ⟦busOffCount++⟧, ⟦s_busOffPending = true⟧.',
                '⟦CanDrv_MainFunction⟧ chạy mỗi 10 ms, đếm tới 10.',
                'Xóa INIT: FDCAN chờ 128 × 11 bit recessive rồi tham gia lại bus.',
                'Khung 0x101 kế tiếp báo số lần bus-off mới.',
              ],
              fig: { type: 'fsm', states: ['Error active', 'Error passive', 'Bus-off', 'Chờ 100 ms', 'Phục hồi'], edges: [['Error active', 'Error passive', 'TEC hoặc REC ≥ 128'], ['Error passive', 'Error active', 'TEC và REC < 128'], ['Error passive', 'Bus-off', 'TEC > 255'], ['Bus-off', 'Chờ 100 ms', 'ngắt BUS_OFF, s_busOffPending = true'], ['Chờ 100 ms', 'Phục hồi', '10 lần CanDrv_MainFunction, xóa INIT'], ['Phục hồi', 'Error active', '128 × 11 bit recessive']] },
              video: { t: 'Node hỏng tự rút khỏi bus', d: '1:45', goal: 'Hiểu TEC, passive, bus-off.',
                s: ['Thanh đo TEC tăng 8 mỗi lỗi gửi.', 'Qua 128: chuyển passive.', 'Qua 255: bus-off, node im lặng.', 'Driver chờ 100 ms rồi xóa INIT, node quay lại.', 'Trường hợp rút dây: dừng ở passive vì ngoại lệ ACK.'] },
              pit: [
                ['Reset cả ECU khi bus-off', 'Mất trạng thái (DTC trong RAM, session…) không cần thiết. Phục hồi ở mức bộ điều khiển CAN là đủ.'],
                ['Phục hồi ngay lập tức, liên tục', 'Node có lỗi phần cứng sẽ vào ra bus-off liên tục và làm nhiễu bus. Chờ một khoảng (ở đây 100 ms).'],
              ],
              ex: { task: `Tìm nơi số lần bus-off được đưa vào khung 0x101 trong {{sensor_ecu/Core/App/sensor_app.c}}. Vì sao có phép so sánh với 255?`, sol: `Trong ⟦SendAliveFrame⟧: ⟦frame.data[5] = (stats.busOffCount > 255U) ? 255U : (uint8_t)stats.busOffCount;⟧. Byte chỉ chứa được 0–255 nên giá trị được bão hòa ở 255 thay vì quay vòng về 0.` },
              quiz: [
                ['Chỉ còn một node trên bus (không ai ACK). Node đó cuối cùng ở trạng thái nào?', ['Bus-off', 'Error passive', 'Error active', 'Reset'], 1, 'Ngoại lệ ACK error ở trạng thái passive: TEC không tăng tiếp.'],
                ['Driver của project chờ bao lâu trước khi phục hồi sau bus-off?', ['Ngay lập tức', '10 lần CanDrv_MainFunction, khoảng 100 ms', '1 giây', 'Đến khi reset ECU'], 1, '⟦BUSOFF_RECOVERY_DELAY_TICKS = 10⟧, hàm gọi mỗi 10 ms.'],
              ],
              sum: ['TEC/REC quyết định active → passive → bus-off.', 'Driver chờ 100 ms rồi xóa INIT để phục hồi, không reset ECU.', 'Không ai ACK → error passive, không bus-off.'],
            },
          ],
        },
        {
          id: '3.2', t: 'CAN matrix',
          subs: [
            {
              id: '3.2.1', t: 'can_matrix.h: hợp đồng chung giữa các node', min: 15, pre: ['3.1.2'],
              concepts: [
                ['CAN matrix', 'Bảng định nghĩa mọi khung trên bus: ID, node gửi, chu kỳ, bố cục từng tín hiệu.'],
                ['Single source of truth', 'Mỗi thông tin chỉ khai báo ở một nơi; mọi nơi khác dùng lại, nên không thể lệch nhau.'],
                ['Hệ số tín hiệu', 'Cách đổi giá trị thô sang đơn vị vật lý, ví dụ 1 đơn vị = 0,1 km/h.'],
              ],
              goal: `Bạn biết mọi khung trên bus được định nghĩa ở đâu, đọc được bố cục từng khung, và biết cách thêm một tín hiệu mới đúng cách.`,
              bg: `Trong công nghiệp, CAN matrix là tài liệu (thường là file DBC) mà mọi nhóm phát triển ECU cùng tuân theo. Project thu gọn ý tưởng này thành một header C mà cả hai ECU cùng include.`,
              th: `⟦can_matrix.h⟧ định nghĩa cho mỗi khung:
- **ID** (⟦CANID_…⟧), **DLC**, **chu kỳ** (⟦…_CYCLE_MS⟧);
- **bố cục byte** trong comment;
- **hằng số tín hiệu**: tốc độ tối đa 2500 (= 250,0 km/h), các bit trạng thái;
- **timeout**: Control ECU coi 0x100 là mất sau 100 ms (10 chu kỳ).

Ba khung chu kỳ đều có cùng quy ước E2E: **byte 6 = counter, byte 7 = CRC**. Nhờ vậy cùng một hàm ⟦E2e_Protect⟧/⟦E2e_Check⟧ dùng được cho mọi khung.`,
              use: `Sensor dùng ⟦CANID_SENSOR_SPEED⟧, ⟦SENSOR_SPEED_MAX_X10⟧ khi đóng gói; Control dùng cùng hằng số khi kiểm range và timeout; filter phần cứng của Control cũng dựng từ các ID này ({{control_ecu/CM4/Core/App/control_app.c@static const CanDrv_Filter_t k_filters[]}}).`,
              code: [
                { f: 'common/can/can_matrix.h', from: '0x200 CONTROL_STATUS', to: '#define SENSOR_SPEED_TIMEOUT_MS', hl: ['#define SENSOR_SPEED_TIMEOUT_MS', '#define CANID_UDS_REQ_CONTROL'],
                  ex: [['byte 0   : ActiveFaults', 'Control ECU phát lại fault mask lên bus, để node khác (và người đọc trace) thấy trạng thái.'], ['#define CANID_UDS_REQ_CONTROL', 'ID chẩn đoán physical: tester gửi 0x7E0, ECU trả 0x7E8.'], ['#define SENSOR_SPEED_TIMEOUT_MS', 'Timeout = 10 chu kỳ bị mất. Đặt ở đây vì nó gắn với chu kỳ 10 ms của khung.']] },
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: 'static const CanDrv_Filter_t k_filters[] =', n: 5, hl: ['{ CANID_SENSOR_SPEED, CANID_SENSOR_ALIVE },'],
                  ex: [['{ CANID_SENSOR_SPEED, CANID_SENSOR_ALIVE },', 'Filter phần cứng dải 0x100–0x101.'], ['{ 0x7DFU,             CANID_UDS_RESP_CONTROL }', 'Dải 0x7DF–0x7E8 để nhận cả request chẩn đoán lẫn (trong loopback) response cho self-test.']] },
              ],
              explain: `Không có số ⟦0x100⟧ viết trần trong ⟦sensor_app.c⟧ hay ⟦control_app.c⟧: mọi nơi dùng tên hằng. Đổi ID một chỗ, cả hai firmware đổi theo khi build lại.`,
              run: [
                'Sensor đóng gói: ⟦frame.id = CANID_SENSOR_SPEED⟧, ⟦frame.dlc = SENSOR_SPEED_DLC⟧.',
                'Filter phần cứng của Control cho 0x100 vào RX FIFO.',
                'ComRx so ⟦frame.id⟧ với ⟦CANID_SENSOR_SPEED⟧ để chọn hàm xử lý.',
                'Monitor so tuổi khung với ⟦SENSOR_SPEED_TIMEOUT_MS⟧ và tốc độ với ⟦SENSOR_SPEED_MAX_X10⟧.',
              ],
              fig: { type: 'layers', rows: [['can_matrix.h', ['CANID_*', '*_DLC', '*_CYCLE_MS', 'SENSOR_SPEED_MAX_X10', 'SENSOR_SPEED_TIMEOUT_MS']], ['Sensor ECU', ['sensor_app.c: đóng gói 0x100, 0x101', 'tester_app.c: 0x7E0/0x7E8']], ['Control ECU', ['control_app.c: filter, giải mã, monitor, 0x200', 'diag_app.c: 0x7E0/0x7E8']]] },
              video: { t: 'Một header, hai firmware', d: '1:15', goal: 'Thấy can_matrix.h được dùng ở đâu.',
                s: ['Mở can_matrix.h.', 'Tìm CANID_SENSOR_SPEED trong sensor_app.c (gửi).', 'Tìm cùng hằng trong control_app.c (lọc và xử lý).', 'Đổi thử ID trong đầu và suy ra những gì thay đổi.'] },
              pit: [
                ['Viết ID trực tiếp (⟦0x100⟧) trong code ứng dụng', 'Khi đổi matrix sẽ quên một chỗ. Luôn dùng hằng của ⟦can_matrix.h⟧.'],
                ['Thêm khung mà quên filter của Control ECU', 'Filter phần cứng chỉ nhận 0x100–0x101 và 0x7DF–0x7E8: khung mới sẽ bị bỏ trong phần cứng.'],
              ],
              ex: { task: `Bạn thêm khung ⟦0x102⟧ (Sensor gửi nhiệt độ). Liệt kê các file phải sửa để Control ECU xử lý được nó.`, sol: `⟦can_matrix.h⟧ (ID, DLC, bố cục), ⟦sensor_app.c⟧ (gửi), ⟦control_app.c⟧: mở rộng ⟦k_filters⟧ (0x100–0x102) và thêm ⟦case⟧ trong ⟦ComRxTask⟧. Nếu dùng E2E thì thêm một ⟦E2e_RxState_t⟧ riêng.` },
              quiz: [
                ['Timeout của khung tốc độ là bao nhiêu và tương ứng mấy chu kỳ?', ['10 ms, 1 chu kỳ', '50 ms, 5 chu kỳ', '100 ms, 10 chu kỳ', '1 s, 100 chu kỳ'], 2, '⟦SENSOR_SPEED_TIMEOUT_MS = 100⟧ với chu kỳ 10 ms.'],
                ['Vì sao cả ba khung chu kỳ đều để counter ở byte 6 và CRC ở byte 7?', ['Bắt buộc theo CAN', 'Để một module E2E dùng chung cho mọi khung', 'Vì byte 7 nhanh hơn', 'Ngẫu nhiên'], 1, 'Quy ước thống nhất → ⟦E2e_Protect⟧/⟦E2e_Check⟧ không cần tham số vị trí.'],
              ],
              sum: ['⟦can_matrix.h⟧ là nguồn duy nhất của ID, chu kỳ, bố cục, timeout.', 'Không dùng số trần trong code ứng dụng.', 'Thêm khung = sửa matrix + bên gửi + filter và ComRx bên nhận.'],
            },
          ],
        },
      ],
    },
  ],
};
