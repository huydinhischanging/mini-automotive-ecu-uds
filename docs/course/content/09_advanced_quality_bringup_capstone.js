// Advanced, chapters 14-17: testing and quality, bring-up, algorithms and performance, capstone.
module.exports = {
  level: { id: 'advanced' },
  chapters: [
    {
      id: 'c14', t: 'Kiểm thử và chất lượng',
      lessons: [
        {
          id: '14.1', t: 'Bốn lớp kiểm chứng',
          subs: [
            {
              id: '14.1.1', t: 'Unit test C với driver giả và đồng hồ giả', min: 25, pre: ['2.2.2', '8.1.4'],
              concepts: [
                ['Unit test', 'Kiểm một module độc lập, nhanh, chạy trên PC, không cần phần cứng.'],
                ['Fake', 'Cài đặt giả của một phụ thuộc (CAN, đồng hồ) mà test điều khiển được.'],
                ['Test framework tối giản', '4 macro ⟦CHECK⟧, ⟦CHECK_EQ⟧, ⟦CHECK_MEM⟧, ⟦RUN_TEST⟧ trong một header; không thư viện ngoài.'],
              ],
              goal: `Bạn đọc và tự viết được một unit test C cho ⟦common/⟧, gồm cả test có thời gian (timeout) và test hai đầu (tester ↔ ECU) hoàn toàn trên PC.`,
              bg: `Module trong ⟦common/⟧ nhận phần cứng qua con trỏ hàm ([[2.2.2]]), nên test chỉ cần cung cấp phiên bản giả. Đồng hồ giả biến "chờ 1000 ms" thành một phép cộng.`,
              th: `**Cấu trúc một file test:**
1. Biến toàn cục đếm ⟦g_testFailures⟧, ⟦g_testChecks⟧.
2. Fake: ⟦FakeSend⟧ ghi khung vào mảng, ⟦FakeTime⟧ trả ⟦g_now⟧, callback ghi kết quả.
3. ⟦Setup()⟧ dựng lại trạng thái trước mỗi test.
4. Mỗi test là một hàm ⟦static void test_…(void)⟧ với các ⟦CHECK_EQ⟧.
5. ⟦main⟧ gọi ⟦RUN_TEST⟧ cho từng hàm, in tổng, trả mã thoát ≠ 0 nếu có lỗi.

**Test hai đầu 4095 byte:** hai link ISO-TP (tester và ECU) cùng gửi vào một "bus" là mảng; vòng lặp chuyển từng khung cho bên nhận đúng ID. Test kiểm dữ liệu khớp từng byte và **số khung chính xác**: 1 FF + 585 CF + 74 FC = 660 (BS = 8).

**Số lượng:** 56 test, 277 check (README): 26 ISO-TP, 8 E2E, 11 DTC, 11 UDS. Trên Linux (CI) chạy với UBSan để bắt hành vi không xác định.`,
              use: `Chạy: ⟦make -C tests⟧ (toàn bộ) hoặc ⟦make -C tests build/test_isotp.exe && tests/build/test_isotp.exe⟧ (một file).`,
              code: [
                { f: 'tests/test_framework.h', from: '#define CHECK_EQ(expected, actual)', to: '} while (0)', hl: ['printf("    FAIL %s:%d: %s == %s (expected %lld, got %lld)\\n",'],
                  ex: [['long long e_ = (long long)(expected);', 'Ép về ⟦long long⟧ để so mọi kiểu số nguyên và in được giá trị.'], ['g_testFailures++;', 'Không dừng ở lỗi đầu: test tiếp tục để báo hết các check sai.']] },
                { f: 'tests/test_isotp.c', from: 'static void test_rx_wrong_sequence_number(void)', to: 'static void test_rx_timeout_n_cr(void)', hl: ['CHECK_EQ(ISOTP_ERR_WRONG_SN, g_rxResult);'],
                  ex: [['Feed(0x22, 1, 2, 3, 4, 5, 6, 7);          /* expected 0x21 */', 'Đưa CF với SN 2 khi bên nhận chờ SN 1.'], ['Feed(0x21, 1, 2, 3, 4, 5, 6, 7);          /* late CF is now ignored */', 'Sau khi hủy, CF muộn bị bỏ qua: link không kẹt.']] },
                { f: 'tests/test_isotp.c', from: '/* Deliver frames in order until the bus is quiet. */', to: 'CHECK_EQ(1 + 585 + 74, frames);', hl: ['CHECK_EQ(1 + 585 + 74, frames);'],
                  ex: [['if (f->id == ECU_RX_ID)', 'Bus giả định tuyến khung theo ID tới đúng link.'], ['CHECK_MEM(msg, g_rxData, sizeof(msg));', 'Toàn bộ 4095 byte khớp.'], ['CHECK_EQ(1 + 585 + 74, frames);', 'Kiểm cả số khung: phát hiện FC thừa hoặc thiếu.']] },
              ],
              explain: `Test cuối là một "test tích hợp nhỏ" hoàn toàn trên PC: cùng ⟦isotp.c⟧ ở hai đầu, giống tester và ECU trên board. Điều này rẻ hơn rất nhiều so với tìm lỗi bằng logic analyzer.`,
              run: ['⟦make -C tests⟧ biên dịch ⟦test_isotp.c⟧ + ⟦isotp.c⟧ với ⟦-Wall -Wextra -Wconversion⟧.', '⟦main⟧ gọi lần lượt ⟦RUN_TEST(test_…)⟧.', 'Mỗi test: ⟦Setup⟧, đưa khung, tăng ⟦g_now⟧, ⟦CHECK_EQ⟧.', 'In ⟦[PASS]⟧/⟦[FAIL]⟧ từng test, tổng check, mã thoát.'],
              fig: { type: 'layers', rows: [['test_isotp.c', ['FakeSend → g_sent[]', 'FakeTime → g_now', 'OnRx/OnTx ghi kết quả', 'BusSend → g_bus[]']], ['Module thật', ['isotp.c (không sửa)']], ['Kết quả', ['26 test', 'mã thoát 0/1', 'CI chạy mỗi push']]] },
              video: { t: 'Test ISO-TP không cần board', d: '2:00', goal: 'Fake driver, fake clock, test hai đầu.',
                s: ['FakeSend ghi khung vào mảng.', 'g_now += 1000: timeout ngay lập tức.', 'Test sai SN: link hủy và không kẹt.', 'Hai link nói chuyện qua bus giả: 660 khung.'] },
              pit: [
                ['Không reset trạng thái giữa các test', 'Test sau phụ thuộc test trước, lỗi khó tái hiện. Mỗi test gọi ⟦Setup()⟧.'],
                ['Chỉ kiểm "có nhận được" mà không kiểm số khung', 'FC thừa/thiếu vẫn lọt. Test 4095 byte kiểm cả số khung.'],
              ],
              ex: { task: `Viết (trên giấy) một test cho ⟦E2e_Check⟧: khung đầu counter 15, khung sau counter 0 phải là ⟦E2E_OK⟧.`, sol: `⟦E2e_InitRx(&rx); counter = 15U; MakeFrame(frame, &counter, 1U); E2e_Check(&rx, frame, 8U); MakeFrame(frame, &counter, 1U); CHECK_EQ(E2E_OK, E2e_Check(&rx, frame, 8U));⟧ (repo đã có ⟦test_counter_wraps_15_to_0⟧ tương tự).` },
              quiz: [
                ['Test 4095 byte với BS = 8 kỳ vọng bao nhiêu khung FC?', ['1', '73', '74', '585'], 2, '1 sau FF + 1 sau mỗi 8 CF trừ lần cuối.'],
                ['Vì sao test timeout không phải chờ thật?', ['Chạy nhanh hơn trên PC', 'Đồng hồ giả: test tự tăng g_now', 'Bỏ qua timeout', 'Dùng thread'], 1, '⟦getTimeMs = FakeTime⟧.'],
              ],
              sum: ['Fake driver + fake clock = test nhanh, xác định.', '4 macro, không thư viện ngoài.', 'Test hai đầu kiểm cả dữ liệu lẫn số khung.'],
            },
            {
              id: '14.1.2', t: 'GoogleTest: fixture, test double và test end-to-end với code C thật', min: 25, pre: ['13.2.1', '14.1.1'],
              concepts: [
                ['Fixture (TEST_F)', 'Class kế thừa ⟦::testing::Test⟧ chứa đối tượng dùng chung; mỗi test có một bản mới.'],
                ['ASSERT vs EXPECT', '⟦ASSERT_…⟧ dừng test khi sai; ⟦EXPECT_…⟧ ghi lỗi và chạy tiếp.'],
                ['Test end-to-end', 'Client C++ thật nói chuyện với server C thật (qua SimulatedEcu).'],
              ],
              goal: `Bạn đọc được 29 test GoogleTest, phân biệt test đơn vị của client (transport giả) với test end-to-end (server C thật).`,
              bg: `Tester C++ có hai loại test: kiểm logic client độc lập (response soạn sẵn) và kiểm client + server cùng nhau. Loại thứ hai bảo đảm client hiểu đúng những gì firmware thật trả về.`,
              th: `| File | Số test | Kiểm gì |
|---|---|---|
| ⟦dtc_test.cpp⟧ | 6 | ⟦formatDtc⟧, ⟦summarizeStatus⟧, ⟦parseDtcRecords⟧ |
| ⟦uds_client_test.cpp⟧ | 13 | client với ⟦ScriptedTransport⟧: NRC, 0x78/P2*, timeout, malformed, multi-DID |
| ⟦simulated_ecu_test.cpp⟧ | 10 | client với ⟦SimulatedEcu⟧ (code C thật): kịch bản regression, vòng đời DTC, reset, S3, functional |

**Fixture:** ⟦SimulatedEcuTest⟧ có ⟦SimulatedEcu ecu;⟧ và ⟦UdsClient client{ecu};⟧. GoogleTest tạo một fixture mới cho mỗi test, nên mỗi test bắt đầu với ECU "vừa bật nguồn" (và nhờ RAII, ⟦s_active⟧ được giải phóng giữa các test).

Lưu ý về kế thừa: fixture kế thừa ⟦::testing::Test⟧ là yêu cầu của framework; ngoài đó tester chỉ kế thừa từ ⟦ITransport⟧.

**CI** build tester với ASan + UBSan và chạy cả ⟦ctest⟧ lẫn ⟦uds_tester --sim⟧.`,
              use: `Test ⟦ResponsePendingSwitchesToP2Star⟧ kiểm một tính năng mà firmware chưa dùng (NRC 0x78): đó là giá trị của test với transport giả.`,
              code: [
                { f: 'tester/tests/uds_client_test.cpp', from: 'TEST_F(UdsClientTest, ResponsePendingSwitchesToP2Star)', to: 'EXPECT_EQ(r.error().kind, Error::Kind::Timeout);', hl: ['EXPECT_EQ(link.timeouts[1], 5000ms);'],
                  ex: [['link.responses = {{0x7F, 0x14, 0x78}, {0x7F, 0x14, 0x78}, {0x54}};', 'Kịch bản: hai lần "chờ chút" rồi response thật.'], ['EXPECT_EQ(link.timeouts[0], 100ms);', 'Lần chờ đầu dùng P2 (fixture đặt 100 ms).'], ['EXPECT_EQ(link.timeouts[1], 5000ms);', 'Sau 0x78 chuyển sang P2*.'], ['EXPECT_EQ(r.error().kind, Error::Kind::Timeout);', '0x78 vô tận: client bỏ cuộc sau maxPending lần.']] },
                { f: 'tester/tests/simulated_ecu_test.cpp', from: 'class SimulatedEcuTest : public ::testing::Test', to: 'EXPECT_EQ(report.steps.size(), 14U);', hl: ['SimulatedEcu ecu;'],
                  ex: [['class SimulatedEcuTest : public ::testing::Test', 'Fixture: kế thừa do GoogleTest yêu cầu.'], ['EXPECT_TRUE(s.passed) << s.name << ": " << s.detail;', 'Thông báo lỗi kèm tên bước và chi tiết.']] },
                { f: 'tester/tests/simulated_ecu_test.cpp', from: 'TEST_F(SimulatedEcuTest, HardResetLosesDtcsBecauseTheyAreInRam)', n: 7, hl: ['EXPECT_TRUE(client.readDtcs(dtc_status::kFailedPendingConfirmed).value().empty());'],
                  ex: [['TEST_F(SimulatedEcuTest, HardResetLosesDtcsBecauseTheyAreInRam)', 'Tên test ghi lại một giới hạn của thiết kế, không phải tính năng.']] },
              ],
              explain: `Tên test là tài liệu: đọc danh sách tên (⟦FaultLifecycleSeenByTester⟧, ⟦S3TimeoutReturnsToDefaultSession⟧, ⟦FunctionalUnknownDidIsSilent⟧…) đã biết hệ thống làm gì.`,
              run: ['⟦ctest⟧ liệt kê test (⟦gtest_discover_tests⟧ lúc chạy).', 'Mỗi ⟦TEST_F⟧: GoogleTest tạo fixture → constructor SimulatedEcu.', 'Thân test gọi client, client gọi code C thật.', 'Hết test: destructor fixture → ⟦s_active = nullptr⟧.'],
              fig: { type: 'layers', rows: [['dtc_test (6)', ['hàm thuần: format, summarize, parse']], ['uds_client_test (13)', ['UdsClient', 'ScriptedTransport (giả)']], ['simulated_ecu_test (10)', ['UdsClient', 'SimulatedEcu', 'uds_server.c + dtc_manager.c thật']]] },
              video: { t: 'Hai cách test một client', d: '2:00', goal: 'Transport giả vs ECU mô phỏng.',
                s: ['ScriptedTransport: soạn response, kiểm request.', 'Test NRC 0x78 mà firmware chưa có.', 'SimulatedEcu: kịch bản regression 14 bước.', 'Fixture mới mỗi test.'] },
              pit: [
                ['Dùng EXPECT khi bước sau phụ thuộc kết quả', 'Test chạy tiếp với dữ liệu sai và báo lỗi khó hiểu. Dùng ⟦ASSERT⟧ cho điều kiện tiên quyết (như ⟦ASSERT_TRUE(…startSession…)⟧).'],
                ['Chỉ test với transport giả', 'Client và server có thể hiểu khác nhau về định dạng. Test end-to-end với code C thật bắt được điều đó.'],
              ],
              ex: { task: `Đề xuất một test GoogleTest mới cho SimulatedEcu kiểm soft reset làm mất bit pending khi cycle trước không fail.`, sol: `Ví dụ: ⟦reportMonitor(E2e, true)⟧ một lần (pending, chưa confirmed) rồi ⟦reportMonitor(E2e, false)⟧; ⟦ecuReset(Soft)⟧ (sau ⟦startSession(Extended)⟧): cycle vừa qua có fail nên pending còn. Gọi soft reset lần nữa không có fail nào: ⟦readDtcs(kPending)⟧ phải rỗng.` },
              quiz: [
                ['File test nào dùng code C thật của ECU?', ['dtc_test.cpp', 'uds_client_test.cpp', 'simulated_ecu_test.cpp', 'Không file nào'], 2, 'Qua SimulatedEcu.'],
                ['ASSERT khác EXPECT thế nào?', ['Không khác', 'ASSERT dừng test khi sai, EXPECT chạy tiếp', 'EXPECT dừng, ASSERT tiếp', 'ASSERT chỉ cho số'], 1, 'Quy tắc GoogleTest.'],
              ],
              sum: ['29 test: 6 DTC, 13 client, 10 end-to-end.', 'Fixture mới mỗi test, RAII giải phóng ECU.', 'Transport giả cho logic client; SimulatedEcu cho tương thích với firmware.'],
            },
            {
              id: '14.1.3', t: 'MISRA C:2012, cppcheck và biên dịch ARM', min: 25, pre: ['2.1.1', '4.1.1'],
              concepts: [
                ['MISRA C:2012', 'Bộ quy tắc C cho phần mềm an toàn, chia mandatory / required / advisory.'],
                ['Deviation', 'Ngoại lệ có lý do bằng văn bản cho một rule; với rule required cần justification theo MISRA Compliance:2020.'],
                ['Phân tích tĩnh', 'Kiểm code mà không chạy: cppcheck tìm lỗi và vi phạm MISRA.'],
              ],
              goal: `Bạn giải thích được trạng thái MISRA của project (không finding, 9 rule đã sửa, 6 deviation), đọc được một deviation, và biết các công cụ kiểm chạy thế nào.`,
              bg: `MISRA tồn tại vì C có nhiều hành vi không xác định và dễ sai (integer promotion, ép kiểu ngầm, con trỏ). Quy tắc giới hạn cách viết để code dễ phân tích và ít bất ngờ.`,
              th: `**Công cụ:** ⟦tools/static_analysis.sh⟧ chạy cppcheck + addon ⟦misra.py⟧ trên ba nhóm (common, sensor, control) với header HAL/CMSIS/FreeRTOS thật để có kiểu dữ liệu, nhưng không báo lỗi trong code của nhà cung cấp. Thoát mã 1 nếu có bất kỳ finding nào.

**9 rule đã sửa trong code** (ví dụ): 12.2 dịch hằng 8 bit 8 vị trí; 10.8 ép kiểu biểu thức phức sang kiểu rộng; 17.7 giá trị trả về bị bỏ qua không có ⟦(void)⟧; 11.8 ép bỏ const (chép payload); 15.4 hai ⟦break⟧ trong vòng gửi CF.

**6 deviation:**
| ID | Rule | Phạm vi | Lý do ngắn |
|---|---|---|---|
| D1 | 15.5 một điểm thoát | toàn bộ | early return dễ đọc |
| D2 | 8.7, 2.5 | common/ | API dùng ở đơn vị phân tích khác |
| D3 | 8.9 | toàn bộ | trạng thái ở file scope để đọc theo tên ký hiệu qua /dev/mem |
| D4 | 11.4 | Core/Mcal | truy cập thanh ghi qua macro CMSIS |
| D5 | 21.6, 17.1 (required) | Core/App | printf debug |
| D6 | 11.6 (required) | sys_drv.c | nhảy tới reset vector |

**Thẳng thắn:** cppcheck không phải công cụ được chứng nhận; rule không quyết định được bằng máy cần review tay.

**Biên dịch ARM:** ⟦tools/arm_compile_check.sh⟧ biên dịch mọi file App/Mcal/common cho cả hai ECU với toolchain của CubeIDE, ⟦-Wall -Wextra⟧, hiện 0 cảnh báo.`,
              use: `Cả hai công cụ nằm trong ⟦tools/check_all.sh⟧ ([[1.2.2]]).`,
              code: [
                { f: 'tools/static_analysis.sh', from: '# The CMSIS headers stop with "#error Unknown compiler"', to: 'run "common (hardware independent)" $COMMON_INC common', hl: ['--addon="$MISRA_ADDON" --suppressions-list=tools/misra_suppressions.txt', '--cppcheck-build-dir="$BUILD_DIR" --error-exitcode=1 -q'],
                  ex: [['TARGET_DEFS="-D__GNUC__=14 -D__arm__', 'Giả lập compiler ARM để header CMSIS không dừng với #error, nhờ vậy cppcheck thấy kiểu HAL thật.'], ['--addon="$MISRA_ADDON"', 'Bật kiểm tra MISRA C:2012.'], ['--error-exitcode=1', 'Có finding là thất bại: dùng được trong CI và check_all.']] },
                { f: 'tools/misra_suppressions.txt', from: '// D3 - Rule 8.9', to: 'misra-c2012-11.6:*sys_drv.c', hl: ['misra-c2012-11.6:*sys_drv.c', 'misra-c2012-21.6:*/Core/App/*'],
                  ex: [['misra-c2012-11.4:*/Core/Mcal/*', 'Phạm vi hẹp theo đường dẫn: chỉ MCAL.'], ['misra-c2012-11.6:*sys_drv.c', 'Một file duy nhất cho deviation required D6.']] },
                { f: 'docs/misra_deviations.md', from: '| D3 | 8.9 object at block scope', n: 1, hl: ['| D3 | 8.9 object at block scope'],
                  ex: [['/dev/mem', 'Lý do gắn với một kỹ thuật debug thật của project ([[15.1.1]]).']] },
              ],
              explain: `Mỗi deviation có ba thành phần: rule, phạm vi hẹp nhất có thể, và lý do gắn với thực tế của project. Đó là cách deviation được chấp nhận trong một quy trình an toàn.`,
              run: ['⟦static_analysis.sh⟧ chạy cppcheck cho ⟦common⟧.', 'Chạy cho ⟦sensor_ecu⟧ App + Mcal với header G4.', 'Chạy cho ⟦control_ecu⟧ App + Mcal với header MP1 và FreeRTOS.', 'Không finding → "static analysis: no findings".'],
              fig: { type: 'flow', nodes: [['Vi phạm MISRA được báo', 'start'], ['Sửa được trong code mà vẫn rõ ràng?', 'dec'], ['Có → sửa (9 rule đã sửa)', 'ok'], ['Không → deviation: rule, phạm vi hẹp, lý do', 'dec'], 'Ghi vào docs/misra_deviations.md', ['Thêm dòng suppression có phạm vi vào tools/misra_suppressions.txt', 'end']] },
              video: { t: 'MISRA trong 2 phút', d: '2:00', goal: 'Sửa, hay deviation.',
                s: ['Ví dụ rule 12.2 và cách sửa bằng ép kiểu.', 'Chạy static_analysis.sh: no findings.', 'Bảng 6 deviation.', 'Đọc D6: vì sao không có cách viết tuân thủ.'] },
              pit: [
                ['Suppress toàn cục một rule required', 'Mất kiểm tra ở mọi nơi. Project giới hạn D5 ở ⟦Core/App⟧ và D6 ở một file.'],
                ['Nói "tuân thủ MISRA 100 %"', 'Nói chính xác: không finding với cppcheck addon, 6 deviation có tài liệu, công cụ không được chứng nhận.'],
              ],
              ex: { task: `Viết lại cho đúng MISRA (rule 10.8): ⟦uint32_t x = (uint32_t)(a << 8);⟧ với ⟦a⟧ kiểu ⟦uint8_t⟧.`, sol: `⟦uint32_t x = ((uint32_t)a << 8U);⟧ Ép toán hạng trước khi dịch, không ép kết quả của biểu thức đã tính ở kiểu hẹp.` },
              quiz: [
                ['Deviation nào thuộc rule required?', ['D1 và D2', 'D5 và D6', 'D3 và D4', 'Không có'], 1, '21.6/17.1 và 11.6 là required.'],
                ['Vì sao static_analysis.sh định nghĩa ⟦-D__arm__⟧?', ['Để chạy trên ARM', 'Để header CMSIS không #error, cppcheck thấy được kiểu HAL', 'Để tối ưu', 'Bắt buộc của MISRA'], 1, 'Comment trong script.'],
              ],
              sum: ['cppcheck + MISRA: không finding.', '9 rule sửa, 6 deviation có lý do và phạm vi hẹp.', 'Biên dịch ARM 2 ECU, 0 cảnh báo.', 'Công cụ không chứng nhận: cần review tay.'],
            },
            {
              id: '14.1.4', t: 'CI, self-test trên chip và kiểm chứng phần cứng', min: 20, pre: ['14.1.2', '1.2.1'],
              concepts: [
                ['CI', 'GitHub Actions build và chạy test mỗi lần push, báo lỗi dưới dạng annotation.'],
                ['Sanitizer', 'ASan (lỗi bộ nhớ), UBSan (hành vi không xác định) chèn kiểm tra lúc chạy.'],
                ['Truy vết yêu cầu', 'Mỗi yêu cầu R1–R8 trong báo cáo trỏ tới bằng chứng; chỉ "met" khi có test tự động hoặc demo phần cứng.'],
              ],
              goal: `Bạn trình bày được chiến lược kiểm thử nhiều lớp của project và biết lớp nào bắt loại lỗi nào.`,
              bg: `Không một loại test nào bắt được mọi lỗi. Unit test không thấy lỗi bit timing; test phần cứng không thấy được lỗi hiếm trong ISO-TP. Kết hợp các lớp mới có độ phủ tốt.`,
              th: `| Lớp | Công cụ | Bắt được |
|---|---|---|
| 1. Unit test C | ⟦tests/⟧, UBSan trên CI | logic giao thức, timeout, biên |
| 2. Test C++ | GoogleTest, ASan + UBSan | client, tương thích client ↔ server |
| 3. Phân tích tĩnh + biên dịch ARM | cppcheck MISRA, arm-gcc | lỗi kiểu, vi phạm quy tắc, lỗi chỉ có trên đích |
| 4. Self-test trên chip | 14 bước UDS trong loopback (M3) | tích hợp trên MCU thật, RTOS, FDCAN |
| 5. Test hệ thống | 2 board, fault injection, tester 22 bước (M4, M5) | dây, bit timing, phản ứng lỗi end-to-end |

**Truy vết:** báo cáo LaTeX có bảng yêu cầu R1–R8 (bitrate, chu kỳ, E2E, phát hiện lỗi, fault injection, UDS, phân lớp, bus-off) và bảng đánh giá trỏ tới bằng chứng.

**Self-test (M3):** link ISO-TP thứ hai trên Control ECU đóng vai tester, chạy 14 bước bằng máy trạng thái, so tiền tố response, có thể bật lỗi cục bộ giữa các bước.`,
              use: `CI chạy trên Ubuntu; khi test C++ thất bại, các dòng lỗi được đưa vào annotation để đọc được mà không cần quyền xem log.`,
              code: [
                { f: '.github/workflows/tests.yml', from: '- name: C++ tester build (AddressSanitizer + UBSan)', to: "| head -40 | sed 's/^/::error::/' || true", hl: ['run: ctest --test-dir tester/build --output-on-failure'],
                  ex: [['- name: Report failed C++ tests as annotations', 'Chỉ chạy khi có lỗi (⟦if: failure()⟧).'], ["| head -40 | sed 's/^/::error::/' || true", 'Mỗi dòng lỗi thành một annotation ⟦::error::⟧.']] },
                { f: 'control_ecu/CM4/Core/App/diag_app.c', from: 'case ST_WAIT_RESP:', to: 'FinishStep(false);', hl: ['bool pass = (s_testerRespLen >= st->expectLen) &&'],
                  ex: [['bool pass = (s_testerRespLen >= st->expectLen) &&', 'Self-test so tiền tố response, giống tester M5.'], ['else if ((now - s_stTimer) >= SELFTEST_TIMEOUT_MS)', 'Không có response trong 500 ms: FAIL.']] },
              ],
              explain: `Self-test trên chip là cầu nối giữa unit test và test hệ thống: dùng chip thật, RTOS thật, FDCAN thật, nhưng không cần board thứ hai.`,
              run: ['Push lên GitHub → Actions chạy ⟦make -C tests⟧ (UBSan).', 'Build tester với ASan + UBSan, ⟦ctest⟧, ⟦uds_tester --sim⟧.', 'Trên bàn: nạp firmware loopback → self-test 14/14.', 'Nối bus thật → fault injection, tester 22/22; lưu log vào ⟦docs/logs/⟧.'],
              fig: { type: 'flow', nodes: [['Sửa code', 'start'], 'Unit test C + GoogleTest (PC, sanitizer)', 'cppcheck MISRA + biên dịch ARM', 'Self-test trên chip (loopback)', 'Test hệ thống trên bus thật', ['Log vào docs/logs/, cập nhật README/báo cáo', 'end']] },
              video: { t: 'Năm lớp kiểm chứng', d: '2:00', goal: 'Lớp nào bắt lỗi gì.',
                s: ['Kim tự tháp: nhiều test nhanh ở dưới, ít test phần cứng ở trên.', 'CI xanh trên GitHub.', 'Self-test 14/14 trong log M3.', 'Tester 22/22 trên bus thật.'] },
              pit: [
                ['Tick roadmap khi mới test trên PC', 'Quy tắc của repo: chỉ tick khi có log phần cứng hoặc test tự động tương ứng.'],
                ['Chỉ chạy test trên Windows', 'MinGW không có UBSan; CI Linux bắt được lỗi mà Windows bỏ qua.'],
              ],
              ex: { task: `Khi bạn viết xong ba mode E2E của bài [[5.1.4]], chúng sẽ đi qua những lớp nào trong bảng trên, theo thứ tự nào? Cần gì để được tick vào roadmap?`, sol: `Lớp 3 trước (⟦arm_compile_check.sh⟧ không cảnh báo, MISRA sạch), có thể thêm một mô hình trên PC dùng ⟦E2e_Check⟧ thật. Lớp 5: nạp Sensor, chạy từng mode trên bus thật, lưu log Control (bộ đếm ⟦crc/rep/seq⟧, ⟦faults=0x04⟧, DTC U0400-81) vào ⟦docs/logs/⟧. Chỉ khi có log đó mới tick roadmap.` },
              quiz: [
                ['Lớp nào phát hiện bit timing sai?', ['Unit test C', 'GoogleTest', 'Test hệ thống trên bus thật', 'cppcheck'], 2, 'Chỉ phần cứng thật mới lộ.'],
                ['Self-test trên chip cần mấy board?', ['Một (loopback)', 'Hai', 'Ba', 'Không cần board'], 0, 'Link thứ hai trên cùng Control ECU.'],
              ],
              sum: ['5 lớp: unit C, C++, tĩnh + ARM, self-test chip, hệ thống.', 'CI với sanitizer mỗi push.', 'Chỉ "met" khi có bằng chứng.'],
            },
          ],
        },
      ],
    },
    {
      id: 'c15', t: 'Bring-up và debug trên phần cứng',
      lessons: [
        {
          id: '15.1', t: 'Ba câu chuyện bring-up',
          subs: [
            {
              id: '15.1.1', t: 'Debug không có debugger: đọc RAM M4 từ Linux và lỗi SysTick', min: 20, pre: ['7.1.1'],
              concepts: [
                ['/dev/mem', 'Thiết bị Linux cho phép đọc/ghi bộ nhớ vật lý, kể cả RAM và thanh ghi của lõi M4.'],
                ['Symbol', 'Tên biến/hàm trong file ELF, kèm địa chỉ; tìm bằng file ⟦.map⟧ hoặc ⟦nm⟧.'],
                ['Default_Handler', 'Hàm bắt mọi ngắt không có handler riêng: thường là vòng lặp vô hạn.'],
              ],
              goal: `Bạn kể được câu chuyện bring-up đầu tiên theo STAR và hiểu kỹ thuật debug khi không gắn được debugger.`,
              bg: `Ở production mode, Linux khởi động M4 qua remoteproc; gắn debugger vào M4 lúc đó không thuận tiện. Nhưng Linux nhìn thấy toàn bộ bộ nhớ vật lý, nên có thể "nhìn trộm" biến của firmware M4.`,
              th: `**Tình huống:** FreeRTOS treo ngay tick đầu tiên, ⟦xTickCount⟧ luôn bằng 0.

**Hành động:** đọc RAM M4 từ Linux qua ⟦/dev/mem⟧ tại địa chỉ của các biến (lấy từ file map). Thấy ngắt SysTick rơi vào ⟦Default_Handler⟧. Nguyên nhân: CubeMX đặt ⟦USE_CUSTOM_SYSTICK_HANDLER_IMPLEMENTATION = 1⟧ (nghĩa là "tôi tự viết SysTick handler") nhưng lại không sinh handler khi TIM7 làm timebase của HAL.

**Kết quả:** ghi đè về 0 trong vùng USER CODE của ⟦FreeRTOSConfig.h⟧ để ⟦cmsis_os2.c⟧ cung cấp handler. Bài học thiết kế đi kèm: giữ trạng thái module ở **file scope** để tìm được theo tên ký hiệu, và đó là lý do của MISRA deviation D3.`,
              use: `Đây là ví dụ cho câu hỏi phỏng vấn "kể một lỗi khó bạn đã sửa". Hai câu chuyện còn lại: [[15.1.2]] và [[15.1.3]].`,
              code: [
                { f: 'control_ecu/CM4/Core/Inc/FreeRTOSConfig.h', from: '#undef  USE_CUSTOM_SYSTICK_HANDLER_IMPLEMENTATION', n: 2, hl: ['#define USE_CUSTOM_SYSTICK_HANDLER_IMPLEMENTATION 0'],
                  ex: [['#undef  USE_CUSTOM_SYSTICK_HANDLER_IMPLEMENTATION', 'Hủy định nghĩa sai của CubeMX…'], ['#define USE_CUSTOM_SYSTICK_HANDLER_IMPLEMENTATION 0', '…và định nghĩa lại, trong vùng USER CODE nên không bị mất khi sinh lại code.']] },
                { f: 'docs/misra_deviations.md', from: '| D3 | 8.9 object at block scope', n: 1, hl: ['| D3 | 8.9 object at block scope'] },
              ],
              explain: `Hai dòng sửa lỗi, nhưng giá trị nằm ở phương pháp: không đoán, đọc trạng thái thật của chip, lần ngược từ triệu chứng (tick = 0) tới nguyên nhân (handler mặc định) tới gốc rễ (cấu hình CubeMX).`,
              run: ['Triệu chứng: không task nào chạy, log dừng sau khởi động.', 'Đọc ⟦xTickCount⟧ qua /dev/mem: 0, không đổi.', 'Kiểm vector SysTick → trỏ tới ⟦Default_Handler⟧.', 'Tìm trong FreeRTOSConfig.h: macro custom handler = 1.', 'Ghi đè về 0 trong USER CODE, build, chạy: tick tăng.'],
              fig: { type: 'flow', nodes: [['Triệu chứng: tick luôn 0', 'start'], 'Giả thuyết: SysTick không tới FreeRTOS', 'Kiểm bằng dữ liệu: đọc RAM/vector qua /dev/mem', 'Nguyên nhân: SysTick → Default_Handler', 'Gốc rễ: USE_CUSTOM_SYSTICK_HANDLER_IMPLEMENTATION = 1 không có handler', ['Sửa trong USER CODE, xác nhận tick tăng', 'end']] },
              video: { t: 'Debug bằng /dev/mem', d: '2:00', goal: 'STAR cho lỗi SysTick.',
                s: ['Log M4 dừng sau boot.', 'SSH vào Linux, đọc địa chỉ xTickCount.', 'Vector SysTick trỏ tới Default_Handler.', 'Sửa trong FreeRTOSConfig.h.', 'Tick tăng, task chạy.'] },
              pit: [
                ['Sửa trực tiếp file CubeMX ngoài USER CODE', 'Lần sinh code sau xóa mất bản sửa và lỗi quay lại.'],
                ['Chuyển mọi biến vào trong hàm cho "đẹp" theo MISRA 8.9', 'Mất khả năng đọc theo tên ký hiệu khi debug kiểu này. D3 ghi lại đánh đổi.'],
              ],
              ex: { task: `Viết câu chuyện này theo STAR trong 4 câu, bằng tiếng Anh, để dùng khi phỏng vấn.`, sol: `S: The Cortex-M4 firmware was started by Linux, so I could not attach a debugger, and FreeRTOS never ticked. T: Find why the scheduler did not run. A: I read the M4 RAM from Linux through /dev/mem and found that SysTick landed in Default_Handler, because CubeMX enabled a custom SysTick handler without generating one. R: I overrode the setting in the USER CODE section, and the scheduler ran normally.` },
              quiz: [
                ['Công cụ nào được dùng để đọc trạng thái M4 khi không có debugger?', ['printf', '/dev/mem từ Linux', 'logic analyzer', 'GoogleTest'], 1, 'Linux thấy bộ nhớ vật lý của M4.'],
                ['Gốc rễ của lỗi SysTick là gì?', ['Thạch anh hỏng', 'CubeMX bật custom SysTick handler nhưng không sinh handler', 'FreeRTOS lỗi', 'Thiếu heap'], 1, 'Sửa bằng cách ghi đè macro về 0.'],
              ],
              sum: ['Không debugger → đọc RAM qua /dev/mem.', 'SysTick rơi vào Default_Handler do cấu hình CubeMX.', 'Sửa trong USER CODE; trạng thái file scope để debug (D3).'],
            },
            {
              id: '15.1.2', t: 'FDCAN kẹt ở INIT: kernel clock mux glitch-free', min: 25, pre: ['3.1.3', '15.1.1'],
              concepts: [
                ['Kernel clock', 'Clock riêng cấp cho phần lõi của ngoại vi (FDCAN), tách khỏi clock bus.'],
                ['Mux glitch-free', 'Bộ chọn clock chỉ chuyển nguồn khi cả nguồn cũ và nguồn mới đều đang chạy, để không tạo xung lỗi.'],
                ['HSEKERON', 'Bit cho phép thạch anh HSE cấp clock tới ngoại vi; Linux để tắt.'],
              ],
              goal: `Bạn giải thích được vì sao FDCAN không bao giờ thoát INIT và cách ⟦CanDrv_PrepareKernelClock⟧ sửa an toàn mà không phá cấu hình của Linux.`,
              bg: `Trên MP157, Linux cấu hình clock tree trước khi M4 chạy. Firmware M4 viết theo giả định CubeMX sẽ gặp một hệ thống clock khác thực tế.`,
              th: `**Triệu chứng:** ⟦CCCR.INIT⟧ của FDCAN luôn bằng 1, kể cả khi xóa từ phía Linux.

**Nguyên nhân:** Linux để mux kernel clock của FDCAN trên PLL4_R nhưng **tắt output PLL4_R** (Linux không dùng FDCAN). Mux là glitch-free: lệnh chuyển sang HSE chỉ hoàn tất khi cả hai nguồn đang chạy. Nguồn cũ tắt → chuyển không bao giờ xong → FDCAN không có clock → không thoát được INIT. Thêm nữa, HSE tới ngoại vi bị chặn bởi HSEKERON = 0.

**Cách sửa (⟦CanDrv_PrepareKernelClock⟧, gọi trước ⟦MX_FDCAN1_Init⟧):**
1. Bật HSEKERON (thanh ghi write-1-to-set).
2. Nếu nguồn hiện tại không phải HSE: tìm PLL đang cấp, bật tạm output của nó nếu đang tắt.
3. Chuyển mux sang HSE, chờ 1 ms.
4. Tắt lại output PLL như Linux đã để (không phá cấu hình của Linux).
5. Đọc lại tần số thật; ⟦ApplyBitTiming⟧ chọn thông số theo đó ([[3.1.3]]).`,
              use: `Comment trong code ghi lại toàn bộ suy luận; README có bảng "Bring-up notes" tóm tắt.`,
              code: [
                { f: 'control_ecu/CM4/Core/Mcal/can_drv.c', from: '/* Kernel clock muxes are glitch-free', to: 'default:                        break;   /* HSE: nothing to do */', hl: ['case RCC_FDCANCLKSOURCE_PLL4_R: *pllcr = &RCC->PLL4CR; *diven = RCC_PLL4CR_DIVREN; break;'],
                  ex: [['/* Kernel clock muxes are glitch-free', 'Cơ chế phần cứng gây ra lỗi, giải thích ngay trên hàm.'], ['static void OldSourceGate(uint32_t source', 'Ánh xạ nguồn hiện tại → thanh ghi PLL và bit enable tương ứng.']] },
                { f: 'control_ecu/CM4/Core/Mcal/can_drv.c', from: 'uint32_t CanDrv_PrepareKernelClock(void)', to: 'return s_kernelClockHz;', hl: ['WRITE_REG(RCC->OCENSETR, RCC_OCENSETR_HSEKERON);', 'SET_BIT(*pllcr, diven);     /* old source present for the switch */', '__HAL_RCC_FDCAN_CONFIG(RCC_FDCANCLKSOURCE_HSE);'],
                  ex: [['WRITE_REG(RCC->OCENSETR, RCC_OCENSETR_HSEKERON);', 'Bước 1: cho HSE tới ngoại vi.'], ['SET_BIT(*pllcr, diven);     /* old source present for the switch */', 'Bước 2: nguồn cũ phải chạy trong lúc chuyển.'], ['HAL_Delay(1U);                  /* >> a few cycles of both clocks */', 'Chờ dư nhiều chu kỳ của cả hai clock.'], ['CLEAR_BIT(*pllcr, diven);   /* leave the PLL as Linux configured it */', 'Bước 4: trả lại cấu hình của Linux.'], ['/* Read back: with RCC TrustZone enabled the write could be ignored. */', 'Bước 5: không tin lệnh ghi, đọc lại.']] },
              ],
              explain: `Ba nguyên tắc: hiểu cơ chế phần cứng (đọc reference manual), sửa tối thiểu (bật tạm rồi trả lại), và xác nhận bằng cách đọc lại thay vì tin lệnh ghi.`,
              run: ['M4 khởi động, UART7 sẵn sàng.', '⟦CanDrv_PrepareKernelClock⟧: bật HSEKERON.', 'Nguồn hiện tại PLL4_R, output tắt → bật tạm DIVREN.', 'Chuyển sang HSE, chờ 1 ms, tắt DIVREN.', 'Đọc lại: 24 MHz → log "FDCAN kernel clock: 24000000 Hz".', '⟦MX_FDCAN1_Init⟧ thành công, FDCAN thoát INIT.'],
              fig: { type: 'seq', actors: ['Firmware M4', 'RCC (clock)', 'PLL4_R', 'HSE', 'FDCAN'], msgs: [[0, 1, 'OCENSETR = HSEKERON'], [0, 2, 'bật tạm DIVREN'], [0, 1, 'mux FDCAN = HSE'], [1, 1, 'chuyển: cả hai nguồn chạy'], [1, 4, 'kernel clock 24 MHz'], [0, 2, 'tắt lại DIVREN'], [0, 1, 'đọc lại tần số'], [0, 4, 'MX_FDCAN1_Init, thoát INIT']] },
              video: { t: 'Vì sao FDCAN không có clock', d: '2:30', goal: 'Mux glitch-free và cách sửa.',
                s: ['Sơ đồ mux: PLL4_R, HSE → FDCAN.', 'Linux tắt PLL4_R: chuyển nguồn kẹt.', 'Bật tạm nguồn cũ, chuyển, tắt lại.', 'Đọc lại tần số, chọn bit timing.'] },
              pit: [
                ['Giả định clock theo CubeMX', 'Trên MP157, Linux quyết định trước. Luôn đọc lại tần số thật.'],
                ['Để PLL bật vĩnh viễn', 'Thay đổi cấu hình của Linux, có thể ảnh hưởng tiêu thụ điện hoặc ngoại vi khác. Code trả lại như cũ.'],
              ],
              ex: { task: `Nếu RCC đang được TrustZone bảo vệ và lệnh chuyển mux bị bỏ qua, firmware sẽ phát hiện ở đâu và phản ứng thế nào?`, sol: `⟦HAL_RCCEx_GetPeriphCLKFreq⟧ đọc lại tần số khác 24 MHz; nếu là 74,25 MHz thì ⟦ApplyBitTiming⟧ dùng bộ thông số dự phòng, nếu là tần số lạ thì trả lỗi và ⟦ControlApp_Init⟧ thất bại thay vì chạy sai bitrate.` },
              quiz: [
                ['Vì sao lệnh chuyển mux sang HSE không hoàn tất?', ['HSE hỏng', 'Mux glitch-free cần cả nguồn cũ chạy, mà Linux đã tắt PLL4_R', 'Thiếu RAM', 'FreeRTOS'], 1, 'Comment trên ⟦OldSourceGate⟧.'],
                ['Sau khi chuyển xong, code làm gì với PLL đã bật tạm?', ['Để nguyên', 'Tắt lại như Linux đã cấu hình', 'Reset PLL', 'Đổi tần số'], 1, 'Không phá cấu hình của Linux.'],
              ],
              sum: ['Mux glitch-free: cả hai nguồn phải chạy khi chuyển.', 'Bật HSEKERON, bật tạm nguồn cũ, chuyển, trả lại.', 'Đọc lại tần số, chọn bit timing theo thực tế.'],
            },
            {
              id: '15.1.3', t: 'Bring-up bus hai node bằng thanh ghi lỗi', min: 20, pre: ['3.1.4', '4.1.2'],
              concepts: [
                ['Chia để trị', 'Tách hệ thống thành từng đoạn và chứng minh từng đoạn đúng bằng dữ liệu.'],
                ['LEC = ACK error', 'Node gửi được, đọc lại được khung của mình, nhưng không ai ACK: đường MCU ↔ transceiver đúng.'],
                ['Bus monitoring', 'Chế độ chỉ nghe (listen-only): node không bao giờ kéo bus, dùng để quan sát an toàn.'],
              ],
              goal: `Bạn mô tả được phương pháp bring-up bus khi hai node "không nói chuyện được", dùng chính thông tin chẩn đoán của bộ điều khiển CAN.`,
              bg: `Khi bus không chạy, có rất nhiều khả năng: dây, transceiver, cực tính, bit timing, cấu hình filter, phần mềm. Đoán mò rất tốn thời gian.`,
              th: `**Phương pháp của project:**
1. **Loại phần mềm trước:** cả hai node đã chạy đúng ở internal loopback (M1, M2).
2. **Kiểm từng node riêng:** đọc thanh ghi lỗi FDCAN. Mỗi node đọc lại được khung của chính nó và báo LEC = ACK error → đường TX/RX giữa MCU và transceiver của từng bên đều đúng; chỉ thiếu bên ACK.
3. **Kiểm bus:** đưa DK1 vào bus monitoring (chỉ nghe) để kiểm cực tính CANH/CANL mà không làm nhiễu bus.
4. Sau khi sửa: 100 khung/s, 0 lỗi E2E, 0 bus-off (M4).

Trong quá trình này Sensor ECU đã trải qua **hàng trăm lần bus-off** và tự phục hồi mỗi lần ([[3.1.4]]): bằng chứng phần cứng cho yêu cầu R8.`,
              use: `Thông số đếm (⟦busoff⟧, ⟦drop⟧, ⟦rx⟧) trong log mỗi giây là công cụ quan sát chính khi bring-up ([[1.2.1]]).`,
              code: [
                { f: 'sensor_ecu/Core/Mcal/can_drv.c', from: 'bool CanDrv_IsBusOff(void)', n: 4, hl: ['return ((hfdcan1.Instance->PSR & FDCAN_PSR_BO) != 0U);'],
                  ex: [['return ((hfdcan1.Instance->PSR & FDCAN_PSR_BO) != 0U);', 'Thanh ghi PSR chứa trạng thái bus-off, error passive và LEC.']] },
                { f: 'sensor_ecu/Core/App/sensor_app.c', from: 'static void LogStatus(void)', to: '(unsigned long)stats.busOffCount);', hl: ['(void)printf("[SENSOR] speed=%u.%u km/h adc=%u mode=%u | tx=%lu drop=%lu rx=%lu rx100=%lu busoff=%lu\\r\\n",'],
                  ex: [['tx=%lu drop=%lu rx=%lu rx100=%lu busoff=%lu', 'Bốn con số đủ để biết node gửi được không, có bị đầy FIFO không, có nhận không, có bus-off không.']] },
              ],
              explain: `Bộ điều khiển CAN là một công cụ chẩn đoán miễn phí: TEC/REC, LEC, cờ bus-off cho biết chính xác loại lỗi trên bus. Đọc chúng trước khi mua thiết bị đo.`,
              run: ['Nối dây, bus không chạy.', 'Đọc LEC từng node: ACK error → dây MCU-transceiver đúng.', 'DK1 chế độ chỉ nghe → kiểm cực tính bus.', 'Sửa, kiểm lại: 100 khung/s, 0 lỗi.', 'Lưu log M4.'],
              fig: { type: 'flow', nodes: [['Bus hai node không chạy', 'start'], 'Phần mềm đúng chưa? → đã chứng minh ở loopback (M1, M2)', 'Từng node: LEC = ACK error → MCU ↔ transceiver đúng', 'DK1 bus monitoring → kiểm cực tính CANH/CANL', ['Sửa đoạn lỗi duy nhất còn lại', 'ok'], ['100 khung/s, 0 lỗi E2E, 0 bus-off', 'end']] },
              video: { t: 'Chia để trị một bus CAN', d: '2:00', goal: 'Phương pháp bring-up.',
                s: ['Danh sách nguyên nhân có thể.', 'Loại phần mềm bằng loopback.', 'LEC = ACK error trên từng node.', 'Listen-only để quan sát an toàn.', 'Kết quả M4.'] },
              pit: [
                ['Thay đổi nhiều thứ cùng lúc', 'Bus chạy lại mà không biết thay đổi nào sửa lỗi. Thay một thứ, kiểm lại.'],
                ['Quan sát bằng một node ở chế độ bình thường', 'Node đó tham gia ACK và có thể che lỗi; bus monitoring không ảnh hưởng bus.'],
              ],
              ex: { task: `Một node báo LEC = Stuff error liên tục còn node kia bình thường. Bạn nghĩ tới nguyên nhân nào trước?`, sol: `Lỗi stuff thường do bit timing không khớp (bitrate/sample point lệch) hoặc nhiễu/phản xạ (thiếu đầu cuối, dây dài). Kiểm bit timing của node đó ([[3.1.3]]) và đo 60 Ω giữa CANH–CANL ([[3.1.1]]).` },
              quiz: [
                ['LEC = ACK error ở một node đang gửi chứng minh điều gì?', ['Dây bus đứt', 'Đường MCU ↔ transceiver của node đó đúng, chỉ thiếu node ACK', 'Bit timing sai', 'Phần mềm lỗi'], 1, 'Node đọc lại được khung của chính nó.'],
                ['Vì sao dùng chế độ bus monitoring để quan sát?', ['Nhanh hơn', 'Node không kéo bus nên không ảnh hưởng tới điều đang quan sát', 'Bắt buộc của HAL', 'Để tiết kiệm điện'], 1, 'Listen-only.'],
              ],
              sum: ['Loại phần mềm bằng loopback trước.', 'Dùng thanh ghi lỗi FDCAN: LEC, bus-off.', 'Listen-only để quan sát; thay một thứ mỗi lần.'],
            },
          ],
        },
      ],
    },
    {
      id: 'c16', t: 'Thuật toán, cấu trúc dữ liệu và hiệu năng',
      lessons: [
        {
          id: '16.1', t: 'Tổng hợp',
          subs: [
            {
              id: '16.1.1', t: 'Danh mục thuật toán và cấu trúc dữ liệu thật sự có trong project', min: 25, pre: ['5.1.2', '6.1.1', '8.1.2'],
              concepts: [
                ['Big-O', 'Cách mô tả thời gian/bộ nhớ tăng theo kích thước input.'],
                ['Mảng vòng (ring buffer)', 'Mảng cố định với chỉ số quay vòng; FIFO không cấp phát.'],
                ['Tìm tuyến tính', 'Duyệt từng phần tử; tốt nhất khi n nhỏ (vài phần tử).'],
              ],
              goal: `Bạn liệt kê được mọi thuật toán và cấu trúc dữ liệu của project kèm độ phức tạp, và giải thích vì sao lựa chọn đơn giản là đúng ở đây.`,
              bg: `Firmware nhúng hiếm khi cần thuật toán phức tạp; điều quan trọng là thời gian chạy **dự đoán được** và bộ nhớ cố định. Bảng dưới chỉ gồm những gì có trong code; phương án thay thế được đánh dấu là kiến thức bổ trợ.`,
              th: `**Thuật toán:**
| Thuật toán | File | Thời gian | Bộ nhớ | Thay thế (bổ trợ) |
|---|---|---|---|---|
| CRC-8 từng bit | ⟦crc8.c⟧ | O(8n) | O(1) | bảng tra 256 byte, O(n) |
| Trung bình trượt tổng chạy | ⟦sensor_app.c⟧ | O(1)/mẫu | O(N), N = 8 | IIR một cực, O(1) bộ nhớ |
| Delta counter modulo 16 | ⟦e2e.c⟧ | O(1) | O(1) | |
| Debounce bộ đếm | ⟦sensor_app.c⟧, ⟦control_app.c⟧ | O(1) | O(1) | |
| Tách/ghép ISO-TP | ⟦isotp.c⟧ | O(n) byte | buffer do caller cấp | |
| Tìm DID tuyến tính | ⟦uds_server.c⟧ | O(d), d = 3 | O(1) | bảng băm / mảng sắp xếp + nhị phân |
| Quét DTC theo mask | ⟦dtc_manager.c⟧ | O(n), n = 5 | O(1) | |
| Định dạng SAE J2012 | ⟦dtc.cpp⟧ | O(1) | O(1) | |

**Cấu trúc dữ liệu:**
| Cấu trúc | Ở đâu | Vì sao |
|---|---|---|
| Mảng vòng + tổng | bộ lọc | O(1) cập nhật |
| Ring buffer một ghi một đọc | ⟦tester_app.c⟧ (ISR → main) | không cần khóa |
| Message queue RTOS | ⟦control_app.c⟧ (ISR → task) | task ngủ khi rỗng |
| Bảng const ⟦{id, len, fn}⟧ | DID, DTC, bước test | dữ liệu thay vì code |
| Struct trạng thái do caller giữ | ⟦E2e_RxState_t⟧, ⟦IsoTp_Link_t⟧ | nhiều instance |
| ⟦std::variant⟧, ⟦std::optional⟧, ⟦std::deque⟧ | tester C++ | kiểu an toàn |

Không có cây, đồ thị, sắp xếp hay băm trong project.`,
              use: `Mỗi dòng của bảng có bài riêng: [[6.1.1]], [[5.1.2]], [[6.1.2]], [[5.1.3]], [[8.1.2]], [[9.1.4]], [[10.1.3]].`,
              code: [
                { f: 'common/uds/uds_server.c', from: 'static const Uds_Did_t *FindDid(uint16_t id)', to: 'return NULL;', hl: ['for (uint8_t i = 0U; i < s_cfg.didCount; i++)'],
                  ex: [['for (uint8_t i = 0U; i < s_cfg.didCount; i++)', 'Tìm tuyến tính trên 3 phần tử: nhanh hơn mọi cấu trúc phức tạp ở kích thước này.']] },
                { f: 'sensor_ecu/Core/App/tester_app.c', from: 'next = (uint8_t)((s_head + 1U) % RING_LEN);', n: 4, hl: ['if (next == s_tail)'],
                  ex: [['if (next == s_tail)', 'Đầy khi ô kế tiếp trùng đuôi: luôn chừa một ô trống.']] },
              ],
              explain: `Câu trả lời tốt cho câu hỏi "có thuật toán gì": nêu đúng những gì có, độ phức tạp, và vì sao không cần phức tạp hơn (n rất nhỏ, thời gian phải dự đoán được).`,
              run: ['Mỗi khung 0x100: CRC (56 vòng) + delta O(1).', 'Mỗi 10 ms: lọc O(1), debounce O(1), 5 monitor O(1), báo 5 DTC O(1) mỗi cái.', 'Mỗi request UDS: tìm DID O(3) hoặc quét DTC O(5), ISO-TP O(n byte).'],
              fig: { type: 'layers', rows: [['O(1)', ['trung bình trượt', 'delta counter', 'debounce', 'DtcMgr_ReportResult', 'SAE J2012']], ['O(n) nhỏ', ['CRC-8: 8 × 7 byte', 'FindDid: 3', 'quét DTC: 5', 'ISO-TP: byte của message']], ['Không có', ['cây', 'đồ thị', 'sắp xếp', 'bảng băm']]] },
              video: { t: 'Thuật toán đơn giản là đúng', d: '1:45', goal: 'Bảng độ phức tạp.',
                s: ['Liệt kê 8 thuật toán.', 'Độ phức tạp từng cái.', 'n nhỏ: tuyến tính thắng.', 'Thời gian dự đoán được quan trọng hơn trung bình nhanh.'] },
              pit: [
                ['Tối ưu sớm (bảng CRC, băm DID)', 'Thêm bộ nhớ và độ phức tạp cho lợi ích không đo được ở 100 khung/s.'],
                ['Kể thuật toán không có trong code', 'Người hỏi sẽ hỏi "ở file nào?". Chỉ nêu thứ có thật, đánh dấu phần bổ trợ.'],
              ],
              ex: { task: `Nếu ECU có 200 DID, bạn có đổi ⟦FindDid⟧ không? Đổi thế nào mà vẫn giữ bộ nhớ tĩnh?`, sol: `Có thể: sắp xếp bảng const theo ID lúc viết code (hoặc kiểm bằng test), rồi tìm nhị phân O(log n). Vẫn là mảng const trong flash, không cần cấp phát.` },
              quiz: [
                ['Độ phức tạp bộ nhớ của bộ lọc trung bình trượt 8 mẫu?', ['O(1)', 'O(N) với N = 8', 'O(n²)', 'O(log N)'], 1, 'Mảng 8 mẫu.'],
                ['Project có dùng bảng băm không?', ['Có, cho DID', 'Có, cho DTC', 'Không', 'Có, trong ISO-TP'], 2, 'Chỉ tìm tuyến tính.'],
              ],
              sum: ['Thuật toán chủ yếu O(1) hoặc O(n) với n nhỏ.', 'Cấu trúc: mảng vòng, ring buffer, queue, bảng const, struct trạng thái.', 'Đơn giản và dự đoán được là lựa chọn đúng.'],
            },
            {
              id: '16.1.2', t: 'Ngân sách thời gian, tải bus và bộ nhớ', min: 20, pre: ['16.1.1', '12.1.1'],
              concepts: [
                ['Ngân sách thời gian', 'Tổng thời gian các bước trong một chu kỳ phải nhỏ hơn chu kỳ.'],
                ['Tải bus', 'Tỷ lệ thời gian bus bận; thiết kế thường giữ dưới khoảng 50 %.'],
                ['Độ trễ trường hợp xấu', 'Thời gian lớn nhất có thể (không phải trung bình): điều quan trọng cho an toàn.'],
              ],
              goal: `Bạn ước tính được các con số hiệu năng chính của hệ thống từ code, và biết con số nào đã đo, con số nào mới ước tính.`,
              bg: `Hiệu năng của ECU là về **thời gian xấu nhất** và **dư địa**, không phải tốc độ trung bình. Mỗi con số cần nói rõ nguồn: tính từ code, đo bằng log, hay đo bằng thiết bị.`,
              th: `| Đại lượng | Giá trị | Nguồn |
|---|---|---|
| Thời gian 1 bit | 2 µs | tính (500 kbit/s) |
| Một khung 8 byte | ~111–135 bit ≈ 0,22–0,27 ms | tính (có bit stuffing) |
| Tải bus | ~120 khung/s ≈ 3 % | tính |
| Phát hiện timeout | 100–110 ms | code + log M4 (39,7 → 39,8 s) |
| Confirm DTC (ngưỡng 3) | 30 ms sau lỗi đầu | code |
| Độ trễ biến trở → PWM | ~40–60 ms | ước tính từ code |
| P2 server | hứa ≤ 50 ms | code; chưa đo |
| Queue RX | 32 khung ≈ 384 byte | code |
| Stack task | 2 × 2 KB | code |
| Heap FreeRTOS | 16 KB, còn 11 KB | log M2 |
| Buffer chẩn đoán | 3 × 256 byte | code |

**Dư địa:** tải bus 3 % cho phép thêm nhiều node; queue 32 khung dư cho 100 khung/s (ComRx rút mỗi khung ngay); 0 queue overflow ở mọi milestone.

**Chưa đo bằng thiết bị:** chu kỳ và jitter của 0x100, P2 thật, thời gian từ khung cuối tới PWM = 0. Đó là bước tiếp theo với logic analyzer.`,
              use: `Khi được hỏi "hệ thống đáp ứng trong bao lâu", trả lời bằng bảng này và nói rõ cột Nguồn.`,
              code: [
                { f: 'control_ecu/CM4/Core/App/control_app.c', from: '#define RX_QUEUE_LEN', to: '#define BUTTON_DEBOUNCE_TICKS', hl: ['#define RX_QUEUE_LEN', '#define E2E_HEAL_FRAMES'],
                  ex: [['#define STARTUP_GRACE_MS', '500 ms chờ khởi động.'], ['#define E2E_HEAL_FRAMES', '10 khung tốt để hết lỗi E2E: 100 ms ở chu kỳ 10 ms.']] },
                { f: 'common/can/can_matrix.h', from: '#define SENSOR_SPEED_CYCLE_MS', n: 1 },
              ],
              explain: `Mọi hằng số thời gian của hệ thống nằm ở vài chỗ (⟦can_matrix.h⟧, đầu ⟦control_app.c⟧, ⟦uds_server.h⟧, ⟦isotp.h⟧): biết chỗ là tính được ngân sách.`,
              run: ['Tính tải: 120 khung × ~125 bit = 15 kbit/s / 500 kbit/s ≈ 3 %.', 'Tính phát hiện: timeout 100 ms + chu kỳ monitor 10 ms.', 'Đối chiếu log M4: 39,7 s → 39,8 s.', 'Ghi chú những gì chưa đo, lên kế hoạch đo.'],
              fig: { type: 'bytes', title: 'Độ trễ biến trở → PWM (ước tính)', cells: [['~40 ms', 'Bộ lọc', 'trung bình 8 mẫu'], ['0–10 ms', 'Chờ chu kỳ gửi', 'task 10 ms'], ['~0,25 ms', 'Truyền', '1 khung'], ['< 1 ms', 'ISR + queue + ComRx', ''], ['0–10 ms', 'Chờ chu kỳ Monitor', '']] },
              video: { t: 'Con số nào đã đo, con số nào ước tính', d: '1:45', goal: 'Trình bày hiệu năng trung thực.',
                s: ['Tính tải bus 3 %.', 'Thời gian phát hiện 100–110 ms và log M4.', 'Độ trễ end-to-end ước tính.', 'Danh sách cần đo bằng logic analyzer.'] },
              pit: [
                ['Trình bày con số ước tính như đã đo', 'Nói rõ nguồn của từng con số.'],
                ['Chỉ nói trung bình', 'An toàn quan tâm trường hợp xấu nhất (ví dụ 110 ms, không phải 105 ms).'],
              ],
              ex: { task: `Nếu thêm khung 0x102 mỗi 10 ms, tải bus mới là bao nhiêu?`, sol: `220 khung/s × ~125 bit ≈ 27,5 kbit/s ≈ 5,5 % của 500 kbit/s, vẫn rất thấp.` },
              quiz: [
                ['Tải bus của project khoảng bao nhiêu?', ['3 %', '30 %', '60 %', '90 %'], 0, '120 khung/s.'],
                ['Con số nào đã có bằng chứng từ log phần cứng?', ['P2 thật', 'Thời gian phát hiện timeout (39,7 → 39,8 s)', 'Jitter của 0x100', 'Độ trễ biến trở → PWM'], 1, 'Log M4.'],
              ],
              sum: ['Tải bus ≈ 3 %, nhiều dư địa.', 'Phát hiện timeout 100–110 ms (có log).', 'Ghi rõ nguồn của mỗi con số; còn cần đo bằng thiết bị.'],
            },
          ],
        },
      ],
    },
    {
      id: 'c17', t: 'Tự dựng lại project',
      lessons: [
        {
          id: '17.1', t: 'Capstone',
          subs: [
            {
              id: '17.1.1', t: 'Lộ trình dựng lại project từ con số không', min: 30, pre: ['11.1.3', '14.1.4'],
              concepts: [
                ['Từ dưới lên, có test', 'Viết module thuần C kèm test trên PC trước, phần cứng sau.'],
                ['Mốc kiểm chứng', 'Mỗi bước kết thúc bằng một bằng chứng (test xanh, log loopback, log bus).'],
              ],
              goal: `Bạn có một kế hoạch cụ thể để tự viết lại toàn bộ project mà không nhìn code có sẵn, theo thứ tự giảm rủi ro.`,
              bg: `Mục tiêu cuối của khóa học là tự xây lại được. Thứ tự đúng giúp mỗi bước dựa trên một nền đã được chứng minh.`,
              th: `**Thứ tự đề xuất (mỗi bước có tiêu chí "xong"):**
1. **CAN matrix + E2E** (⟦can_matrix.h⟧, ⟦crc8⟧, ⟦e2e⟧) + test: check value 0x4B, quay vòng counter, mất/lặp khung.
2. **DTC manager** + test: status bit, debounce, operation cycle, clear, mask.
3. **UDS server** (dùng DTC manager) + test: 6 service, NRC, S3, functional, suppress, reset trì hoãn.
4. **ISO-TP** + test: SF/FF/CF/FC, BS, STmin, timeout, sai SN, overflow, hai đầu 4095 byte.
5. **Sensor ECU MCAL + app**: CAN loopback, ADC, lọc, gửi 110 khung/s (mốc M1).
6. **Control ECU**: clock FDCAN, FreeRTOS, ISR → queue → ComRx, Monitor, PWM, loopback (M2).
7. **diag_app** + self-test trong loopback (M3).
8. **Bus thật** + fault injection (M4); **tester** trên Sensor (M5).
9. **Tester C++**: ITransport, UdsClient, Result, SimulatedEcu link code C, GoogleTest.
10. **Chất lượng**: MISRA, biên dịch ARM, CI.

**Tự kiểm:** sau mỗi bước, giải thích được bằng lời (dùng tab Hỏi đáp/Flashcard), và chạy được test của bước đó.`,
              use: `Bảng trên là đúng thứ tự giảm phụ thuộc trong đồ thị include ([[11.1.2]]): module không phụ thuộc gì làm trước.`,
              code: [
                { f: 'tests/Makefile', from: 'TESTS := test_isotp test_e2e test_dtc test_uds', n: 1, hl: ['TESTS := test_isotp test_e2e test_dtc test_uds'],
                  ex: [['TESTS := test_isotp test_e2e test_dtc test_uds', 'Bốn bước đầu của lộ trình chính là bốn test này.']] },
                { f: 'common/e2e/e2e.h', from: 'void E2e_Protect(uint8_t frame[E2E_FRAME_LEN], uint8_t *counter);', to: 'E2e_Status_t E2e_Check(E2e_RxState_t *state, const uint8_t *frame, uint8_t dlc);', hl: ['E2e_Status_t E2e_Check'],
                  ex: [['void E2e_Protect(uint8_t frame[E2E_FRAME_LEN], uint8_t *counter);', 'Bắt đầu bằng API: viết header và test trước, cài đặt sau.']] },
              ],
              explain: `Mẹo: viết **header và test trước**, cài đặt sau. Header ép bạn quyết định giao diện (ai giữ trạng thái, phần cứng tiêm vào thế nào) trước khi viết dòng logic nào.`,
              run: ['Tuần 1: bước 1–2 trên PC.', 'Tuần 2: bước 3–4 trên PC.', 'Tuần 3: bước 5–6 trên board, loopback.', 'Tuần 4: bước 7–8, bus thật.', 'Tuần 5: bước 9–10.'],
              fig: { type: 'flow', nodes: [['can_matrix + E2E + test', 'start'], 'DTC manager + test', 'UDS server + test', 'ISO-TP + test (hai đầu 4095 byte)', 'Sensor ECU: M1 loopback', 'Control ECU: FreeRTOS, M2 loopback', 'diag_app + self-test M3', 'Bus thật + fault injection M4, tester M5', 'Tester C++ + GoogleTest', ['MISRA, biên dịch ARM, CI', 'end']] },
              video: { t: 'Kế hoạch 5 tuần', d: '2:00', goal: 'Thứ tự dựng lại.',
                s: ['Module không phụ thuộc làm trước.', 'Test trước, phần cứng sau.', 'Loopback trước, bus thật sau.', 'Mốc và bằng chứng của từng bước.'] },
              pit: [
                ['Bắt đầu từ phần cứng', 'Lỗi giao thức lẫn với lỗi phần cứng, rất khó tách.'],
                ['Viết ISO-TP trước UDS và không có test', 'ISO-TP có nhiều trạng thái nhất; không có test thì không có gì đảm bảo.'],
              ],
              ex: { task: `Không nhìn code, viết header ⟦e2e.h⟧ của riêng bạn (kiểu, trạng thái, hai hàm), rồi so với file thật.`, sol: `Bản của bạn cần ít nhất: hằng vị trí counter/CRC, enum trạng thái (OK, SOME_LOST, INITIAL, ERR_CRC, ERR_REPEATED, ERR_WRONG_SEQ, ERR_LENGTH), struct trạng thái bên nhận do caller giữ, ⟦Protect⟧ và ⟦Check⟧. So sánh và ghi lại khác biệt cùng lý do.` },
              quiz: [
                ['Module nào nên viết đầu tiên?', ['diag_app', 'control_app', 'e2e / crc8', 'uds_tester'], 2, 'Không phụ thuộc gì, test dễ.'],
                ['Vì sao loopback trước bus thật?', ['Nhanh hơn', 'Loại trừ lỗi phần mềm trước khi thêm biến số dây/transceiver', 'Bắt buộc của CAN', 'Không cần'], 1, 'Chia để trị.'],
              ],
              sum: ['Dưới lên: module thuần C + test trước.', 'Header trước, cài đặt sau.', 'Loopback → bus thật → tester ngoài.'],
            },
            {
              id: '17.1.2', t: 'Bước tiếp theo: tester C++ trên Cortex-A7 qua RPMsg', min: 25, extra: true, pre: ['13.2.1', '7.1.1'],
              concepts: [
                ['RPMsg', 'Giao thức nhắn tin giữa lõi A7 (Linux) và M4 trên cùng chip, qua bộ nhớ chia sẻ (OpenAMP).'],
                ['IPCC', 'Inter-Processor Communication Controller: "chuông báo" giữa hai lõi.'],
                ['/dev/ttyRPMSG0', 'Thiết bị TTY phía Linux khi M4 dùng virtual UART qua RPMsg.'],
              ],
              goal: `Bạn hiểu phần chưa làm của roadmap, những gì đã sẵn sàng trong code, và thiết kế cần có để tester C++ nói chuyện với Control ECU thật.`,
              bg: `Đây là **kiến thức bổ trợ / dự kiến**: chưa có code RPMsg bridge. Bài nêu rõ cái đã có và cái cần làm, không giả định thêm.`,
              th: `**Đã có:**
- M4 khởi tạo IPCC và OpenAMP (⟦MX_OPENAMP_Init(RPMSG_REMOTE, NULL)⟧ trong ⟦main.c⟧, production mode).
- Driver ⟦virt_uart.c⟧ có sẵn trong Middlewares (chưa dùng).
- Phía C++: ⟦UdsClient⟧ chỉ cần một ⟦ITransport⟧ mới; comment trong ⟦uds_tester.cpp⟧ ghi rõ kế hoạch ⟦/dev/ttyRPMSG0⟧.

**Cần làm (thiết kế đề xuất):**
1. **Đóng khung trên TTY:** TTY là luồng byte, không giữ ranh giới message. Ví dụ khung: ⟦[len_hi][len_lo][addressing][payload…]⟧, kèm hàm encode/decode thuần C++ có unit test.
2. **Phía M4 (C):** VIRT_UART nhận byte, ghép khung, gọi ⟦Uds_ProcessRequest⟧, gửi response. Quan trọng: UDS server không re-entrant → xử lý request RPMsg **trong cùng task với CAN** (ComRx), không chạy song song.
3. **Phía Linux (C++):** ⟦RpmsgTransport : ITransport⟧: ⟦open()⟧ TTY, chế độ raw (⟦cfmakeraw⟧), ⟦write()⟧ khung, ⟦poll()⟧ có timeout cho ⟦receive()⟧.
4. **Biên dịch chéo cho A7:** SDK OpenSTLinux trên Linux/WSL2; chép lên board, chạy ⟦uds_tester --rpmsg /dev/ttyRPMSG0⟧.
5. **Kiểm chứng:** cùng kịch bản regression, lưu log vào ⟦docs/logs/⟧, rồi mới tick roadmap.`,
              use: `Lợi ích của thiết kế ⟦ITransport⟧ hiện ra ở đây: client, kịch bản và mọi test giữ nguyên ([[13.2.1]]).`,
              code: [
                { f: 'tester/apps/uds_tester.cpp', from: ' *   uds_tester --sim      run the regression scenario against the simulated ECU', n: 4, hl: [' * The RPMsg transport to the real Control ECU (/dev/ttyRPMSG0 on the DK1) is'],
                  ex: [[' * The RPMsg transport to the real Control ECU (/dev/ttyRPMSG0 on the DK1) is', 'Kế hoạch được ghi trong code: transport mới, client và kịch bản không đổi.']] },
                { f: 'control_ecu/CM4/Core/Src/main.c', from: '/* IPCC initialisation */', n: 4, hl: ['MX_OPENAMP_Init(RPMSG_REMOTE, NULL);'],
                  ex: [['MX_OPENAMP_Init(RPMSG_REMOTE, NULL);', 'M4 là phía remote của RPMsg; chưa có endpoint nào được tạo.']] },
                { f: 'tester/include/uds/transport.hpp', from: ' * One call carries one complete UDS message.', n: 3,
                  ex: [[' * framing on RPMsg', 'Interface đã tính trước việc đóng khung trên RPMsg.']] },
              ],
              explain: `Ba comment ở ba file cho thấy kế hoạch đã được chuẩn bị trong kiến trúc từ trước: interface có chỗ cho "framing on RPMsg", tester ghi rõ thiết bị, M4 đã bật OpenAMP.`,
              run: ['(Dự kiến) Linux: ⟦RpmsgTransport::send⟧ đóng khung, ⟦write⟧ vào TTY.', 'RPMsg → IPCC báo M4 → VIRT_UART callback nhận byte.', 'M4 ghép khung, chuyển cho ComRx, ⟦Uds_ProcessRequest⟧.', 'Response đóng khung, ⟦VIRT_UART_Transmit⟧ → Linux ⟦poll⟧ thấy dữ liệu.', '⟦receive⟧ ghép khung, trả response cho UdsClient.'],
              fig: { type: 'seq', actors: ['UdsClient', 'RpmsgTransport (A7)', '/dev/ttyRPMSG0', 'VIRT_UART (M4)', 'ComRx → UDS'], msgs: [[0, 1, 'send(22 F1 95)'], [1, 2, 'write [00 03 00 22 F1 95]'], [2, 3, 'RPMsg + IPCC'], [3, 4, 'khung hoàn chỉnh'], [4, 3, '62 F1 95 …'], [3, 2, 'RPMsg'], [2, 1, 'poll → read'], [1, 0, 'receive() → Bytes']] },
              figCap: 'Thiết kế đề xuất, chưa có trong code.',
              video: { t: 'Tester trên Linux nói chuyện với M4', d: '2:30', goal: 'Hiểu phần còn lại của roadmap.',
                s: ['Hai lõi trên một chip, RPMsg ở giữa.', 'Đã có: OpenAMP trên M4, ITransport trong C++.', 'Cần: đóng khung, VIRT_UART, RpmsgTransport.', 'Không re-entrant: xử lý trong ComRx.', 'Biên dịch chéo, kiểm chứng.'] },
              pit: [
                ['Gửi message thẳng lên TTY không đóng khung', 'Hai message có thể dính nhau hoặc một message bị tách đôi khi đọc.'],
                ['Gọi ⟦Uds_ProcessRequest⟧ từ callback RPMsg ở task khác', 'Đua dữ liệu với request CAN trong ComRx: server không re-entrant.'],
              ],
              ex: { task: `Viết (trên giấy) hai hàm thuần C++ ⟦encodeFrame(span<const uint8_t>, Addressing) -> Bytes⟧ và ⟦decodeFrames(Bytes& buffer) -> vector<Bytes>⟧, và liệt kê 4 test cho chúng.`, sol: `Test: một message → một khung đúng độ dài; hai khung dính nhau trong buffer → tách được hai; khung chỉ mới có nửa → chưa trả gì và giữ phần dư; độ dài khai báo quá lớn (> 4095) → báo lỗi/bỏ. Các hàm này chạy và test được ngay trên Windows.` },
              quiz: [
                ['Phần nào của RPMsg đã có trong code?', ['RpmsgTransport', 'MX_OPENAMP_Init trên M4 và interface ITransport', 'Đóng khung TTY', 'Không có gì'], 1, 'Bridge và transport chưa viết.'],
                ['Vì sao request RPMsg phải xử lý trong ComRx?', ['Cho nhanh', 'Vì UDS server không re-entrant, request CAN cũng xử lý ở đó', 'Vì IPCC', 'Vì Linux'], 1, 'Tránh hai task cùng gọi server.'],
              ],
              sum: ['Đã có: OpenAMP trên M4, ITransport, kế hoạch trong comment.', 'Cần: đóng khung, VIRT_UART bridge, RpmsgTransport, biên dịch chéo.', 'Client, kịch bản, test giữ nguyên.'],
            },
          ],
        },
      ],
    },
  ],
};
